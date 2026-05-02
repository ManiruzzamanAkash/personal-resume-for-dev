'use client';

import { useEffect, useRef, useState } from 'react';

interface CounterProps {
  value: number;
  suffix?: string;
  decimals?: number;
}

/**
 * Animated counter that counts up from zero to `value` when scrolled into view.
 *
 * SSR + no-JS contract: `useState(value)` so the static HTML ships the final
 * number (`100K+`, not `0+`). Without this the page renders a wall of "0+"
 * for crawlers, RSS readers, and the brief moment before hydration — which
 * reads as a broken JS counter and undermines the seniority signal.
 *
 * On mount we check if the element is already on screen. If so we leave it at
 * the final value (skips the 100 → 0 → 100 flash that would otherwise happen
 * for above-the-fold stats). Only when the element scrolls in from below do
 * we reset to 0 and play the count-up. `prefers-reduced-motion` skips the
 * animation entirely, leaving the SSR value in place.
 */
export const Counter = ({ value, suffix = '', decimals = 0 }: CounterProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const rect = el.getBoundingClientRect();
    const alreadyInView = rect.top < window.innerHeight && rect.bottom > 0;
    if (alreadyInView) return;

    setN(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      const start = performance.now();
      const dur = 1600;
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setN(value * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      io.disconnect();
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  const display = decimals === 0 ? Math.round(n) : n.toFixed(decimals);
  return <span ref={ref}>{display}{suffix}</span>;
};
