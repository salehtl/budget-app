export function ReviewBanner({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-warning/10 border border-warning/20 rounded-xl text-sm">
      <span className="w-2 h-2 rounded-full bg-warning animate-pulse shrink-0" />
      <span className="text-text">
        <strong>{count}</strong> recurring {count === 1 ? "item needs" : "items need"} updated amounts
      </span>
    </div>
  );
}
