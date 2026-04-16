// Gray shimmer skeleton matching the profile page layout.

function Shimmer({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded bg-bc-light-lavender ${className}`} />
  );
}

export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-bc-light-lavender/30">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Profile header card */}
        <div className="rounded-lg border border-bc-light-lavender bg-white p-4 sm:p-6 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <Shimmer className="h-6 w-40" />
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-3 w-32" />
            </div>
          </div>
        </div>

        {/* Current Witness terms */}
        <div className="rounded-lg border border-bc-light-lavender bg-white p-4 mb-4">
          <Shimmer className="h-4 w-36 mb-3" />
          <div className="flex flex-col gap-2">
            <Shimmer className="h-10 w-full rounded" />
            <Shimmer className="h-10 w-full rounded" />
          </div>
        </div>

        {/* Recent posts */}
        <div className="rounded-lg border border-bc-light-lavender bg-white p-4">
          <Shimmer className="h-4 w-28 mb-3" />
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="py-2 border-b border-bc-light-lavender/40 last:border-b-0 flex flex-col gap-1.5"
              >
                <Shimmer className="h-3.5 w-3/4" />
                <Shimmer className="h-3 w-full" />
                <Shimmer className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
