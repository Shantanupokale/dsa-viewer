import { useState, type ComponentType } from "react";
import { recipeFor } from "./animation/animationEngine";
import { runCode, type RunResult } from "./api/runClient";
import { LoginGate } from "./auth/LoginGate";
import { CodeEditor } from "./editor/CodeEditor";
import { InputPanel } from "./editor/InputPanel";
import { PlayerControls } from "./player/PlayerControls";
import { usePlayer } from "./player/playerStore";
import type { SceneProps } from "./plugins/types";
import { VariablesPanel } from "./panels/VariablesPanel";
import { algorithms, getAlgorithm } from "./registry/algorithms";
import { getPlugin } from "./registry/plugins";

export default function App() {
  const [authed, setAuthed] = useState(false);
  if (!authed) return <LoginGate onAuthed={() => setAuthed(true)} />;
  return <Studio onUnauth={() => setAuthed(false)} />;
}

function Studio({ onUnauth }: { onUnauth: () => void }) {
  const [algoId, setAlgoId] = useState(algorithms[0]!.id);
  const algo = getAlgorithm(algoId)!;
  const [code, setCode] = useState(algo.defaultCode);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const load = usePlayer((s) => s.load);
  const reset = usePlayer((s) => s.reset);
  const plugin = usePlayer((s) => s.plugin);
  const events = usePlayer((s) => s.events);
  const currentStep = usePlayer((s) => s.currentStep);
  const speed = usePlayer((s) => s.speed);
  const materialize = usePlayer((s) => s.materialize);

  function selectAlgo(id: string) {
    const next = getAlgorithm(id);
    if (!next) return;
    setAlgoId(id);
    setCode(next.defaultCode);
    setResult(null);
    reset();
  }

  async function visualize() {
    setRunning(true);
    setResult(null);
    reset();
    const res = await runCode({ language: algo.language, code, input });
    setResult(res);
    setRunning(false);
    if (res.status === "error" && res.error === "unauthorized") {
      onUnauth();
      return;
    }
    if (res.status === "success" && res.events && res.events.length > 0) {
      const p = getPlugin(algo.primaryPlugin);
      if (p) load(res.events, p);
    }
  }

  const currentEvent = currentStep >= 0 ? events[currentStep] : undefined;
  const recipe = recipeFor(plugin, currentEvent?.type ?? null);
  const state = materialize(currentStep);
  const Renderer = plugin?.renderer as ComponentType<SceneProps<unknown>> | undefined;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-200">
      <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <h1 className="text-base font-semibold text-slate-100">DSA Visualizer</h1>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Phase 0 · Go arrays</span>
        <select
          className="ml-auto rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          value={algoId}
          onChange={(e) => selectAlgo(e.target.value)}
        >
          {algorithms.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={visualize} disabled={running}>
          {running ? "Running…" : "▶ Visualize"}
        </button>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        {/* Left: editor + input */}
        <section className="flex min-h-[70vh] flex-col gap-3">
          <div className="flex-1">
            <CodeEditor value={code} onChange={setCode} language={algo.language} />
          </div>
          <InputPanel value={input} onChange={setInput} />
        </section>

        {/* Right: scene + controls + caption + diagnostics */}
        <section className="flex flex-col gap-3">
          <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-slate-800 bg-slate-900 p-6">
            {Renderer ? <Renderer state={state} recipe={recipe} speed={speed} /> : (
              <span className="text-sm text-slate-500">Run a solution to see it animate.</span>
            )}
          </div>
          <PlayerControls />
          <VariablesPanel />
          {result && result.status !== "success" && (
            <div className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm">
              <div className="font-semibold text-red-300">{statusLabel(result.status)}</div>
              {result.error && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-red-200">{result.error}</pre>}
            </div>
          )}
          {result?.stdout && (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">stdout</div>
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-slate-300">{result.stdout}</pre>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function statusLabel(status: RunResult["status"]): string {
  switch (status) {
    case "compilation_failed":
      return "Compilation failed";
    case "runtime_error":
      return "Runtime error";
    case "timeout":
      return "Timed out";
    case "internal_error":
      return "Internal error";
    case "error":
      return "Request error";
    default:
      return status;
  }
}
