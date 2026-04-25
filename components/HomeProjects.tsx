'use client';

import { useState, type MouseEvent } from 'react';
import { CONTENT } from '@/lib/content';
import { Rich } from './Rich';
import { Reveal } from './Reveal';
import { I } from './icons';

interface PreviewState { visible: boolean; x: number; y: number; idx: number }

export const HomeProjects = () => {
  const c = CONTENT.home.sections.projects;
  const [preview, setPreview] = useState<PreviewState>({ visible: false, x: 0, y: 0, idx: 0 });

  const onMove = (e: MouseEvent, idx: number) =>
    setPreview({ visible: true, x: e.clientX, y: e.clientY, idx });
  const onLeave = () => setPreview((p) => ({ ...p, visible: false }));

  const active = CONTENT.projects[preview.idx];

  return (
    <section className="page projects-section" style={{ paddingTop: 80 }}>
      <Reveal>
        <div className="section-head">
          <div>
            <span className="eyebrow">{c.eyebrow}</span>
            <Rich as="h2" text={c.heading} />
          </div>
          <span className="count">{c.count.replace('{n}', String(CONTENT.projects.length).padStart(2, '0'))}</span>
        </div>
      </Reveal>
      <div onMouseLeave={onLeave}>
        {CONTENT.projects.map((p, i) => (
          <Reveal key={p.id} delay={i * 60}>
            <a
              className="project-row"
              data-cursor="hover"
              href={`https://${p.id}.com`}
              target="_blank"
              rel="noreferrer"
              onMouseMove={(e) => onMove(e, i)}
            >
              <span className="index">{String(i + 1).padStart(2, '0')}</span>
              <span className="name">{p.name}</span>
              <div>
                <div style={{ marginBottom: 8, color: 'var(--ink-2)', fontSize: 14 }}>{p.desc}</div>
                <div className="meta">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{p.year}</span>
                  {p.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                </div>
              </div>
              <span className="arrow-go"><I.arrowUp /></span>
            </a>
          </Reveal>
        ))}
        <div
          className={`project-preview ${preview.visible ? 'visible' : ''}`}
          style={{ left: preview.x, top: preview.y }}
        >
          <div
            className="preview-canvas"
            style={{
              background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${active.color} 80%, white), ${active.color})`,
            }}
          >
            {active.initial}
          </div>
        </div>
      </div>
    </section>
  );
};
