import { useEffect, useState, type ComponentType } from "react";
import { recipeFor } from "./animation/animationEngine";
import { autotrace, hasSession, runCode, type RunResult } from "./api/runClient";
import { LoginGate } from "./auth/LoginGate";
import { CodeEditor } from "./editor/CodeEditor";
import { InputPanel } from "./editor/InputPanel";
import { PlayerControls } from "./player/PlayerControls";
import { usePlayer } from "./player/playerStore";
import type { SceneProps } from "./plugins/types";
import { CallStackPanel } from "./panels/CallStackPanel";
import { VariablesPanel } from "./panels/VariablesPanel";
import { algorithms, getAlgorithm, type Language } from "./registry/algorithms";
import { getPlugin, pluginForEvents } from "./registry/plugins";

const LANGUAGES: Array<{ id: Language; label: string }> = [
  { id: "go", label: "Go" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
];

export default function App() {
  // null = still probing the existing session; avoids a login-screen flash on reload.
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    void hasSession().then((ok) => setAuthed(ok));
  }, []);

  if (authed === null) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-500">Loading…</div>;
  }
  if (!authed) return <LoginGate onAuthed={() => setAuthed(true)} />;
  return <Studio onUnauth={() => setAuthed(false)} />;
}

function Studio({ onUnauth }: { onUnauth: () => void }) {
  const [language, setLanguage] = useState<Language>("go");
  const [algoId, setAlgoId] = useState(algorithms[0]!.id);
  const algo = getAlgorithm(algoId)!;
  const [code, setCode] = useState(algo.defaultCode);
  const [input, setInput] = useState("");
  const [instrument, setInstrument] = useState(algo.instrument ?? false);
  const [running, setRunning] = useState(false);
  const [tracing, setTracing] = useState(false);
  const [concept, setConcept] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  const examples = algorithms.filter((a) => a.language === language);

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
    setInstrument(next.instrument ?? false);
    setResult(null);
    reset();
  }

  function selectLanguage(lang: Language) {
    setLanguage(lang);
    const first = algorithms.find((a) => a.language === lang);
    if (first) selectAlgo(first.id);
  }

  async function visualize() {
    setRunning(true);
    setResult(null);
    reset();
    const res = await runCode({ language, code, input, instrument });
    setResult(res);
    setRunning(false);
    if (res.status === "error" && res.error === "unauthorized") {
      onUnauth();
      return;
    }
    if (res.status === "success" && res.events && res.events.length > 0) {
      // Pick the renderer from the events themselves so pasted / AI-rewritten code
      // animates correctly regardless of which example is selected.
      const p = pluginForEvents(res.events) ?? getPlugin(algo.primaryPlugin);
      if (p) load(res.events, p);
    }
  }

  async function aiTrace() {
    setTracing(true);
    setAiError(null);
    setConcept(null);
    const res = await autotrace(language, code);
    setTracing(false);
    if (res.status === "ok" && res.code) {
      setCode(res.code); // review before running — nothing executes yet
      setConcept(res.concept ?? null);
      setInstrument(false); // already instrumented
    } else {
      if (res.error === "unauthorized") return onUnauth();
      setAiError(res.error ?? "AI auto-trace failed.");
    }
  }

  const currentEvent = currentStep >= 0 ? events[currentStep] : undefined;
  const recipe = recipeFor(plugin, currentEvent?.type ?? null);
  const state = materialize(currentStep);
  const Renderer = plugin?.renderer as ComponentType<SceneProps<unknown>> | undefined;
  const hasCalls = events.some((e) => e.type === "call_push");

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-200">
      <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <h1 className="text-base font-semibold text-slate-100">DSA Visualizer</h1>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Phase 0 · Go arrays</span>
        <div className="ml-auto flex overflow-hidden rounded-md border border-slate-700">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => selectLanguage(l.id)}
              className={`px-3 py-1 text-sm transition-colors ${
                language === l.id ? "bg-sky-600 text-white" : "bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <select
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          value={algoId}
          onChange={(e) => selectAlgo(e.target.value)}
        >
          {examples.map((a) => (
            <option key={a.id} value={a.id}>
              {/* language suffix is redundant next to the picker */}
              {a.displayName.replace(/\s*\((Go|Java|C\+\+)\)$/, "")}
            </option>
          ))}
        </select>
        {language === "go" && (
          <button className="btn" onClick={aiTrace} disabled={tracing || running} title="Rewrite raw code with tracer calls using AI">
            {tracing ? "Tracing…" : "✨ AI auto-trace"}
          </button>
        )}
        <button className="btn btn-primary" onClick={visualize} disabled={running || tracing}>
          {running ? "Running…" : "▶ Visualize"}
        </button>
      </header>
      {concept && (
        <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-1.5 text-xs text-emerald-300">
          Detected: <span className="font-semibold">{concept}</span> — review the rewritten code, then hit Visualize.
        </div>
      )}
      {aiError && (
        <div className="border-b border-slate-800 bg-red-950/40 px-4 py-1.5 text-xs text-red-300">{aiError}</div>
      )}

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        {/* Left: editor + input */}
        <section className="flex min-h-[70vh] flex-col gap-3">
          <div className="flex-1">
            <CodeEditor value={code} onChange={setCode} language={language} />
          </div>
          {language === "go" && (
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                className="accent-sky-500"
                checked={instrument}
                onChange={(e) => setInstrument(e.target.checked)}
              />
              Auto-instrument raw Go (rewrites plain []int usage into traced calls — no tracer code needed)
            </label>
          )}
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
          {hasCalls && <CallStackPanel />}
          {result?.status === "success" && (result.events?.length ?? 0) === 0 && (
            <div className="rounded-lg border border-amber-900 bg-amber-950/40 p-3 text-sm">
              <div className="font-semibold text-amber-300">Ran fine — but nothing to animate</div>
              <p className="mt-1 text-xs text-amber-200/90">
                The program produced no trace events. To visualize it, either declare structures with the tracer
                types (<code>tracer.NewArray</code>, <code>tracer.NewStack</code>, <code>tracer.NewQueue</code>, …), or —
                for plain <code>[]int</code> array code — tick “Auto-instrument raw Go”. Custom types and code using{" "}
                <code>append</code>/slicing can’t be auto-traced yet.
              </p>
            </div>
          )}
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
          {result?.instrumentedCode && (
            <details className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <summary className="cursor-pointer text-xs uppercase tracking-wide text-slate-500">
                Instrumented code (what actually ran)
              </summary>
              <pre className="mt-2 overflow-x-auto text-xs text-slate-300">{result.instrumentedCode}</pre>
            </details>
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
