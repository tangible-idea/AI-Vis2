/**
 * Instant navigation feedback for all app pages: a dimmed skeleton renders
 * the moment a link is clicked, while the server component streams in.
 */
export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-4 opacity-60" aria-busy="true" aria-live="polite">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-6 w-44 rounded-lg bg-hover" />
          <div className="h-3.5 w-72 rounded bg-hover" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-hover" />
      </div>
      <div className="h-36 rounded-xl border border-line bg-surface p-5">
        <div className="h-3 w-32 rounded bg-hover" />
        <div className="mt-3 h-8 w-24 rounded bg-hover" />
        <div className="mt-3 flex gap-2">
          <div className="h-6 w-20 rounded-full bg-hover" />
          <div className="h-6 w-20 rounded-full bg-hover" />
          <div className="h-6 w-20 rounded-full bg-hover" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-xl border border-line bg-surface p-4">
            <div className="h-3 w-24 rounded bg-hover" />
            <div className="mt-4 h-9 w-16 rounded bg-hover" />
          </div>
        ))}
      </div>
      <div className="h-52 rounded-xl border border-line bg-surface" />
    </div>
  );
}
