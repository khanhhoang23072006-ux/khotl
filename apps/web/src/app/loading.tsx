export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8" aria-busy="true">
      <div className="skeleton h-10 w-2/3" />
      <div className="mt-6 grid gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="skeleton h-24 border-2 border-grid" />
        ))}
      </div>
    </div>
  );
}
