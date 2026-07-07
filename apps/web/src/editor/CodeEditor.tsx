interface Props {
  value: string;
  onChange: (value: string) => void;
  language: string;
}

const EXT: Record<string, string> = { go: "go", java: "java", cpp: "cpp" };

/**
 * Phase-0 code editor: a styled monospace textarea. Monaco (with codeLine highlighting)
 * is deferred until the tracer emits codeLine — no point in the heavy dependency yet.
 */
export function CodeEditor({ value, onChange, language }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-2 py-1 text-xs text-slate-500">
        main.{EXT[language] ?? "txt"} — {language.toUpperCase()}
      </div>
      <textarea
        className="flex-1 w-full resize-none rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-slate-200 focus:border-sky-600 focus:outline-none"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
