'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface MagneticProps {
  children: ReactNode;
  strength?: number;
}

/** Subtle magnetic pull on hover. Disabled when prefers-reduced-motion. */
export const Magnetic = ({ children, strength = 0.3 }: MagneticProps) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    };
    const leave = () => { el.style.transform = ''; };

    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', leave);
    };
  }, [strength]);

  return <span ref={ref} className="magnetic">{children}</span>;
};
