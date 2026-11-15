// Loading state for signed-in pages: a skeleton shaped like the cards that will appear.
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <div className="h-10 w-2/3 max-w-md animate-pulse rounded-full bg-ink/10" />
      <div className="h-40 animate-pulse rounded-card bg-card" />
      <div className="h-40 animate-pulse rounded-card bg-card" />
    </div>
  );
}
