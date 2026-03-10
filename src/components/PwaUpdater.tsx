import { useState, useEffect, useRef } from "react";

export function PwaUpdater() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSW = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const runRef = useRef(0);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const run = ++runRef.current;
    import("virtual:pwa-register").then(({ registerSW }) => {
      if (run !== runRef.current) return;
      updateSW.current = registerSW({
        immediate: true,
        onNeedRefresh() {
          if (run !== runRef.current) return;
          setNeedRefresh(true);
        },
      });
    });
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-18 left-1/2 -translate-x-1/2 md:bottom-4 md:left-auto md:translate-x-0 md:right-4 z-50 flex items-center gap-3 bg-primary text-white pl-4 pr-2 py-2 rounded-lg shadow-lg text-sm font-medium animate-slide-up">
      <span>A new version is available</span>
      <button
        type="button"
        onClick={() => updateSW.current?.(true).catch(() => {})}
        className="px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors cursor-pointer text-xs font-semibold"
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        className="p-1 rounded-md hover:bg-white/20 transition-colors cursor-pointer"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
