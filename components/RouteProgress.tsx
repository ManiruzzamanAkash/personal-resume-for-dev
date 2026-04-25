'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Fixed top-of-page progress bar shown during client-side route transitions.
 *
 * Starts animating the moment the user clicks an internal link, trickles
 * toward ~85%, then snaps to 100% and fades out when the new pathname
 * resolves. Mounts once at the layout level — no per-route wiring needed.
 *
 * Click filtering mirrors the rules NProgress and `next/link` use: only
 * left-button, no modifier keys, no `target=_blank`, no cross-origin or
 * `mailto:` / `tel:` / `#` hrefs, and no same-path links.
 */
/* Pre-rendered Next.js pages resolve in single-digit ms — without a
   minimum show window the bar would appear and vanish in one frame.
   500ms keeps the affordance perceptible without feeling sluggish. */
const MIN_SHOW_MS = 500;
const FADE_MS = 280;

export const RouteProgress = () => {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const trickleRef = useRef<number | null>(null);
  const startedAt = useRef<number>(0);
  const completeTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (trickleRef.current) { window.clearInterval(trickleRef.current); trickleRef.current = null; }
    if (completeTimerRef.current) { window.clearTimeout(completeTimerRef.current); completeTimerRef.current = null; }
    if (fadeTimerRef.current) { window.clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
  };

  /* ---- Start: internal-link click ---- */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const a = (e.target as HTMLElement | null)?.closest('a');
      if (!a) return;
      if (a.target && a.target !== '' && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;

      const href = a.getAttribute('href');
      if (!href) return;
      if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;
      if (/^https?:\/\//i.test(href)) {
        try {
          if (new URL(href).origin !== window.location.origin) return;
        } catch { return; }
      }

      let nextPath: string;
      try {
        nextPath = new URL(href, window.location.href).pathname;
      } catch { return; }

      /* Skip same-page navigation (only the hash/query changes). */
      const norm = (p: string) => p.replace(/\/+$/, '') || '/';
      if (norm(nextPath) === norm(window.location.pathname)) return;

      clearTimers();
      startedAt.current = Date.now();
      setVisible(true);
      setProgress(20);

      trickleRef.current = window.setInterval(() => {
        setProgress((p) => (p < 85 ? p + Math.max(1, (85 - p) * 0.1) : p));
      }, 180) as unknown as number;
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      clearTimers();
    };
  }, []);

  /* ---- Finish: pathname resolved ---- */
  useEffect(() => {
    if (!visible) return;
    if (trickleRef.current) {
      window.clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    /* Honour the minimum-show window so even instant pre-rendered hops
       still register as a visible loading affordance. */
    const elapsed = Date.now() - startedAt.current;
    const wait = Math.max(0, MIN_SHOW_MS - elapsed);

    completeTimerRef.current = window.setTimeout(() => {
      setProgress(100);
      fadeTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, FADE_MS) as unknown as number;
    }, wait) as unknown as number;

    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div
      className={`route-progress ${visible ? 'is-active' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      aria-hidden={!visible}
    >
      <div
        className="route-progress-bar"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
