'use client';

import { useEffect, useRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react';

interface RevealProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
}

/** Adds the `.in` class once the element scrolls into view; CSS handles
   the actual fade/transform. Disconnects on first reveal so it only
   runs once.

   Mobile cold-load resilience: a single IntersectionObserver isn't
   enough on first paint, because hydration, font loading, and image
   decoding all race with the user's first scroll. The previous
   implementation could leave entire sections stuck at `opacity: 0`
   until the user scrolled twice or hit reload. We now layer four
   independent triggers — IO, an rAF poll for the first ~1s, scroll,
   and `load` — any one of which can flip an in-view element to `.in`. */
export const Reveal = ({ children, delay = 0, as: Tag = 'div', className = '', ...rest }: RevealProps) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /* Respect reduced motion: just show the content. The 0.9s fade is
       decorative — there's no reason to gate visibility behind it for
       users who've opted out. */
    if (typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('in');
      return;
    }

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      window.setTimeout(() => el.classList.add('in'), delay);
    };

    const isInView = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return r.top < vh && r.bottom > 0;
    };

    /* Primary trigger: IntersectionObserver with a zero rootMargin so
       the element reveals the instant any pixel touches the viewport.
       The previous `-10%` bottom margin meant sections directly under
       the 100vh hero needed a noticeable scroll before triggering on
       short mobile viewports. */
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        reveal();
        io.disconnect();
      }
    }, { threshold: 0, rootMargin: '0px' });
    io.observe(el);

    /* Backup 1: rAF poll for the first ~60 frames. Catches elements
       that are already in view at mount AND elements that move into
       view because of layout shifts from late-loading fonts or images
       (common on mobile cold loads). Stops as soon as the element is
       revealed or after ~1s, whichever comes first. */
    let raf: number | null = null;
    let frames = 0;
    const tick = () => {
      raf = null;
      if (revealed) return;
      if (isInView()) {
        reveal();
        io.disconnect();
        return;
      }
      if (++frames < 60) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    /* Backup 2: scroll listener. If the IO callback gets delayed by
       hydration work on mobile, the next scroll tick will catch it.
       Passive + auto-removed on first reveal so there's no perf cost. */
    const onScroll = () => {
      if (revealed) return;
      if (isInView()) {
        reveal();
        io.disconnect();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    /* Backup 3: the `load` event fires after fonts/images settle. If
       any element has shifted into view by then, reveal it. */
    const onLoad = () => {
      if (revealed) return;
      if (isInView()) {
        reveal();
        io.disconnect();
      }
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad);

    return () => {
      io.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('load', onLoad);
    };
  }, [delay]);

  return (
    <Tag ref={ref as any} className={`reveal ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
};
