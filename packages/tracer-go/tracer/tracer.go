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
	CallDepth   *int           `json:"callDepth,omitempty"` // set only inside a call frame
}

var (
	mu    sync.Mutex
	step  int
	depth int                  // current recursion depth (active call frames)
	names = map[string]int{}   // for structureId collision auto-suffixing
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
	if depth > 0 {
		d := depth
		e.CallDepth = &d
	}
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

// LinkedList is a traced singly-linked list. Node creation and next-pointer updates
// are visualized; the renderer draws nodes with pointer arrows. Node ids are assigned
// by the SDK (NewNode returns one); the user threads them through SetNext/Visit.
type LinkedList struct {
	id    string
	count int
	next  map[string]string
}

func NewLinkedList(name string) *LinkedList {
	l := &LinkedList{id: register(name), next: map[string]string{}}
	emit("linkedlist_init", l.id, map[string]any{"doubly": false})
	return l
}

// NewNode creates a node holding value and returns its id (emits linkedlist_node_create).
func (l *LinkedList) NewNode(value int) string {
	nodeID := fmt.Sprintf("%s_n%d", l.id, l.count)
	l.count++
	emit("linkedlist_node_create", l.id, map[string]any{"nodeId": nodeID, "value": value})
	return nodeID
}

// SetNext points nodeId.next at targetID, or at nil when targetID is "" (emits
// linkedlist_pointer_update).
func (l *LinkedList) SetNext(nodeID, targetID string) {
	var target any = nil
	if targetID != "" {
		target = targetID
		l.next[nodeID] = targetID
	} else {
		delete(l.next, nodeID)
	}
	emit("linkedlist_pointer_update", l.id, map[string]any{
		"nodeId":       nodeID,
		"pointerName":  "next",
		"targetNodeId": target,
	})
}

// NextOf returns the current next id ("" if none). Pure metadata — no event.
func (l *LinkedList) NextOf(nodeID string) string { return l.next[nodeID] }

// Visit highlights nodeId as the current traversal position (emits linkedlist_traverse).
func (l *LinkedList) Visit(nodeID string) {
	emit("linkedlist_traverse", l.id, map[string]any{"nodeId": nodeID})
}

// Enter auto-instruments a function for the call-stack view. Write one line at the top
// of a recursive function:
//
//	defer tracer.Enter("fib", map[string]any{"n": n})()
//
// It emits call_push on entry and call_return when the deferred call runs (any exit
// path), and maintains callDepth on every event emitted in between. Zero manual calls.
func Enter(funcName string, args map[string]any) func() {
	emit("call_push", "callstack", map[string]any{"functionName": funcName, "args": args})
	mu.Lock()
	depth++
	mu.Unlock()
	return func() {
		mu.Lock()
		depth--
		mu.Unlock()
		emit("call_return", "callstack", map[string]any{"functionName": funcName, "returnValue": nil})
	}
}

// Graph is a traced graph or tree. Declare nodes and edges up front, then use Visit /
// TraverseEdge to animate a traversal. The layout hint ("force" or "tree") tells the
// renderer whether to place nodes force-directed or hierarchically.
type Graph struct{ id string }

func newGraphLike(name, layout string, directed bool) *Graph {
	g := &Graph{id: register(name)}
	emit("graph_init", g.id, map[string]any{"directed": directed, "layout": layout})
	return g
}

// NewGraph creates a directed graph rendered with a force-directed layout.
func NewGraph(name string) *Graph { return newGraphLike(name, "force", true) }

// NewTree creates a graph rendered with a hierarchical (tree) layout.
func NewTree(name string) *Graph { return newGraphLike(name, "tree", true) }

// AddNode declares a node with a value (emits graph_add_node).
func (g *Graph) AddNode(id string, value int) {
	emit("graph_add_node", g.id, map[string]any{"nodeId": id, "value": value})
}

// AddVertex declares a node labeled by its id, with no value (emits graph_add_node).
func (g *Graph) AddVertex(id string) {
	emit("graph_add_node", g.id, map[string]any{"nodeId": id})
}

// AddEdge declares a structural edge from -> to (emits graph_add_edge).
func (g *Graph) AddEdge(from, to string) {
	emit("graph_add_edge", g.id, map[string]any{"fromNodeId": from, "toNodeId": to})
}

// Visit highlights a node during traversal (emits node_visit).
func (g *Graph) Visit(id string) {
	emit("node_visit", g.id, map[string]any{"nodeId": id, "state": "visiting"})
}

// TraverseEdge highlights an edge during traversal (emits edge_traverse).
func (g *Graph) TraverseEdge(from, to string) {
	emit("edge_traverse", g.id, map[string]any{"fromNodeId": from, "toNodeId": to})
}

// Cell addresses a DP-table cell, used to declare dependencies in SetWithDeps.
type Cell struct{ Row, Col int }

// DPTable is a traced rows×cols table of ints for dynamic programming. Reads and
// writes are visualized; SetWithDeps also draws dependency arrows from the source
// cells into the newly written cell.
type DPTable struct {
	id   string
	rows int
	cols int
	data [][]int
}

func NewDPTable(name string, rows, cols int) *DPTable {
	id := register(name)
	data := make([][]int, rows)
	for i := range data {
		data[i] = make([]int, cols)
	}
	emit("dp_init", id, map[string]any{"rows": rows, "cols": cols})
	return &DPTable{id: id, rows: rows, cols: cols, data: data}
}

// Get reads cell (r, c) and emits dp_cell_read.
func (t *DPTable) Get(r, c int) int {
	v := t.data[r][c]
	emit("dp_cell_read", t.id, map[string]any{"row": r, "col": c, "value": v})
	return v
}

// Set writes v at (r, c) and emits dp_cell_write.
func (t *DPTable) Set(r, c, v int) {
	t.setCell(r, c, v, nil)
}

// SetWithDeps writes v at (r, c), recording which cells it was derived from —
// the renderer draws arrows from each dep into (r, c).
func (t *DPTable) SetWithDeps(r, c, v int, deps []Cell) {
	t.setCell(r, c, v, deps)
}

func (t *DPTable) setCell(r, c, v int, deps []Cell) {
	old := t.data[r][c]
	t.data[r][c] = v
	payload := map[string]any{"row": r, "col": c, "oldValue": old, "newValue": v}
	if len(deps) > 0 {
		ds := make([]map[string]any, len(deps))
		for i, d := range deps {
			ds[i] = map[string]any{"row": d.Row, "col": d.Col}
		}
		payload["dependsOn"] = ds
	}
	emit("dp_cell_write", t.id, payload)
}

// Rows and Cols are pure metadata — no events.
func (t *DPTable) Rows() int { return t.rows }
func (t *DPTable) Cols() int { return t.cols }

// Heap is a traced min-heap of ints. Push and Pop run the sift themselves, emitting
// one heap_swap per comparison-swap, so the renderer can animate every bubble-up /
// bubble-down step without the user writing any heap logic.
type Heap struct {
	id   string
	data []int
}

func NewHeap(name string) *Heap {
	h := &Heap{id: register(name)}
	emit("heap_init", h.id, map[string]any{"initialValues": []any{}})
	return h
}

// Push inserts v and sifts it up (emits heap_push, then a heap_swap per step).
func (h *Heap) Push(v int) {
	h.data = append(h.data, v)
	emit("heap_push", h.id, map[string]any{"value": v})
	i := len(h.data) - 1
	for i > 0 {
		parent := (i - 1) / 2
		if h.data[parent] <= h.data[i] {
			break
		}
		h.data[parent], h.data[i] = h.data[i], h.data[parent]
		emit("heap_swap", h.id, map[string]any{"indexA": parent, "indexB": i})
		i = parent
	}
}

// Pop removes and returns the min (emits heap_extract, then a heap_swap per sift-down step).
func (h *Heap) Pop() int {
	n := len(h.data)
	top := h.data[0]
	h.data[0] = h.data[n-1]
	h.data = h.data[:n-1]
	emit("heap_extract", h.id, map[string]any{"value": top})
	i := 0
	for {
		l, r, smallest := 2*i+1, 2*i+2, i
		if l < len(h.data) && h.data[l] < h.data[smallest] {
			smallest = l
		}
		if r < len(h.data) && h.data[r] < h.data[smallest] {
			smallest = r
		}
		if smallest == i {
			break
		}
		h.data[i], h.data[smallest] = h.data[smallest], h.data[i]
		emit("heap_swap", h.id, map[string]any{"indexA": i, "indexB": smallest})
		i = smallest
	}
	return top
}

func (h *Heap) Len() int    { return len(h.data) }
func (h *Heap) Empty() bool { return len(h.data) == 0 }

// Trie is a traced prefix tree over lowercase words. Insert creates missing child
// nodes (emitting trie_insert each) and Search walks the path (emitting trie_visit).
type Trie struct {
	id       string
	count    int
	children map[string]map[byte]string // nodeId -> char -> childId
}

func NewTrie(name string) *Trie {
	t := &Trie{id: register(name), children: map[string]map[byte]string{}}
	root := t.id + "_root"
	t.children[root] = map[byte]string{}
	emit("trie_insert", t.id, map[string]any{"nodeId": root, "char": "•", "parentNodeId": nil})
	return t
}

func (t *Trie) root() string { return t.id + "_root" }

// Insert adds word to the trie, emitting trie_insert for each newly created node and
// trie_visit for nodes already on the path. The final node is marked isWordEnd.
func (t *Trie) Insert(word string) {
	cur := t.root()
	for i := 0; i < len(word); i++ {
		c := word[i]
		if child, ok := t.children[cur][c]; ok {
			emit("trie_visit", t.id, map[string]any{"nodeId": child})
			cur = child
			continue
		}
		t.count++
		child := fmt.Sprintf("%s_n%d", t.id, t.count)
		t.children[cur][c] = child
		t.children[child] = map[byte]string{}
		emit("trie_insert", t.id, map[string]any{
			"nodeId":       child,
			"char":         string(c),
			"parentNodeId": cur,
			"isWordEnd":    i == len(word)-1,
		})
		cur = child
	}
}

// Search walks word's path, emitting trie_visit per matched node; returns whether the
// full path exists.
func (t *Trie) Search(word string) bool {
	cur := t.root()
	for i := 0; i < len(word); i++ {
		child, ok := t.children[cur][word[i]]
		if !ok {
			return false
		}
		emit("trie_visit", t.id, map[string]any{"nodeId": child})
		cur = child
	}
	return true
}
