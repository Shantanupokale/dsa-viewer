# docker/ — sandbox language images (Phase 0+)

One image per language, each with its tracer SDK pre-vendored (compilation runs with
`--network none`, so no fetching at build/run time).

| File | Base | Compile | Run |
|---|---|---|---|
| `go.Dockerfile` | `golang:1.22-alpine` | `go build -o /tmp/prog main.go` | `/tmp/prog < input.txt` |
| `java.Dockerfile` | `eclipse-temurin:21-jdk-alpine` | `javac Main.java` | `java Main < input.txt` |
| `cpp.Dockerfile` | `gcc:13-alpine` | `g++ -O2 -o /tmp/prog main.cpp` | `/tmp/prog < input.txt` |

Runtime container flags live in the server, not here — see `apps/server/README.md`.
`go.Dockerfile` is the Phase-0 deliverable.
