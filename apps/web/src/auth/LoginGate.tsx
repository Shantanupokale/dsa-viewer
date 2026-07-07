import { useState, type FormEvent } from "react";
import { login } from "../api/runClient";

/** Shared-password gate (PRD §13). On success the server sets an HttpOnly cookie. */
export function LoginGate({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await login(password);
    setBusy(false);
    if (ok) onAuthed();
    else setError("Incorrect password.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <form onSubmit={submit} className="w-80 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="mb-1 text-lg font-semibold text-slate-100">DSA Visualizer</h1>
        <p className="mb-4 text-sm text-slate-400">Enter the shared access password.</p>
        <input
          type="password"
          autoComplete="current-password"
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-sky-600 focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <div className="mb-3 text-sm text-red-400">{error}</div>}
        <button className="btn btn-primary w-full" disabled={busy || !password}>
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
