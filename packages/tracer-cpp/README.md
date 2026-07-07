# packages/tracer-cpp — C++ tracer SDK (Phase 1), header-only

Same conceptual API, C++ idiom: `Tracer::Array a("a", {...});`,
`Tracer::CallGuard _g("solve", {{"i", i}});` (RAII destructor emits `call_return`
on any exit path). Emits identical `@TRACE@` lines per `@dsa/trace-schema`.

Vendored into `docker/cpp.Dockerfile`. Built in Phase 1.
