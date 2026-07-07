# packages/tracer-java — Java tracer SDK (Phase 1)

Same conceptual API as `tracer-go`, Java idiom: `new TracedArray("a", ...)`,
`try (var scope = tracer.call("solve", Map.of("i", i))) { ... }` (AutoCloseable →
`call_return` on close). Emits identical `@TRACE@` lines per `@dsa/trace-schema`.

Vendored into `docker/java.Dockerfile`. Built in Phase 1 (Array parity + Stack/Queue/Deque/String).
