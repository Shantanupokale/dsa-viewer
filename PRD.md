# PRD: DSA Code Visualizer

Status: Draft v1 — ready for implementation
Audience: Coding agent (Claude Code / Cursor / Codex) + human reviewers
Companion doc: `ARCHITECTURE.md` (read first — this PRD assumes that architecture)

---

## 1. Product summary

A web app where a user pastes a LeetCode-style solution (Go, Java, or C++), written against a small "tracer" SDK instead of raw language primitives for its key data structures. The app compiles and runs the code in a sandboxed container, captures a structured stream of execution events, and replays them as a smooth, controllable animation — showing exactly how the algorithm's data structures evolve step by step, alongside the current source line, variable state, call stack, and a plain-English explanation of each step.

**Not in scope for this PRD's Phase 0-2**: arbitrary unmodified code execution, public multi-tenant hosting, AI-generated explanations (Explanation Engine ships with rule-based text first; the interface must support swapping in an LLM-backed provider later, but that swap itself is out of scope here).

---

## 2. Goals

- G1: A user can paste tracer-instrumented Go/Java/C++ code, run it, and watch a smooth, scrubbable animation of the algorithm's data structures.
- G2: The same frontend renders traces from all three languages identically — no language-specific UI code.
- G3: Adding a new data structure (e.g. a Trie in Phase 5) requires writing a new Visualization Plugin, not touching existing plugins or the pipeline.
- G4: Playback stays smooth (60fps target) even on traces with tens of thousands of events.
- G5: The system is safe to run for multiple people (friends) without needing to trust their code.

## 3. Non-goals (explicit, to prevent scope creep from an agent's perspective)

- NG1: Do not attempt to parse or debug *unmodified* user code. All visualized structures MUST go through the tracer SDK.
- NG2: Do not build a general-purpose plugin marketplace, user accounts system, or billing in this phase.
- NG3: Do not build the Camera system (pan/zoom) until a Phase-3+ renderer actually needs it (graphs with 50+ nodes). Do not gold-plate the array/stack/queue renderers with camera controls.
- NG4: Do not implement AI-generated explanations yet — implement the `ExplanationProvider` interface with a rule-based implementation only.

---

## 4. Users & primary use case

Primary user: the requester and a small group of friends, using this to build DSA intuition for interview prep / competitive programming. No public signup flow needed — a single shared invite password is sufficient auth for this phase (see §13).

**Primary flow**:
1. Open app → pick language (Go/Java/C++) → paste tracer-instrumented solution → provide input → click "Visualize"
2. Code compiles and runs in a sandbox; trace events stream back
3. Player shows the first data structure state; user hits Play, or scrubs the timeline manually
4. As playback proceeds: the relevant renderer animates each change, the current source line highlights in the Monaco editor, the call stack panel updates (if recursive), the explanation panel shows a one-line description of the current step
5. User can pause, step forward/backward one event at a time, jump to any point on the timeline, and change speed (0.25x–8x)

---

## 5. System architecture (reference)

See `ARCHITECTURE.md` §2 for the full pipeline diagram. Restated as the contract between components:

```
User code (tracer-instrumented)
  → Execution Service (Docker sandbox, one per run)
    → stdout stream tagged with @TRACE@ lines
  → Timeline Recorder (parses stdout → TraceEvent[] + periodic snapshots)
  → Replay Engine (frontend: step index, play/pause/scrub state)
  → Visualization Registry (algorithm/plugin → which renderer + panels)
  → Animation Engine (event type → motion recipe)
  → Renderer (Sequence / NodeLink / Table scene)

  (parallel branch)
  → Explanation Engine (event → plain text) → Explanation Panel
```

---

## 6. Data contract: TraceEvent schema

This is the single most important contract in the system — implement `packages/trace-schema` FIRST, before any tracer SDK or renderer code, since everything else depends on it.

```ts
// packages/trace-schema/src/index.ts

export interface TraceEvent {
  step: number;              // monotonically increasing, 0-indexed
  type: EventType;
  structureId: string;       // name given at tracer.NewX("name", ...) — lets multiple structures coexist in one trace
  payload: Record<string, unknown>; // shape depends on `type`, see table below
  codeLine?: number;         // 1-indexed source line, for editor highlight
  callDepth?: number;        // current recursion depth, for call-stack indentation
  timestampMs?: number;      // optional, relative to run start
}

export type EventType =
  // Sequence family
  | "array_init" | "array_read" | "array_write" | "array_swap"
  | "string_init" | "string_compare" | "string_match" | "pointer_move"
  | "stack_push" | "stack_pop" | "stack_peek"
  | "queue_enqueue" | "queue_dequeue" | "queue_peek"
  | "deque_push_front" | "deque_push_back" | "deque_pop_front" | "deque_pop_back"
  | "window_update"
  // Node-link family
  | "linkedlist_init" | "linkedlist_node_create" | "linkedlist_pointer_update"
  | "linkedlist_insert" | "linkedlist_delete" | "linkedlist_traverse"
  | "graph_init" | "node_visit" | "edge_traverse" | "backtrack"
  | "tree_init" | "tree_node_visit" | "tree_rotate"
  | "trie_insert" | "trie_visit"
  // Table family
  | "dp_init" | "dp_cell_read" | "dp_cell_write"
  | "segtree_build" | "segtree_query" | "segtree_update"
  | "heap_swap" | "heap_extract"
  // Control flow
  | "call_push" | "call_return"
  | "console_log";
```

### 6.1 Payload shapes (implement as discriminated union validated with zod)

| `type` | `payload` shape |
|---|---|
| `array_init` | `{ length: number, initialValues: unknown[] }` |
| `array_read` | `{ index: number, value: unknown }` |
| `array_write` | `{ index: number, oldValue: unknown, newValue: unknown }` |
| `array_swap` | `{ indexA: number, indexB: number }` |
| `string_compare` | `{ indexA: number, indexB: number, charA: string, charB: string, isMatch: boolean }` |
| `stack_push` | `{ value: unknown }` |
| `stack_pop` | `{ value: unknown }` |
| `queue_enqueue` | `{ value: unknown }` |
| `queue_dequeue` | `{ value: unknown }` |
| `deque_push_front` / `deque_push_back` | `{ value: unknown }` |
| `deque_pop_front` / `deque_pop_back` | `{ value: unknown }` |
| `window_update` | `{ left: number, right: number, currentAggregate?: unknown }` |
| `linkedlist_node_create` | `{ nodeId: string, value: unknown }` |
| `linkedlist_pointer_update` | `{ nodeId: string, pointerName: "next" \| "prev", targetNodeId: string \| null }` |
| `node_visit` | `{ nodeId: string, state: "visiting" \| "visited" }` |
| `edge_traverse` | `{ fromNodeId: string, toNodeId: string, weight?: number }` |
| `backtrack` | `{ fromNodeId: string, toNodeId: string }` |
| `tree_node_visit` | `{ nodeId: string, order: "pre" \| "in" \| "post" \| "level" }` |
| `dp_cell_write` | `{ row: number, col: number, oldValue: unknown, newValue: unknown, dependsOn?: Array<{row: number, col: number}> }` |
| `heap_swap` | `{ indexA: number, indexB: number }` |
| `call_push` | `{ functionName: string, args: Record<string, unknown> }` |
| `call_return` | `{ functionName: string, returnValue: unknown }` |
| `console_log` | `{ message: string }` |

**Acceptance criteria for this section**: every payload shape above has a corresponding zod schema in `trace-schema`, a discriminated union `TraceEventSchema` validates the full envelope, and there is a unit test asserting at least one valid and one invalid example per event type.

---

## 7. Tracer SDK specification

One package per language: `tracer-go`, `tracer-java`, `tracer-cpp`. All three must implement the same conceptual API (constructor names, method names may follow language convention: `NewArray` in Go, `new TracedArray()` in Java, `Tracer::Array` in C++).

### 7.1 Output protocol (identical across all three)

Every event is written to stdout as a single line: `@TRACE@` followed by the JSON-encoded `TraceEvent` (no pretty-printing, no embedded newlines). The user's own debug print statements are unaffected and pass through stdout normally — the Timeline Recorder filters for the `@TRACE@` prefix and ignores everything else.

### 7.2 Sequence family API (Go reference; mirror in Java/C++)

```go
package tracer

type Array struct { /* unexported */ }

func NewArray(name string, initial []int) *Array
func (a *Array) Get(i int) int                 // emits array_read
func (a *Array) Set(i int, v int)               // emits array_write
func (a *Array) Swap(i, j int)                  // emits array_swap
func (a *Array) Len() int                       // no event, pure metadata

type Stack struct { /* unexported */ }
func NewStack(name string) *Stack
func (s *Stack) Push(v int)                     // emits stack_push
func (s *Stack) Pop() int                       // emits stack_pop
func (s *Stack) Peek() int                      // emits stack_peek
func (s *Stack) Empty() bool

type Queue struct { /* unexported */ }
func NewQueue(name string) *Queue
func (q *Queue) Enqueue(v int)                  // emits queue_enqueue
func (q *Queue) Dequeue() int                   // emits queue_dequeue

type Deque struct { /* unexported */ }
func NewDeque(name string) *Deque
func (d *Deque) PushFront(v int)                // emits deque_push_front
func (d *Deque) PushBack(v int)                 // emits deque_push_back
func (d *Deque) PopFront() int                  // emits deque_pop_front
func (d *Deque) PopBack() int                   // emits deque_pop_back

type TracedString struct { /* unexported */ }
func NewString(name string, s string) *TracedString
func (s *TracedString) At(i int) byte
func (s *TracedString) Compare(i, j int) bool   // emits string_compare
```

### 7.3 Node-link family API (Phase 2+)

```go
type LinkedList struct { /* unexported */ }
func NewLinkedList(name string) *LinkedList
func (l *LinkedList) NewNode(value int) string          // returns nodeId, emits linkedlist_node_create
func (l *LinkedList) SetNext(nodeId string, targetId string) // emits linkedlist_pointer_update

type Graph struct { /* unexported */ }
func NewGraph(name string) *Graph
func (g *Graph) AddNode(id string) 
func (g *Graph) Visit(id string)                        // emits node_visit
func (g *Graph) TraverseEdge(from, to string)            // emits edge_traverse
```

### 7.4 Recursion auto-instrumentation

The user never manually logs call push/return. Implementation per language:

- **Go**: a helper `tracer.Enter(funcName string, args map[string]any) func(ret any)` — user writes `defer tracer.Enter("solve", map[string]any{"i": i})(result)` — NOT ideal since `result` isn't known yet at defer time. Preferred pattern:
  ```go
  func solve(i int) int {
      done := tracer.Call("solve", map[string]any{"i": i}) // emits call_push
      defer func() { done(&result) }()                     // emits call_return with final value
      ...
  }
  ```
  Exact ergonomics are an implementation detail the agent should resolve during Phase 2 — the requirement is: **zero manual event calls for entry/exit**, just one line at function start.
- **Java**: `try (var scope = tracer.call("solve", Map.of("i", i))) { ... }` using `AutoCloseable` — `close()` emits `call_return`.
- **C++**: `tracer::CallGuard _guard("solve", {{"i", i}});` — destructor emits `call_return` on any exit path (normal return, exception, early return).

**Acceptance criteria**: a recursive Fibonacci solution in each language, instrumented only with the one-line call-tracking statement, produces a correct nested `call_push`/`call_return` sequence with accurate `callDepth` at every level.

---

## 8. Execution service specification

### 8.1 API contract

```
POST /api/run
Content-Type: application/json

Request:
{
  "language": "go" | "java" | "cpp",
  "code": string,        // max 50,000 characters
  "input": string        // raw stdin passed to the program
}

Response 200:
{
  "status": "success",
  "events": TraceEvent[],
  "stdout": string,       // full stdout, including non-@TRACE@ lines
  "durationMs": number
}

Response 200 (runtime error, not a system failure):
{
  "status": "runtime_error",
  "events": TraceEvent[],  // events captured before the crash
  "stdout": string,
  "error": string           // captured stderr / panic message
}

Response 4xx/5xx:
{
  "status": "error",
  "error": string          // e.g. "compilation_failed", "timeout", "internal_error"
}
```

Compilation errors are returned as 200 with `status: "compilation_failed"` and the compiler's stderr in `error`, NOT as an HTTP error — the frontend needs to show this in the editor, not treat it as a system outage. (Correction: use a `status` value consistently; agent should pick one discriminated `status` enum: `"success" | "runtime_error" | "compilation_failed" | "timeout" | "internal_error"` and always return HTTP 200 unless the request itself was malformed — e.g. missing fields → 400.)

### 8.2 Sandbox requirements (non-negotiable)

Each run spins one ephemeral Docker container:
- `--network none` — no network access, ever
- `--memory 256m --memory-swap 256m` — hard memory cap, no swap
- `--cpus 0.5`
- `--pids-limit 128` — prevent fork bombs
- `--read-only` filesystem, with a `tmpfs` mount for scratch/output only
- non-root user inside the container
- wall-clock timeout: 10 seconds, enforced by the orchestrator killing the container (not just a language-level timeout)
- container removed immediately after run (`--rm`), no persistence between runs

### 8.3 Language images

| Language | Base image | Compile | Run |
|---|---|---|---|
| Go | `golang:1.22-alpine` | `go build -o /tmp/prog main.go` | `/tmp/prog < input.txt` |
| Java | `eclipse-temurin:21-jdk-alpine` | `javac Main.java` | `java Main < input.txt` |
| C++ | `gcc:13-alpine` | `g++ -O2 -o /tmp/prog main.cpp` | `/tmp/prog < input.txt` |

Each image must have the corresponding tracer SDK pre-installed/vendored so compilation doesn't require network access (recall: `--network none`).

**Acceptance criteria**: submitting a deliberately infinite loop in each language results in the container being killed at the timeout and the API returning `status: "timeout"` within 11 seconds wall-clock; submitting a program that tries to open a network socket fails at the OS level (connection refused / network unreachable), not via application-level filtering.

---

## 9. Timeline recorder & Replay engine

### 9.1 Timeline recorder (backend, part of `/api/run` handler)

- Reads container stdout line by line
- Lines starting with `@TRACE@` are stripped of the prefix, JSON-parsed, validated against `TraceEventSchema` — invalid lines are logged and dropped (don't crash the whole run over one malformed event)
- All other lines are appended to the plain `stdout` string returned to the client
- Every 100 events, record a full materialized snapshot of all active structures' state (see §9.3) for fast scrubbing

### 9.2 Replay engine (frontend, Zustand store)

```ts
interface PlayerState {
  events: TraceEvent[];
  snapshots: Map<number, MaterializedState>; // step number → full state at that step
  currentStep: number;
  isPlaying: boolean;
  speed: number; // 0.25 to 8
  play(): void;
  pause(): void;
  stepForward(): void;
  stepBackward(): void;
  seekTo(step: number): void;
}
```

`seekTo(step)` finds the nearest snapshot ≤ `step`, then replays only the events between that snapshot and `step` — never replays from event 0. This is what satisfies the 50,000-event smooth-scrubbing NFR.

### 9.3 Materialized state

A plain object per structure type reflecting "what does this structure look like right now" — e.g. for an array: `{ values: unknown[], highlightedIndices: number[], lastOperation: EventType }`. Each renderer defines its own materialized-state shape and a pure reducer function `(state, event) => newState` — this reducer is what gets replayed from the nearest snapshot.

**Acceptance criteria**: scrubbing to step 45,000 of a 50,000-event trace completes in under 100ms and never visibly "plays through" intermediate steps.

---

## 10. Visualization Registry & Plugin contract

```ts
interface VisualizationPlugin<TState = unknown> {
  name: string;                                   // e.g. "sequence", "node-link", "table"
  supportedEvents: EventType[];
  initialState: (initEvent: TraceEvent) => TState;
  reduce: (state: TState, event: TraceEvent) => TState;
  renderer: React.ComponentType<{ state: TState }>;
  animationPresets: Partial<Record<EventType, AnimationRecipe>>;
}

interface AnimationRecipe {
  durationMs: number;
  easing: string;         // e.g. "easeInOut"
  transitionType: "move" | "fade" | "scale" | "glow" | "bounce";
}
```

### 10.1 Algorithm Registry

Maps a named algorithm/problem to which plugins + panels it needs:

```ts
interface AlgorithmDescriptor {
  id: string;                    // e.g. "valid-parentheses"
  displayName: string;
  primaryPlugin: string;         // plugin `name`, e.g. "sequence"
  secondaryPanels: string[];     // e.g. ["variables", "console"]
}

// Example entries:
{ id: "bubble-sort", displayName: "Bubble sort", primaryPlugin: "sequence", secondaryPanels: ["variables"] }
{ id: "valid-parentheses", displayName: "Valid parentheses", primaryPlugin: "sequence", secondaryPanels: ["variables"] }
{ id: "bfs", displayName: "Breadth-first search", primaryPlugin: "node-link", secondaryPanels: ["variables", "console"] }
{ id: "fibonacci-memo", displayName: "Fibonacci (memoized)", primaryPlugin: "table", secondaryPanels: ["call-stack"] }
```

This registry is data, not code — adding an algorithm entry should never require a PR that touches renderer files.

**Acceptance criteria**: registering a new `AlgorithmDescriptor` for an existing plugin (e.g. adding "two-sum" using the `sequence` plugin) requires editing exactly one array literal, zero renderer changes.

---

## 11. Frontend structure & responsibilities

```
apps/web/src/
  editor/
    CodeEditor.tsx        # Monaco wrapper; language picker; highlights codeLine of currentStep
    InputPanel.tsx        # raw stdin textarea
  player/
    playerStore.ts        # Zustand store per §9.2
    PlayerControls.tsx    # play/pause/step/speed/scrubber UI
  registry/
    plugins.ts            # VisualizationPlugin registry (name → plugin)
    algorithms.ts          # AlgorithmDescriptor list
  animation/
    animationEngine.ts     # given an event + plugin's animationPresets, returns Framer Motion transition config
  renderers/
    SequenceScene.tsx       # array/string/stack/queue/deque, parameterized by open ends
    NodeLinkScene.tsx        # linked list/tree/graph/trie, parameterized by layout mode
    TableScene.tsx            # DP table/sparse table/fenwick
    CallStackPanel.tsx
    HeapScene.tsx
  explanation/
    explanationEngine.ts    # rule-based: EventType → template string, filled from payload
    ExplanationPanel.tsx
  panels/
    VariablesPanel.tsx
    ConsolePanel.tsx
  theme/
    tokens.ts                # color/spacing tokens; dark/light/high-contrast
  api/
    runClient.ts             # POST /api/run wrapper
  App.tsx                    # composes editor + player + registry-selected renderer + panels
```

---

## 12. Rendering lifecycle (implementation detail for every scene component)

Every scene component must implement:

```ts
function applyEvent(prevState: TState, event: TraceEvent): {
  before: TState;       // = prevState, unchanged
  after: TState;        // = reduce(prevState, event)
  transition: AnimationRecipe; // looked up from the plugin's animationPresets[event.type]
}
```

The renderer always animates FROM `before` TO `after` using `transition` — it must never snap directly to `after` without playing the transition, except when `speed` is at the maximum (8x) where transitions may be shortened but not skipped entirely (skipping breaks the "watching it think" feel that's the whole point of this project).

---

## 13. Auth & multi-user

- Single shared password gate (env var `APP_ACCESS_PASSWORD`), stored as an HttpOnly cookie after entry. No per-user accounts, no database of users in this phase.
- Rate limit `/api/run` per IP (e.g. 20 requests/minute) to prevent runaway container spawning even among trusted friends.

---

## 14. Non-functional requirements (restated as testable acceptance criteria)

- NFR1: A trace with 50,000 events scrubs to any point in <100ms (see §9.3 acceptance criteria).
- NFR2: `/api/run` wall-clock timeout enforced at 10s regardless of language.
- NFR3: Container memory capped at 256MB; a program that allocates beyond this is killed, not left to swap/hang.
- NFR4: No container has network access, verified by an explicit test that attempts an outbound connection and asserts failure.
- NFR5: Adding a new `EventType` and its renderer support must not require changes to the Timeline Recorder, Replay Engine, or Execution Service — only `trace-schema`, the relevant tracer SDK, and the relevant plugin.

---

## 15. Phased delivery plan with Definition of Done

### Phase 0 — Pipeline skeleton
**Scope**: Go tracer SDK's `Array` type only. `SequenceScene` renderer for arrays only. End-to-end for one language.
**Done when**: a user can paste a Go bubble-sort solution written with `tracer.NewArray`, submit it, and see a smoothly animated array with swap/write animations, scrubbable via the timeline, in the deployed (or locally running) web app.

### Phase 1 — Sequence family completion
**Scope**: Java + C++ parity for `Array`. Add `Stack`, `Queue`, `Deque`, `TracedString` in all three languages. `SequenceScene` extended to handle locked-end push/pop behavior.
**Done when**: the same `valid-parentheses` (stack) and `sliding-window-maximum` (deque) solutions run correctly in all three languages and animate through the identical `SequenceScene` renderer.

### Phase 2 — Node-link foundation
**Scope**: `LinkedList` tracer type (all 3 languages), `NodeLinkScene` + Layout Engine (linear layout only). Recursion auto-instrumentation (all 3 languages) + `CallStackPanel`.
**Done when**: a "reverse linked list" solution and a recursive Fibonacci solution both animate correctly, with accurate call-depth in the call stack panel.

### Phase 3 — Trees & graphs
**Scope**: `Tree` and `Graph` tracer types, extend `NodeLinkScene` with hierarchical (D3 tree) and force-directed (D3 force) layout modes.
**Done when**: DFS/BFS on a graph and an inorder traversal on a binary tree both animate correctly with distinct layout modes selected automatically by structure type.

### Phase 4 — DP tables
**Scope**: `DPTable` tracer type, `TableScene` renderer with dependency-arrow animation.
**Done when**: a 2D knapsack DP solution animates cell-by-cell with visible dependency arrows into each newly written cell.

### Phase 5 — Advanced structures
**Scope**: Segment tree, Fenwick tree, sparse table, trie, heap. Camera system if any graph renderer needs pan/zoom at this point.
**Done when**: each structure has at least one working example algorithm end to end.

### Phase 6 — Sharing & polish
**Scope**: save/share session links, swap `ExplanationEngine`'s rule-based provider for an LLM-backed one behind the same interface.
**Done when**: a session URL reproduces the exact same trace and playback state for another visitor.

---

## 16. Open questions (flag to the human, don't guess silently)

- Exact ergonomics of the Go "call tracking" helper (§7.4) — the pattern shown is a starting proposal, not final.
- Whether `structureId` collisions (e.g. two arrays both named "dp" in one run) should be an error or auto-suffixed — recommend: auto-suffix (`dp`, `dp_2`) and log a warning.
- Whether Phase 6 sharing requires persistent storage (Postgres) or can be a signed/encoded URL containing the full trace for small traces only.
