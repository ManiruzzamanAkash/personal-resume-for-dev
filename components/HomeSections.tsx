'use client';

import { CONTENT } from '@/lib/content';
import { Rich } from './Rich';
import { Reveal } from './Reveal';
import { Counter } from './Counter';
import { TestimonialCarousel } from './TestimonialCarousel';
import { ContribGrid } from './ContribGrid';
import { I } from './icons';

export const HomeMarquee = () => (
  <div className="marquee" aria-hidden>
    <div className="marquee-track">
      {[0, 1].map((i) => (
        <div key={i} className="marquee-item" style={{ display: 'inline-flex' }}>
          {CONTENT.marqueeWords.map((w) => <span key={w}>{w}</span>)}
        </div>
      ))}
    </div>
  </div>
);

export const HomeStats = () => (
  <Reveal as="section" style={{ maxWidth: 'var(--maxw)', margin: '0 auto', padding: '0 40px' }}>
    <div className="stats">
      {CONTENT.stats.map((s) => (
        <div key={s.label} className="stat">
          <div className="stat-num"><Counter value={s.num} suffix={s.suffix} /></div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  </Reveal>
);

export const HomeAbout = () => {
  const c = CONTENT.home.about;
  return (
    <section className="page" style={{ paddingTop: 120 }}>
      <Reveal>
        <div className="about-grid">
          <div className="about-photo">
            <img
              src="/assets/profile.png"
              alt={`${CONTENT.site.fullName} — ${CONTENT.site.jobTitle}`}
              className="about-photo-img"
              width={800}
              height={1000}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="about-text">
            <span className="eyebrow">{c.eyebrow}</span>
            <Rich as="h2" text={c.heading} />
            {c.paragraphs.map((p, i) => <Rich as="p" key={i} text={p} />)}

            <div className="now-widget">
              <div className="now-head">
                <span className="title">{c.now.title}</span>
                <span className="status-pill"><span className="status-dot" />Live</span>
              </div>
              <ul className="now-list">
                {c.now.items.map((item, i) => {
                  const Icon = I[item.icon] || I.rocket;
                  return (
                    <li key={i}>
                      <span className="ico"><Icon /></span>
                      <div>
                        <Rich as="b" text={item.heading} />
                        <small>{item.subtitle}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
};

export const HomeSkills = () => {
  const c = CONTENT.home.sections.skills;
  return (
    <section className="page" style={{ paddingTop: 40 }}>
      <Reveal>
        <div className="section-head">
          <div>
            <span className="eyebrow">{c.eyebrow}</span>
            <Rich as="h2" text={c.heading} />
          </div>
        </div>
      </Reveal>
      <Reveal>
        <div className="skills-grid">
          {CONTENT.skills.map((s) => (
            <div key={s.num} className="skill-cell">
              <h3><span className="num">{s.num}</span>{s.title}</h3>
              <div className="skills">
                {s.skills.map((sk) => <span key={sk}>{sk}</span>)}
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
};

export const HomeTestimonials = () => {
  const c = CONTENT.home.sections.testimonials;
  return (
    <section className="page" style={{ paddingTop: 40 }}>
      <Reveal>
        <div className="section-head">
          <div>
            <span className="eyebrow">{c.eyebrow}</span>
            <Rich as="h2" text={c.heading} />
          </div>
        </div>
      </Reveal>
      <TestimonialCarousel />
    </section>
  );
};

export const HomeContributions = () => {
  const c = CONTENT.home.sections.contributions;
  const heading = c.headingTemplate.replace('{count}', CONTENT.site.contributionsLastYear.toLocaleString());
  return (
    <section className="page contrib-section">
      <Reveal>
        <div className="contrib-head">
          <div>
            <span className="eyebrow">{c.eyebrow}</span>
            <Rich
              as="h2"
              text={heading}
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(36px, 5vw, 56px)',
                margin: '12px 0 0',
                fontWeight: 400,
                letterSpacing: '-0.02em',
              }}
            />
          </div>
          <a
            href={CONTENT.site.socials.github}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
            data-cursor="hover"
          >
            @{CONTENT.site.socials.github.split('/').pop()} <span className="arrow"><I.arrowUp /></span>
          </a>
        </div>
      </Reveal>
      <Reveal>
        <ContribGrid />
      </Reveal>
    </section>
  );
};
