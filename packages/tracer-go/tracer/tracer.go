// Package tracer is the Go tracer SDK for the DSA Code Visualizer.
//
// A user writes a normal LeetCode-style solution but constructs its key data
// structures through this package (e.g. tracer.NewArray("nums", xs)) instead of
// raw primitives. Each mutating operation emits one line to stdout of the form
//
//	@TRACE@{"step":0,"type":"array_write",...}
//
// matching the @dsa/trace-schema contract. The user's own fmt.Println output is
// untouched — the Timeline Recorder only parses lines with the @TRACE@ prefix.
//
// Phase 0 implements the Array type only. Stack/Queue/Deque/String and the
// node-link / table families arrive in later phases.
package tracer

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

// TracePrefix marks a line as trace data. Must match TRACE_PREFIX in @dsa/trace-schema.
const TracePrefix = "@TRACE@"

// envelope is the on-the-wire shape of a TraceEvent. Optional fields (codeLine,
// callDepth, timestampMs) are omitted in Phase 0 and added when their features land.
type envelope struct {
	Step        int            `json:"step"`
	Type        string         `json:"type"`
	StructureID string         `json:"structureId"`
	Payload     map[string]any `json:"payload"`
}

var (
	mu    sync.Mutex
	step  int
	names = map[string]int{} // for structureId collision auto-suffixing
)

// register returns a unique structureId for name, auto-suffixing collisions
// (e.g. a second "dp" becomes "dp_2"), per the PRD §16 recommendation.
func register(name string) string {
	mu.Lock()
	defer mu.Unlock()
	if _, seen := names[name]; !seen {
		names[name] = 1
		return name
	}
	names[name]++
	suffixed := fmt.Sprintf("%s_%d", name, names[name])
	fmt.Fprintf(os.Stderr, "tracer: duplicate structure name %q, using %q\n", name, suffixed)
	return suffixed
}

// emit writes one trace line. Best-effort: a marshal error is logged to stderr and
// dropped rather than crashing the user's program.
func emit(eventType, structureID string, payload map[string]any) {
	mu.Lock()
	e := envelope{Step: step, Type: eventType, StructureID: structureID, Payload: payload}
	step++
	mu.Unlock()

	b, err := json.Marshal(e)
	if err != nil {
		fmt.Fprintf(os.Stderr, "tracer: failed to marshal %s event: %v\n", eventType, err)
		return
	}
	// One Println = one atomic-ish write, prefixed, no embedded newlines (json.Marshal
	// never emits them). Println adds the trailing newline the recorder splits on.
	fmt.Println(TracePrefix + string(b))
}

// Array is a traced integer slice. Reads, writes, and swaps are visualized.
type Array struct {
	id   string
	data []int
}

// NewArray creates a traced array named `name`, seeded with `initial`, and emits
// an array_init event. The slice is copied, so later mutations of `initial` by the
// caller do not desync the trace.
func NewArray(name string, initial []int) *Array {
	id := register(name)
	data := make([]int, len(initial))
	copy(data, initial)

	values := make([]any, len(data))
	for i, v := range data {
		values[i] = v
	}
	emit("array_init", id, map[string]any{
		"length":        len(data),
		"initialValues": values,
	})
	return &Array{id: id, data: data}
}

// Get reads index i, emits array_read, and returns the value.
func (a *Array) Get(i int) int {
	v := a.data[i]
	emit("array_read", a.id, map[string]any{"index": i, "value": v})
	return v
}

// Set writes v at index i and emits array_write with the old and new values.
func (a *Array) Set(i, v int) {
	old := a.data[i]
	a.data[i] = v
	emit("array_write", a.id, map[string]any{"index": i, "oldValue": old, "newValue": v})
}

// Swap exchanges the values at indices i and j and emits array_swap.
func (a *Array) Swap(i, j int) {
	a.data[i], a.data[j] = a.data[j], a.data[i]
	emit("array_swap", a.id, map[string]any{"indexA": i, "indexB": j})
}

// Len returns the length. Pure metadata — emits no event.
func (a *Array) Len() int {
	return len(a.data)
}

// Stack is a LIFO stack of ints. Push/Pop/Peek are visualized; the renderer draws
// the top as the only open end.
type Stack struct {
	id   string
	data []int
}

func NewStack(name string) *Stack { return &Stack{id: register(name)} }

func (s *Stack) Push(v int) {
	s.data = append(s.data, v)
	emit("stack_push", s.id, map[string]any{"value": v})
}

func (s *Stack) Pop() int {
	n := len(s.data)
	v := s.data[n-1]
	s.data = s.data[:n-1]
	emit("stack_pop", s.id, map[string]any{"value": v})
	return v
}

func (s *Stack) Peek() int {
	v := s.data[len(s.data)-1]
	emit("stack_peek", s.id, map[string]any{"value": v})
	return v
}

func (s *Stack) Empty() bool { return len(s.data) == 0 }
func (s *Stack) Len() int    { return len(s.data) }

// Queue is a FIFO queue of ints: enqueue at the rear, dequeue at the front.
type Queue struct {
	id   string
	data []int
}

func NewQueue(name string) *Queue { return &Queue{id: register(name)} }

func (q *Queue) Enqueue(v int) {
	q.data = append(q.data, v)
	emit("queue_enqueue", q.id, map[string]any{"value": v})
}

func (q *Queue) Dequeue() int {
	v := q.data[0]
	q.data = q.data[1:]
	emit("queue_dequeue", q.id, map[string]any{"value": v})
	return v
}

func (q *Queue) Peek() int {
	v := q.data[0]
	emit("queue_peek", q.id, map[string]any{"value": v})
	return v
}

func (q *Queue) Empty() bool { return len(q.data) == 0 }
func (q *Queue) Len() int    { return len(q.data) }

// Deque is a double-ended queue of ints: push/pop at either end.
type Deque struct {
	id   string
	data []int
}

func NewDeque(name string) *Deque { return &Deque{id: register(name)} }

func (d *Deque) PushFront(v int) {
	d.data = append([]int{v}, d.data...)
	emit("deque_push_front", d.id, map[string]any{"value": v})
}

func (d *Deque) PushBack(v int) {
	d.data = append(d.data, v)
	emit("deque_push_back", d.id, map[string]any{"value": v})
}

func (d *Deque) PopFront() int {
	v := d.data[0]
	d.data = d.data[1:]
	emit("deque_pop_front", d.id, map[string]any{"value": v})
	return v
}

func (d *Deque) PopBack() int {
	n := len(d.data)
	v := d.data[n-1]
	d.data = d.data[:n-1]
	emit("deque_pop_back", d.id, map[string]any{"value": v})
	return v
}

// Front and Back read an end without mutating — pure metadata, no event.
func (d *Deque) Front() int { return d.data[0] }
func (d *Deque) Back() int  { return d.data[len(d.data)-1] }
func (d *Deque) Empty() bool { return len(d.data) == 0 }
func (d *Deque) Len() int    { return len(d.data) }

// TracedString is a read-only string with two-pointer compare visualization.
type TracedString struct {
	id string
	s  string
}

func NewString(name string, s string) *TracedString {
	id := register(name)
	emit("string_init", id, map[string]any{"length": len(s), "value": s})
	return &TracedString{id: id, s: s}
}

// At returns the byte at i. Pure metadata — no event.
func (t *TracedString) At(i int) byte { return t.s[i] }

// Compare emits string_compare for indices i and j and returns whether they match.
func (t *TracedString) Compare(i, j int) bool {
	match := t.s[i] == t.s[j]
	emit("string_compare", t.id, map[string]any{
		"indexA": i,
		"indexB": j,
		"charA":  string(t.s[i]),
		"charB":  string(t.s[j]),
		"isMatch": match,
	})
	return match
}

func (t *TracedString) Len() int { return len(t.s) }
