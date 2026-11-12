// @ts-nocheck
'use client';
import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Row action menu that is never clipped.
 * List tables sit in a horizontally scrolling box, so an absolutely positioned menu under the last row (or in a table
 * with only one or two rows) was cut off and needed scrolling to read. This renders the menu with fixed positioning,
 * anchored to its [data-menu-container] parent, opening DOWN when there is room and UP otherwise, and follows the
 * button when the page or table scrolls. Clicks inside still count as "inside the menu container".
 */
export default function FloatMenu({ children, className = '', minWidth = 220 }: any) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<any>({ position: 'fixed', top: -9999, left: -9999, visibility: 'hidden' });

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      const anchor = el?.parentElement?.closest('[data-menu-container]') || el?.parentElement;
      if (!el || !anchor) return;
      const a = anchor.getBoundingClientRect();
      const h = el.offsetHeight, w = Math.max(el.offsetWidth, minWidth);
      const vh = window.innerHeight, vw = window.innerWidth;
      const below = vh - a.bottom - 8, above = a.top - 8;
      const up = h > below && above > below;
      const top = up ? Math.max(8, a.top - h - 4) : Math.min(a.bottom + 4, Math.max(8, vh - h - 8));
      const left = Math.min(Math.max(8, a.right - w), vw - w - 8);
      setStyle({ position: 'fixed', top, left, minWidth, maxHeight: Math.max(160, (up ? above : below) - 4), overflowY: 'auto', zIndex: 1000 });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [minWidth]);

  return <div ref={ref} style={style} className={className}>{children}</div>;
}
