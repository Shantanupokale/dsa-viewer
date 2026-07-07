# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Project: DSA Code Visualizer.** Read `PRD.md` and `ARCHITECTURE.md` for the full spec;
this file is the working summary + house rules.

## What this is

A web app where a user pastes a LeetCode-style solution (Go / Java / C++) written
against a small **tracer SDK** instead of raw primitives for its key data structures.
The backend compiles and runs the code in a **sandboxed Docker container**, captures a
structured event stream, and the frontend **replays it as a scrubbable animation** —
showing how the algorithm's data structures evolve step by step, alongside the current
source line, call stack, variables, and a plain-English explanation.

Users do **not** submit arbitrary un-instrumented code. Every visualized structure goes
through the tracer SDK. That constraint is what makes the whole thing tractable and safe.

## The pipeline (the load-bearing idea)

A layered pipeline. **Everything past the Timeline Recorder is language-independent** —
Go/Java/C++ all funnel into one identical `TraceEvent[]` stream, so there is no
language-specific UI code.

```
tracer SDK (runs in-process inside the sandbox)
  → Docker sandbox → stdout, one @TRACE@<json> line per event
  → Timeline Recorder   (parse + validate each line via @dsa/trace-schema; drop invalid;
                         snapshot all structures every 100 events)
  → Replay Engine       (Zustand: currentStep, play/pause/scrub/speed; seek from nearest snapshot)
  → Visualization Registry (algorithm id → which plugin + panels)
  → Animation Engine    (event type → before/transition/after motion recipe)
  → Renderer            (SequenceScene / NodeLinkScene / TableScene)
  ‖ Explanation Engine  (event → text; rule-based now, LLM-swappable later — DEFERRED)
```

## Five ideas that must not be violated

1. **`@dsa/trace-schema` is the one contract.** TS types + zod validators for every
   `TraceEvent`. Build/change it first; everything depends on it. Adding a new `EventType`
   touches only: this schema, the relevant tracer SDK, and the relevant plugin — never the
   Recorder, Replay Engine, or Execution Service (PRD NFR5).
2. **Three renderer *families*, not one-per-structure.** Sequence (array/string/stack/
   queue/deque), NodeLink (linked list/tree/graph/trie), Table (DP/segtree/fenwick). Group
   by *what kind of scene* a structure needs.
3. **Everything renders as a Visualization Plugin** against one contract, from day one.
   New structure = new plugin; never edit an existing plugin or the pipeline.
4. **The Algorithm Registry is data, not code.** Adding an algorithm = one array-literal
   entry, zero renderer changes.
5. **Sandbox isolation is the security boundary — never relax it** (see below).

## Security invariants (non-negotiable)

- **Untrusted input** = the stdout of user code running in the sandbox. The Timeline
  Recorder MUST validate every line through `parseTraceLine`/`TraceEventSchema` and
  **log-and-drop** anything invalid. Never feed a raw line into the replay pipeline.
- **Docker container per run** (PRD §8.2): `--network none`, `--memory 256m
  --memory-swap 256m`, `--cpus 0.5`, `--pids-limit 128`, `--read-only` + tmpfs scratch,
  **non-root** user, **10s wall-clock kill** enforced by the orchestrator (not a
  language-level timeout), `--rm` (no persistence between runs). These do not get relaxed
  "for trusted friends".
- **Rate-limit `/api/run`** per IP (≈20/min) to stop runaway container spawning.
- **Auth**: single shared password (`APP_ACCESS_PASSWORD` env var) → HttpOnly cookie.
  No per-user accounts this phase.
- **No secrets in source or client bundles.** Load from env. `.env*` is gitignored;
  commit `.env.example` only.
- Language images vendor their tracer SDK so compilation works with `--network none`.

## Monorepo layout (npm workspaces)

```
dsa-visualizer/
  apps/
    web/            ✅ React frontend — editor, player, SequenceScene (arrays)
    server/         ✅ Fastify orchestrator, POST /api/run + /api/login
  packages/
    trace-schema/   ✅ TS types + zod validators (the contract)
    tracer-go/      ✅ Go tracer SDK — Array (Phase 0)
    tracer-java/    Java tracer SDK (Phase 1)                  — placeholder
    tracer-cpp/     C++ header-only tracer SDK (Phase 1)       — placeholder
  docker/           ✅ go.Dockerfile (java/cpp: Phase 1)
  infra/            fly.toml etc. (later)                      — placeholder
  PRD.md            product requirements (authoritative)
  ARCHITECTURE.md   architecture blueprint (read first)
```

Phase-0 notes worth knowing:
- **Editor is a plain textarea, not Monaco** — Monaco's value is highlighting `codeLine`,
  which the tracer doesn't emit yet. Deferred (it also dragged a DOMPurify CVE chain).
- **The Go image bakes a warm build cache** at `/opt/gocache`; the entrypoint seeds tmpfs
  from it so a run compiles in ~0.5s instead of ~15s cold.
- **`uuid` is pinned via a root `overrides`** to clear a dockerode-transitive advisory.
  Keep `npm audit` at 0.

## Commands

Package manager is **npm** (workspaces). Node 20 (`.nvmrc`). One install at the root
covers every workspace. Packages reference each other by name, e.g. `@dsa/trace-schema`.

```bash
npm install                          # install all workspaces (run once at root)

npm run build                        # build every workspace (--if-present)
npm test                             # test every workspace
npm run typecheck                    # typecheck every workspace
npm run lint                         # lint every workspace

# scope to one package with -w:
npm test      -w @dsa/trace-schema
npm run build -w @dsa/trace-schema
npm run typecheck -w @dsa/trace-schema
```

`@dsa/trace-schema` builds with plain `tsc` (no bundler) and tests with `vitest`.
Keep the dependency tree lean and audit-clean (`npm audit` → 0 vulns); prefer dropping a
tool over pulling a heavy transitive chain.

### Run locally (Phase 0)

Requires Docker running.

```bash
# 1. Build the Go sandbox image (once, or after tracer-go / Dockerfile changes)
docker build -f docker/go.Dockerfile -t dsa-run-go:0.1.0 .

# 2. Build the workspace packages the server/web import
npm run build -w @dsa/trace-schema
npm run build -w @dsa/server

# 3. Start the API (needs two secrets in the environment; never hardcode)
APP_ACCESS_PASSWORD='choose-a-password' \
COOKIE_SECRET="$(node -e 'console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))')" \
  npm start -w @dsa/server            # -> http://localhost:8080

# 4. Start the frontend (separate terminal)
npm run dev -w @dsa/web               # -> http://localhost:5173
```

Then open http://localhost:5173, enter the password, pick "Bubble sort", click Visualize.
`apps/server/.env.example` documents all env vars; copy it to `.env` for real use.

## The contract, concretely

```ts
// @dsa/trace-schema
interface TraceEvent {
  step: number;              // 0-indexed, monotonic
  type: EventType;           // discriminates the payload
  structureId: string;       // name from tracer.NewX("name", ...) — many structures per run
  payload: Record<string, unknown>;  // shape depends on `type` (discriminated union)
  codeLine?: number;         // 1-indexed, for editor highlight
  callDepth?: number;        // recursion depth, for call-stack panel
  timestampMs?: number;
}
// TraceEventSchema: zod discriminated union over `type`. Unknown payload keys are
// STRIPPED (forward-compatible). parseTraceLine(rawLine) never throws — returns
// { ok: true, event } | { ok: false, reason, error }.
```

Plugin + registry contracts live in PRD §10. Renderer lifecycle is always
**Before → Transition → After** (PRD §12) — never snap straight to the after-state
(except transitions may shorten, not skip, at max 8x speed).

## Roadmap & current status

| Phase | Deliverable | Status |
|---|---|---|
| — | Monorepo scaffold + `@dsa/trace-schema` (zod union + 100 tests) | ✅ done |
| 0 | Go `Array` tracer + `go.Dockerfile` + server `/api/run` + `SequenceScene` (arrays) + Zustand player — one language, end to end | ✅ done |
| 1 | Java + C++ Array parity; Stack/Queue/Deque/String; extend `SequenceScene` | ⬜ next |
| 2 | LinkedList + `NodeLinkScene` + Layout Engine; recursion auto-instrumentation + CallStackPanel | ⬜ |
| 3 | Trees + Graphs (hierarchical + force-directed layouts) | ⬜ |
| 4 | DP tables (`TableScene`, dependency arrows) | ⬜ |
| 5 | Segment/Fenwick/sparse tree, trie, heap; Camera system if graphs get large | ⬜ |
| 6 | Session sharing; swap Explanation provider for LLM-backed | ⬜ |

**Explanation Engine is deferred** — not in the critical path right now. Keep the
`ExplanationProvider` interface seam so it can slot in later, but don't build it yet.

## Conventions

- TypeScript **strict** everywhere (`tsconfig.base.json`): `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, ESM (`"type": "module"`).
- Pin exact dependency versions (`save-exact=true` in `.npmrc`); commit `package-lock.json`.
- Match surrounding code style; renderers read colors from theme tokens, never hardcode.
- Before writing/modifying code, the `secure-coding-enforcer` skill is mandatory.

## Open questions (flag, don't silently guess — PRD §16)

- Exact ergonomics of the Go call-tracking helper (§7.4) — proposal, not final.
- `structureId` collisions → recommend auto-suffix (`dp`, `dp_2`) + warn.
- Phase 6 sharing → persistent store vs. signed/encoded URL for small traces.
