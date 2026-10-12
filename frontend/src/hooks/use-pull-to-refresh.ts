"use client";

import { useEffect, useRef, useState } from "react";

/** Lightweight mobile pull-to-refresh for scroll containers / page body. */
export function usePullToRefresh(onRefresh: () => Promise<void> | void, enabled = true) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const [progress, setProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    function onTouchStart(event: TouchEvent) {
      if (window.scrollY > 2 || refreshing) return;
      startY.current = event.touches[0]?.clientY || 0;
      pulling.current = true;
    }

    function onTouchMove(event: TouchEvent) {
      if (!pulling.current || refreshing) return;
      const y = event.touches[0]?.clientY || 0;
      const delta = Math.max(0, y - startY.current);
      if (delta > 8 && window.scrollY <= 0) {
        setProgress(Math.min(1, delta / 88));
      }
    }

    async function onTouchEnd() {
      if (!pulling.current) return;
      pulling.current = false;
      if (progress >= 1 && !refreshing) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
      setProgress(0);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, onRefresh, progress, refreshing]);

  return { progress, refreshing };
}
