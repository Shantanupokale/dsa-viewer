import { usePlayer } from "./playerStore";

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

/** Play/pause, single-step, speed, and a scrubber over the whole trace (PRD §9.2). */
export function PlayerControls() {
  const { events, currentStep, isPlaying, speed, toggle, stepForward, stepBackward, seekTo, setSpeed } = usePlayer();
  const total = events.length;
  const disabled = total === 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3">
      <div className="flex items-center gap-2">
        <button className="btn" onClick={stepBackward} disabled={disabled} title="Step back">
          ⏮
        </button>
        <button className="btn btn-primary" onClick={toggle} disabled={disabled} title="Play / pause">
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>
        <button className="btn" onClick={stepForward} disabled={disabled} title="Step forward">
          ⏭
        </button>

        <span className="ml-2 font-mono text-xs text-slate-400">
          {currentStep + 1} / {total}
        </span>

        <label className="ml-auto flex items-center gap-1 text-xs text-slate-400">
          speed
          <select
            className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-slate-200"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>

      <input
        type="range"
        className="w-full accent-sky-500"
        min={-1}
        max={Math.max(0, total - 1)}
        value={currentStep}
        disabled={disabled}
        onChange={(e) => seekTo(Number(e.target.value))}
      />
    </div>
  );
}
