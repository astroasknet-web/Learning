/** Shown while the catalogue page is being prepared on a client-side navigation. Same shape as the page, so nothing jumps when the real content arrives. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8" role="status" aria-label="Loading courses">
      <div className="h-72 animate-pulse rounded-3xl bg-cream-3 motion-reduce:animate-none" />
      <div className="mt-6 h-11 w-2/3 rounded-full bg-cream-3" />
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <li key={i} className="h-72 animate-pulse rounded-2xl bg-cream-3 motion-reduce:animate-none" />)}
      </ul>
      <span className="sr-only">Loading courses…</span>
    </div>
  );
}
