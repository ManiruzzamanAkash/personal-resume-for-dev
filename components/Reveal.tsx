'use client';

import { useEffect, useRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react';

interface RevealProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
}

/** Adds the `.in` class once the element scrolls into view; CSS handles
   the actual fade/transform. Disconnects on first intersection so it
   only runs once. */
export const Reveal = ({ children, delay = 0, as: Tag = 'div', className = '', ...rest }: RevealProps) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /* Threshold 0 + rootMargin firing slightly before the bottom edge
       handles tall elements on mobile correctly. With the previous
       `threshold: 0.15` rule, a Reveal wrapping a 3000+ px column had
       to scroll ~450px into view before triggering — leaving the user
       staring at a wall of opacity-0 content. This config triggers as
       soon as any sliver of the element enters the viewport, while
       still happening just BEFORE the first paint of the animation
       so the user sees the slide-up. */
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setTimeout(() => el.classList.add('in'), delay);
        io.disconnect();
      }
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });

    io.observe(el);

    /* Belt-and-suspenders: if the element is already fully on screen at
       mount (e.g. user landed mid-page via hash), the observer's first
       callback might race with React's commit and not fire. Manually
       check after the next paint and reveal if so. */
    const raf = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (r.top < vh && r.bottom > 0) {
        setTimeout(() => el.classList.add('in'), delay);
        io.disconnect();
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [delay]);

  return (
    <Tag ref={ref as any} className={`reveal ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
};
