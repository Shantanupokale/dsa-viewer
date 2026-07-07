# DSA Visualizer — Architecture Blueprint (v3)

## 1. Guiding constraint

Full "paste any raw C++/Java/Go and watch it animate with zero code changes" means attaching real debuggers (gdb/Delve/JDWP) to arbitrary user code in sandboxed containers — a multi-month systems effort per language, plus a real security surface since you're executing strangers' native code.

The approach here instead: users write **normal LeetCode-style code**, but declare their key data structures using **drop-in traced types** from a small SDK (`tracer.NewArray(n)` instead of a plain array, etc.). Loops, conditionals, recursion, function signatures — all stay exactly as a normal solution would look.

---

## 2. The pipeline (product architecture, not just tech)

Events are a transport format, not the center of the design. The center is a layered pipeline where everything past the Timeline Recorder is language-independent:

```
Execution service (Go / Java / C++ sandbox)
        │  Tracer SDK runs inside this process — not a separate hop
        ▼
Timeline recorder      — records raw events + periodic snapshots
        ▼
Replay engine          — step player; drives play/pause/scrub/speed
        │
        ├──────────────────────┐
        ▼                      ▼
Visualization registry   Explanation engine
(algorithm → renderer)   (event → plain text)
        │                      ▼
        ▼                Explanation panel  ← terminal output
Animation engine
(event → motion recipe: bounce, scale,
 highlight, duration, easing)
        ▼
Renderer
(scene graph + layout engine + camera + theme)
```

The **Visualization Registry** is what prevents a giant if/else per algorithm: each entry says "DFS uses Graph renderer + Call Stack panel + Variables panel", "Valid Parentheses uses Stack renderer + Variables panel", "Sliding Window Maximum uses Deque + Array", etc.

The **Explanation Engine** is decoupled from renderers on purpose — this is what lets "AI-generated explanation for each step" become a later feature (swap the provider) instead of a rewrite.

---

## 3. Rendering philosophy (contract every plugin must follow)

Every visualized operation has the same three-phase lifecycle:

```
Before  →  Transition  →  After
```

Example — heap swap: **Before** (7 above 10) → **Transition** (nodes move, swap, bounce, glow) → **After** (10 above 7). Every renderer implements this lifecycle the same way, driven by the Animation Engine's recipe for that event type. This keeps every renderer visually consistent instead of each one inventing its own animation style.

---

## 4. Extensibility: adopt the interface now, defer the implementation

**Visualization Plugin contract** (define now, in Phase 0):
```ts
interface VisualizationPlugin {
  name: string;
  supportedEvents: EventType[];
  renderer: React.ComponentType<SceneProps>;
  controls?: React.ComponentType;
  legend?: LegendConfig;
  animationPresets?: Record<EventType, AnimationRecipe>;
}
```
Writing every renderer *as* a plugin against this contract from day one costs nothing extra and means every future addition slots into an existing registry instead of requiring a refactor.

**Scene Graph per renderer** (defer body, keep shape in mind): build it concretely for whichever renderer needs it first, then extract the shared shape once 2-3 renderers want the same thing.

**Layout Engine**: separate layout math from rendering. Not needed for linear structures (array/string/stack/queue/deque have no layout problem — it's a row of cells). Becomes relevant starting with Linked List (Phase 2) and definitely by Trees/Graphs (Phase 3).

**Camera system** (pan/zoom/focus): genuinely useful once you have graphs with 50+ nodes. Defer to whichever phase first needs it.

**Themes**: adopt immediately — cheap. Renderers read colors from a theme token set (dark/light/high-contrast), never hardcode.

---

## 5. Structure families (avoids one bespoke renderer per structure)

Grouping structures by *what kind of scene they need* keeps the renderer count small even as topic coverage grows:

**Sequence family** — a row of cells, only the entry/exit rules differ:
- **Array**: read/write/swap anywhere by index
- **String**: same as array, but cells hold characters; adds compare/match highlighting for two-pointer and pattern-matching algorithms (KMP, Z-algorithm)
- **Stack**: push/pop only at one end (top) — same cell row, entry/exit locked to one side
- **Queue**: enqueue at rear, dequeue at front — entry/exit locked to opposite ends
- **Deque**: push/pop at both ends

All five share one `SequenceScene` (`{ cells, activeRange, entryPoint, exitPoint }`) and mostly the same renderer, parameterized by which ends are open. This is the highest-leverage reuse in the whole system — five topics for roughly the cost of one.

**Node-link family** — discrete nodes connected by explicit pointers/edges, needing real layout:
- **Linked list**: nodes in a line, next-pointer arrows (singly) or next+prev (doubly)
- **Tree / Binary tree / BST / AVL / Trie**: nodes with parent-child edges, hierarchical layout
- **Graph**: nodes with arbitrary edges, force-directed layout

Linked list is deliberately sequenced right after the sequence family (Phase 2) because it's the *simplest* member of the node-link family — building its `NodeLinkScene` and layout logic there means Trees and Graphs in Phase 3 extend an already-proven scene type instead of inventing one from scratch.

**Table family** — a 2D grid of cells with dependency arrows between them: DP tables, sparse tables, Fenwick/segment tree's underlying array view.

---

## 6. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | You already know this well |
| State | Zustand | Simple store for the step-player |
| Animation | Framer Motion | Declarative transitions driven by discrete events |
| Graph/tree layout | D3 (force-directed + hierarchy) | Mature, flexible layout math |
| Code editor | Monaco | Same editor VS Code uses |
| Styling | Tailwind + theme tokens | Fast to iterate, dark/light/high-contrast for free |
| Backend orchestrator | Node.js + Fastify | Thin API layer, orchestrates Docker |
| Sandboxing | Docker (via `dockerode`) | One ephemeral container per run, per language |
| Shared schema | TypeScript package (`trace-schema`) | Single source of truth for event shapes |
| Hosting | Frontend → Vercel. Backend → Fly.io or a small VPS | Docker-in-Docker needs a real VM |
| Auth (few friends) | Shared invite link/password | No need for a full user system yet |

---

## 7. Monorepo layout

```
dsa-visualizer/
  apps/
    web/                  # React frontend
    server/               # Node orchestrator API (POST /run)
  packages/
    trace-schema/         # TS types + zod validators — the contract
    tracer-go/            # Go tracer SDK
    tracer-java/          # Java tracer SDK
    tracer-cpp/           # C++ tracer SDK (header-only)
  docker/
    go.Dockerfile
    java.Dockerfile
    cpp.Dockerfile
  infra/
    fly.toml
```

---

## 8. Trace event schema (`packages/trace-schema`)

```ts
interface TraceEvent {
  step: number;
  type: EventType;
  payload: Record<string, unknown>;
  codeLine?: number;   // drives "current line" highlight
  callDepth?: number;  // drives recursion/call-stack indentation
}

type EventType =
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

Each language's tracer SDK writes one JSON line per event to stdout, prefixed with a sentinel (`@TRACE@{...}`) so user debug output is never confused with trace data.

---

## 9. Tracer SDK: higher-level constructors

```
// Sequence family
tracer.NewArray(name, n)
tracer.NewString(name, s)
tracer.NewStack(name)
tracer.NewQueue(name)
tracer.NewDeque(name)

// Node-link family
tracer.NewLinkedList(name)
tracer.NewTree(name)
tracer.NewGraph(name)
tracer.NewTrie(name)

// Table family
tracer.NewDPTable(name, rows, cols)
tracer.NewSegmentTree(name, n)
tracer.NewFenwick(name, n)
tracer.NewSparseTable(name, n)
tracer.NewHeap(name)
```

**Recursion is auto-instrumented for free** via each language's native scope-exit mechanism, so the user never calls anything manually for call-stack visualization:
- Go: `defer tracer.Return(&result)`
- Java: `try { ... } finally { tracer.pop(); }`
- C++: RAII — a `CallGuard` destructor fires on any return path

---

## 10. Execution service (`apps/server`)

```
POST /run { language, code, input }
  → write code+input to temp dir
  → spin ephemeral Docker container (dockerode):
      --network none --memory 256m --cpus 0.5
      --pids-limit 128 --read-only, non-root user
      wall-clock timeout 5-10s
  → capture stdout, filter lines starting with @TRACE@
  → parse + validate each line against the trace-schema
  → respond: { events: TraceEvent[], stdout, error? }
```

Container isolation (no network, resource caps, non-root, timeout) is the real defense — never relax these even for trusted friends.

---

## 11. Frontend structure (`apps/web`)

```
src/
  editor/          Monaco wrapper, language picker, input panel
  player/          Zustand store: events[], currentStep, isPlaying, speed
  registry/        Algorithm Registry + Visualization Plugin registry
  animation/       Animation Engine (event type → motion recipe)
  renderers/
    SequenceView.tsx    # array, string, stack, queue, deque — parameterized
    NodeLinkView.tsx    # linked list, tree, graph, trie — parameterized
    TableView.tsx       # DP table, sparse table, fenwick
    CallStackView.tsx
    HeapView.tsx
  explanation/     Explanation Engine + panel
  panels/          variables, console output, complexity notes
  theme/           design tokens: dark / light / high-contrast
  api/             client for POST /run
```

---

## 12. Non-functional requirements

- Support traces with **at least 50,000 events** while maintaining smooth playback (target 60fps scrubbing).
- Achieve this via **periodic snapshots** (e.g. every 100 events) + incremental replay from the nearest snapshot, rather than replaying from event 0 on every scrub.
- Container execution wall-clock timeout: 5-10s per run.
- Container memory cap: 256MB; no network access; non-root; read-only filesystem except scratch/tmpfs.

---

## 13. Phased roadmap

| Phase | Deliverable |
|---|---|
| 0 | Scaffolding + Go tracer SDK for arrays + `SequenceScene`/`SequenceView` as a Visualization Plugin — validates the entire pipeline end to end, including the plugin contract |
| 1 | Java + C++ parity for Array, plus Stack, Queue, Deque, String — all reuse `SequenceScene`, low incremental cost |
| 2 | Linked list (introduces `NodeLinkScene` + Layout Engine) + recursion/call-stack view |
| 3 | Trees + graphs (extend `NodeLinkScene` from Phase 2) |
| 4 | DP table view (`TableScene`) |
| 5 | Advanced: segment tree, sparse table, Mo's algorithm, tries, heap; Camera system if graphs get large |
| 6 | Sharing/saving sessions, real auth, AI-generated explanations (swap Explanation Provider) |
