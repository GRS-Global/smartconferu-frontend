import type { Completeness } from "../completeness";

/** The profile-completeness bar with what is still required. */
export function CompletenessMeter({ completeness }: { completeness: Completeness }) {
  const { percent, missingRequired } = completeness;
  return (
    <div className="rounded-lg border border-line bg-canvas p-4">
      <div className="mb-2 flex items-center justify-between">
        <span id="completeness-label" className="text-xs font-semibold text-ink-soft">Profile completeness</span>
        <span className={`text-xs font-bold ${percent === 100 ? "text-success-ink" : "text-navy"}`}>{percent}%</span>
      </div>
      <div role="progressbar" aria-labelledby="completeness-label" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-muted">
        <div style={{ width: `${percent}%` }} className={`h-full rounded-full transition-all ${percent === 100 ? "bg-success" : "bg-primary"}`} />
      </div>
      <p className="mt-2 text-[11px] text-ink-muted">
        {missingRequired.length ? `Still required: ${missingRequired.map((f) => f.label).join(", ")}` : "All required details are in — the optional ones raise your score further."}
      </p>
    </div>
  );
}
