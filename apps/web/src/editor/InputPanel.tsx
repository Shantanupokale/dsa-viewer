interface Props {
  value: string;
  onChange: (value: string) => void;
}

/** Raw stdin passed to the program. */
export function InputPanel({ value, onChange }: Props) {
  return (
    <div className="flex flex-col">
      <label className="px-1 py-1 text-xs text-slate-500">stdin</label>
      <textarea
        className="w-full resize-none rounded-lg border border-slate-800 bg-slate-950 p-2 font-mono text-sm text-slate-200 focus:border-sky-600 focus:outline-none"
        rows={2}
        placeholder="e.g. 8 3 5 1 9 2 7   (empty uses the example's default)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
