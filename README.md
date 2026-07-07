# DSA Visualizer

Paste a Go solution written against a small tracer SDK, run it in a sandbox, and watch
its data structures animate step by step. (Phase 0: Go arrays.)

The app has **two parts that must both be running**:

| Part | Command | URL | What it is |
|------|---------|-----|------------|
| **Frontend** | `npm run dev -w @dsa/web` | http://localhost:5173 | The web page you open |
| **Backend (API)** | `npm start -w @dsa/server` | http://localhost:8080 | JSON API — **not** a web page |

> Open **http://localhost:5173** in your browser — that's the app.
> Do **not** open `:8080` in the browser; it's the API and will show 404 / "refused".

---

## Prerequisites

- **Node.js 20+** — check with `node -v`
- **Docker Desktop, running** — check with `docker ps` (should not error)
- All commands run from the repo root: `/Users/shantanupokale/Desktop/Shantanu/dsa-viewer`

---

## One-time setup

Run these once (or after pulling changes / editing the tracer or Dockerfile):

```bash
# 1. Install dependencies for every package
npm install

# 2. Build the Go sandbox image (Docker must be running)
docker build -f docker/go.Dockerfile -t dsa-run-go:0.1.0 .

# 3. Build the packages the apps import
npm run build -w @dsa/trace-schema -w @dsa/server

# 4. Create the server's secrets file (auto-loaded from apps/server/.env)
cp apps/server/.env.example apps/server/.env
node -e "console.log('COOKIE_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> apps/server/.env
```

Then open `apps/server/.env` and set `APP_ACCESS_PASSWORD` to a password you choose
(this is the login password for the app). `.env` is gitignored — it never gets committed.

---

## Start it (every time)

Use **two terminals**, both from the repo root. Each command starts a server that must
**stay running** — don't close the terminal.

**Terminal 1 — API:**
```bash
npm start -w @dsa/server
```
Wait until you see: `Server listening at http://127.0.0.1:8080`

**Terminal 2 — Frontend:**
```bash
npm run dev -w @dsa/web
```
Wait until you see: `Local: http://127.0.0.1:5173/`

Now open **http://localhost:5173**, enter your password, pick **Bubble sort**, and click
**▶ Visualize** — then **▶ Play** or drag the slider to scrub through the animation.

To stop: press `Ctrl+C` in each terminal.

---

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| Browser: **"refused to connect" / ERR_CONNECTION_REFUSED** | You opened the wrong port or the server isn't running. Open **http://localhost:5173** (not `:8080`), and make sure both terminals are still running. |
| `:8080` shows **404 / blank JSON** | Expected — `:8080` is the API, not a page. Use `:5173`. |
| API exits immediately with **"Invalid environment configuration"** | `apps/server/.env` is missing or `COOKIE_SECRET` is too short. Re-run setup step 4. |
| **"port already in use" / EADDRINUSE** | A previous server is still running. Kill it: `pkill -f "dist/index.js"` (API) or `pkill -f vite` (frontend), then start again. |
| `docker: Cannot connect to the Docker daemon` | Docker Desktop isn't running. Start it, wait for it to be ready, retry. |
| Visualize shows **"Compilation failed"** | Your Go code has a syntax error — the compiler message is shown in the panel. |
| Login rejected | Password must match `APP_ACCESS_PASSWORD` in `apps/server/.env`. |
| Browser console: **blocked by CORS policy** on `/api/login` | You opened the app via a different hostname than the server allows. Use **http://localhost:5173**, and if your `.env` has a `CORS_ORIGIN` line, delete it (the default allows both `localhost` and `127.0.0.1`). Restart the backend after changing `.env`. |

---

## Handy commands

```bash
npm test                       # run all tests
npm run typecheck              # typecheck everything
npm test -w @dsa/trace-schema  # test just one package
npm audit                      # should report 0 vulnerabilities
```

---

## Project docs

- **`CLAUDE.md`** — architecture, contracts, security rules, roadmap (start here to understand the code)
- **`PRD.md`** — full product requirements
- **`ARCHITECTURE.md`** — architecture blueprint
