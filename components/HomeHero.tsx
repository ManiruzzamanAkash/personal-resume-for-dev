'use client';

import Link from 'next/link';
import { CONTENT } from '@/lib/content';
import { pathFor } from '@/lib/routing';
import { openCalendly } from '@/lib/calendly';
import { Rich, RichTitle } from './Rich';
import { Magnetic } from './Magnetic';
import { I } from './icons';
import type { Cta } from '@/lib/content';

const CtaButton = ({ cta, primary }: { cta: Cta; primary: boolean }) => {
  const cls = primary ? 'btn btn-primary' : 'btn btn-ghost';
  if (cta.action === 'calendly') {
    return (
      <a
        href={CONTENT.site.calendly}
        className={cls}
        data-cursor="hover"
        target="_blank"
        rel="noreferrer"
        onClick={openCalendly}
      >
        {cta.label} <span className="arrow"><I.arrow /></span>
      </a>
    );
  }
  return (
    <Link href={pathFor(cta.route!)} className={cls} data-cursor="hover">
      {cta.label} <span className="arrow"><I.arrow /></span>
    </Link>
  );
};

export const HomeHero = () => {
  const c = CONTENT.home.hero;
  return (
    <header className="hero">
      <div className="hero-grid-bg" />
      <div className="hero-blob b1" />
      <div className="hero-blob b2" />

      <div className="hero-meta">
        <span className="status-pill">
          <span className="status-dot" />
          {CONTENT.site.status}
        </span>
        <span>{CONTENT.site.location.split(',')[0]}, BD · {CONTENT.site.timezone}</span>
      </div>

      <RichTitle text={c.title} className="hero-title" />

      <div className="hero-sub">
        <Rich as="p" className="hero-sub-text" text={c.subtext} />
        <div className="hero-cta-row">
          <Magnetic><CtaButton cta={c.ctaPrimary}   primary /></Magnetic>
          <Magnetic><CtaButton cta={c.ctaSecondary} primary={false} /></Magnetic>
        </div>
      </div>
    </header>
  );
};
