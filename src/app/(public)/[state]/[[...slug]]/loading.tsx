// Gray shimmer skeleton matching the office/district page layout.
// Shown by Next.js while the async page component is fetching data.

function Shimmer({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded bg-bc-light-lavender ${className}`} />
  );
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-bc-light-lavender bg-white p-4 flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer
          key={i}
          className={i === 0 ? "h-4 w-2/3" : i === rows - 1 ? "h-3 w-1/3" : "h-3 w-full"}
        />
      ))}
    </div>
  );
}

function PostRowSkeleton() {
  return (
    <div className="rounded-lg border border-bc-light-lavender bg-white p-4 flex flex-col gap-2">
      <Shimmer className="h-4 w-3/4" />
      <Shimmer className="h-3 w-full" />
      <Shimmer className="h-3 w-5/6" />
      <div className="flex gap-2 mt-1">
        <Shimmer className="h-5 w-16 rounded-full" />
        <Shimmer className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export default function SlugLoading() {
  return (
    <div className="min-h-screen bg-bc-light-lavender/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Shimmer className="h-3 w-16" />
          <Shimmer className="h-3 w-2" />
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-3 w-2" />
          <Shimmer className="h-3 w-32" />
        </div>

        {/* Page title */}
        <div className="mb-6 flex flex-col gap-2">
          <Shimmer className="h-8 w-2/3" />
          <Shimmer className="h-4 w-1/2" />
          <Shimmer className="h-8 w-24 rounded mt-1" />
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main column */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <CardSkeleton rows={4} />
            <CardSkeleton rows={3} />
            <PostRowSkeleton />
            <PostRowSkeleton />
            <PostRowSkeleton />
          </div>

          {/* Sidebar */}
          <div className="lg:w-64 flex flex-col gap-4">
            <CardSkeleton rows={5} />
            <CardSkeleton rows={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
