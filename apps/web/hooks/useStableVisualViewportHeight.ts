'use client';

import { useEffect, useRef, useState } from 'react';

interface StableVisualViewportHeightOptions {
  /** Ignore mobile keyboard viewport changes at and above this CSS width. */
  maxWidth?: number;
  /** Treat smaller transient viewport measurements as unavailable. */
  minHeight?: number;
}

/**
 * Returns a viewport height that is safe to use while a virtual keyboard or
 * browser chrome is changing size. visualViewport can emit several resize and
 * scroll events for one frame, so updates are coalesced and deduplicated.
 */
export function useStableVisualViewportHeight({
  maxWidth,
  minHeight = 0,
}: StableVisualViewportHeightOptions = {}): number | null {
  const [height, setHeight] = useState<number | null>(null);
  const heightRef = useRef<number | null>(null);

  useEffect(() => {
    let frame: number | null = null;

    const commit = () => {
      frame = null;
      const nextHeight =
        maxWidth !== undefined && window.innerWidth >= maxWidth
          ? null
          : Math.round(window.visualViewport?.height ?? window.innerHeight);
      const normalizedHeight = nextHeight !== null && nextHeight >= minHeight ? nextHeight : null;

      if (heightRef.current === normalizedHeight) return;
      heightRef.current = normalizedHeight;
      setHeight(normalizedHeight);
    };

    const scheduleCommit = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(commit);
    };

    scheduleCommit();
    window.addEventListener('resize', scheduleCommit);
    window.visualViewport?.addEventListener('resize', scheduleCommit);
    window.visualViewport?.addEventListener('scroll', scheduleCommit);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleCommit);
      window.visualViewport?.removeEventListener('resize', scheduleCommit);
      window.visualViewport?.removeEventListener('scroll', scheduleCommit);
    };
  }, [maxWidth, minHeight]);

  return height;
}
