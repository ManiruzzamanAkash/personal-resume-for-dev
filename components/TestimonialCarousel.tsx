'use client';

import { useState } from 'react';
import { CONTENT } from '@/lib/content';
import { Reveal } from './Reveal';
import { I } from './icons';

export const TestimonialCarousel = () => {
  const [i, setI] = useState(0);
  const TESTIMONIALS = CONTENT.testimonials;
  const t = TESTIMONIALS[i];

  return (
    <Reveal>
      <div className="t-card">
        <p className="t-quote">{t.quote}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <div className="t-author">
            <div className="t-avatar">{t.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
            <div>
              <div className="t-author-name">{t.name}</div>
              <div className="t-author-role">{t.role}</div>
            </div>
          </div>
          <div className="t-controls">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setI((i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}
              aria-label="Previous"
            >
              <I.chevronLeft />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setI((i + 1) % TESTIMONIALS.length)}
              aria-label="Next"
            >
              <I.chevronRight />
            </button>
            <span style={{ alignSelf: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)', marginLeft: 8 }}>
              {String(i + 1).padStart(2, '0')} / {String(TESTIMONIALS.length).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>
    </Reveal>
  );
};
