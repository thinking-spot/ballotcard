// Gray shimmer skeleton matching the ballot page layout.

function Shimmer({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded bg-bc-light-lavender ${className}`} />
  );
}

function LayerSkeleton({ rows }: { rows: number }) {
  return (
    <div className="rounded-lg border border-bc-light-lavender bg-white">
      {/* Layer header */}
      <div className="px-4 py-3 border-b border-bc-light-lavender/60">
        <div className="flex items-center gap-3">
          <Shimmer className="h-4 w-36" />
          <Shimmer className="h-3 w-20" />
        </div>
      </div>
      {/* Office rows */}
      <div className="px-4 divide-y divide-bc-light-lavender/40">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="py-2.5 flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <Shimmer className="h-3.5 w-2/3" />
              <Shimmer className="h-3 w-1/3" />
            </div>
            <Shimmer className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BallotLoading() {
  return (
    <div className="min-h-screen bg-bc-light-lavender/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <Shimmer className="h-7 w-32" />
          <Shimmer className="h-8 w-28 rounded" />
        </div>

        {/* Election alert placeholder */}
        <div className="mb-4 rounded-lg border border-bc-light-lavender bg-white p-4">
          <Shimmer className="h-4 w-2/3 mb-2" />
          <Shimmer className="h-3 w-1/2" />
        </div>

        {/* Layer cards */}
        <div className="flex flex-col gap-4">
          <LayerSkeleton rows={4} />
          <LayerSkeleton rows={6} />
          <LayerSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
