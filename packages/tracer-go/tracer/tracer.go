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
