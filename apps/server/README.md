# apps/server — Node orchestrator API (not yet built)

Fastify. `POST /api/run { language, code, input }` → spins one ephemeral Docker
container per run (via `dockerode`), captures stdout, runs the Timeline Recorder
(parse `@TRACE@` lines through `@dsa/trace-schema`, snapshot every 100 events),
returns `{ status, events, stdout, durationMs }`.

**Sandbox invariants are non-negotiable** (PRD §8.2): `--network none`, `--memory 256m`,
`--cpus 0.5`, `--pids-limit 128`, `--read-only` + tmpfs, non-root, 10s wall-clock kill, `--rm`.

**First built in Phase 0** (Go image only). See `../../CLAUDE.md`.
