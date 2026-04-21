export default function PreparingLoading() {
  return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-10">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="h-8 bg-surface-container animate-pulse rounded-lg w-3/4 mx-auto" />
          <div className="h-4 bg-surface-container animate-pulse rounded w-1/2 mx-auto" />
        </div>
        <div className="h-2 bg-surface-container animate-pulse rounded-full" />
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-surface-container animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
