# packages/tracer-go — Go tracer SDK (Phase 0)

Drop-in traced data-structure types. Each mutating method emits one `@TRACE@`+JSON
line to stdout matching `@dsa/trace-schema`. User writes normal LeetCode Go, just
constructs structures via `tracer.NewArray("a", []int{...})` etc.

**Phase 0**: `Array` only (`Get`/`Set`/`Swap`/`Len`). Phase 1+: Stack/Queue/Deque/String.
Phase 2: LinkedList + recursion auto-instrumentation (`tracer.Call`/scope-exit).

Vendored into `docker/go.Dockerfile` so compilation needs no network (`--network none`).
