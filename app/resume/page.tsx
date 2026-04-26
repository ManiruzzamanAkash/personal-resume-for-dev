import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTENT } from '@/lib/content';
import { tmpl } from '@/lib/tmpl';
import { pathFor } from '@/lib/routing';
import { buildMetadata, collectStructuredData } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Rich, RichTitle } from '@/components/Rich';
import { Reveal } from '@/components/Reveal';
import { Magnetic } from '@/components/Magnetic';
import { I } from '@/components/icons';

export const metadata: Metadata = buildMetadata({ route: 'resume' });

const ResumeAside = () => (
  <aside className="resume-aside">
    {CONTENT.resume.aside.map((section) => (
      <div key={section.title}>
        <h4>{section.title}</h4>
        <ul>
          {section.items.map((item, i) => <li key={i}>{tmpl(item)}</li>)}
        </ul>
      </div>
    ))}
  </aside>
);

const ResumeExperience = () => {
  const c = CONTENT.resume.sections.experience;
  return (
    <div className="resume-section">
      <span className="eyebrow">{c.eyebrow}</span>
      <Rich as="h2" text={c.heading} />
      <p className="lead">{c.lead}</p>
      <div className="timeline">
        {CONTENT.experience.map((e, i) => (
          <Reveal key={i} delay={i * 80}>
            <div className="tl-item">
              <div className="tl-date">{e.date}</div>
              <div>
                <h3 className="tl-role">{e.role}</h3>
                <div className="tl-company">{e.company}</div>
                <p className="tl-desc">{e.desc}</p>
                <div className="tl-tags">{e.tags.map((t) => <span key={t}>{t}</span>)}</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
};

const ResumeSkills = () => {
  const c = CONTENT.resume.sections.stack;
  return (
    <div className="resume-section">
      <span className="eyebrow">{c.eyebrow}</span>
      <Rich as="h2" text={c.heading} />
      <p className="lead">{c.lead}</p>
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
    </div>
  );
};

const ResumeOpenSource = () => {
  const c = CONTENT.resume.sections.openSource;
  return (
    <div className="resume-section">
      <span className="eyebrow">{c.eyebrow}</span>
      <Rich as="h2" text={c.heading} />
      <p className="lead">{c.lead}</p>
      <ul className="oss-list">
        {CONTENT.openSource.map((item) => {
          const primaryHref = item.live || item.github;
          if (!primaryHref) return null;
          return (
            <li key={item.name} className="oss-item">
              <a className="oss-row" href={primaryHref} target="_blank" rel="noreferrer" data-cursor="hover">
                <div>
                  <div className="oss-name">{item.name}</div>
                  <div className="oss-desc">{item.desc}</div>
                </div>
                <span className="oss-arrow"><I.arrowUp /></span>
              </a>
              <div className="oss-links">
                {item.live && (
                  <a className="oss-link" href={item.live} target="_blank" rel="noreferrer" data-cursor="hover">
                    <I.arrowUp /> Live
                  </a>
                )}
                {item.github && (
                  <a className="oss-link" href={item.github} target="_blank" rel="noreferrer" data-cursor="hover">
                    <I.github /> GitHub
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default function ResumePage() {
  const c = CONTENT.resume.hero;
  return (
    <>
      <JsonLd graph={collectStructuredData('resume')} />
      <Nav />
      <main id="main">
        <section className="subhero">
          <span className="eyebrow">{c.eyebrow}</span>
          <RichTitle text={c.heading} />
          <Rich as="p" className="lede" text={c.lede} />
          <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Magnetic>
              <Link
                className="btn btn-primary"
                href={pathFor(c.cta.route!)}
                data-cursor="hover"
              >
                {c.cta.label} <span className="arrow"><I.arrow /></span>
              </Link>
            </Magnetic>
          </div>
        </section>

        <section className="page" style={{ paddingTop: 60 }}>
          {/* No outer <Reveal> here. Wrapping a 3000+ px column in one
              Reveal means the IntersectionObserver threshold isn't met
              until the user has scrolled past a wall of opacity-0 space
              — they end up seeing only the hero. The inner timeline
              already Reveals each item on scroll, which gives the
              stagger effect without the visibility black hole. */}
          <div className="resume-grid">
            <ResumeAside />
            <div>
              <ResumeExperience />
              <ResumeSkills />
              <ResumeOpenSource />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
