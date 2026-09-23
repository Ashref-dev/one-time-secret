import { useLayoutEffect, useRef } from 'react';

// Smoothly lerps an element's width when its content changes size
// (e.g. label swaps like "seal it" → "sealing…"). Pass the changing
// value as `dep`; the hook animates old width → new width.
export function useMorphWidth<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T | null>(null);
  const prev = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    if (prev.current && Math.abs(w - prev.current) > 1) {
      el.getAnimations().forEach((a) => {
        try {
          a.cancel();
        } catch {
          /* already finished */
        }
      });
      el.animate([{ width: `${prev.current}px` }, { width: `${w}px` }], {
        duration: 240,
        easing: 'cubic-bezier(0.22,1,0.36,1)',
      });
    }
    prev.current = w;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);

  return ref;
}
