/** Placeholder with the dashboard's footprint while the conference list loads. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5 p-8" role="status" aria-label="Loading conferences">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl border border-line bg-white" />
        ))}
      </div>
      <div className="h-10 w-72 animate-pulse rounded-xl bg-muted" />
      <div className="h-72 animate-pulse rounded-2xl border border-line bg-white" />
    </div>
  );
}
