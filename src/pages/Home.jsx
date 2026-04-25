/* ============================================================
   pages/Home.jsx — landing page.
   All copy comes from CONTENT.home in src/data.js.
   ============================================================ */

const ICONS_BY_NAME = { rocket: I.rocket, pen: I.pen, book: I.book, mail: I.mail, cal: I.cal, github: I.github };

const Home = () => {
  const [preview, setPreview] = React.useState({ visible: false, x: 0, y: 0, idx: 0 });

  const onProjectMove = (e, idx) => setPreview({ visible: true, x: e.clientX, y: e.clientY, idx });
  const onProjectLeave = () => setPreview(p => ({ ...p, visible: false }));

  return (
    <>
      <HomeHero />
      <HomeMarquee />
      <HomeStats />
      <HomeAbout />
      <HomeProjects preview={preview} onMove={onProjectMove} onLeave={onProjectLeave} />
      <HomeSkills />
      <HomeTestimonials />
      <HomeContributions />
      <ContactCTA />
      <Footer />
    </>
  );
};

/* ---------- Hero ---------- */

const HomeHero = () => {
  const c = CONTENT.home.hero;
  const renderCta = (cta, primary) => {
    const cls = primary ? 'btn btn-primary' : 'btn btn-ghost';
    if (cta.action === 'calendly') {
      return (
        <a href={SITE.calendly} className={cls} data-cursor="hover"
           target="_blank" rel="noreferrer" onClick={openCalendly}>
          {cta.label} <span className="arrow"><I.arrow /></span>
        </a>
      );
    }
    return (
      <a href={`#/${cta.route}`} className={cls} data-cursor="hover"
         onClick={(e) => { e.preventDefault(); navTo(cta.route); }}>
        {cta.label} <span className="arrow"><I.arrow /></span>
      </a>
    );
  };

  return (
    <header className="hero">
      <div className="hero-grid-bg" />
      <div className="hero-blob b1" />
      <div className="hero-blob b2" />

      <div className="hero-meta">
        <span className="status-pill"><span className="status-dot" />{SITE.status}</span>
        <span>{SITE.location.split(',')[0]}, BD · {SITE.timezone}</span>
      </div>

      <RichTitle text={c.title} className="hero-title" />

      <div className="hero-sub">
        <Rich as="p" className="hero-sub-text" text={c.subtext} />
        <div className="hero-cta-row">
          <Magnetic>{renderCta(c.ctaPrimary,   true)}</Magnetic>
          <Magnetic>{renderCta(c.ctaSecondary, false)}</Magnetic>
        </div>
      </div>
    </header>
  );
};

/* ---------- Marquee ---------- */

const HomeMarquee = () => (
  <div className="marquee" aria-hidden>
    <div className="marquee-track">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="marquee-item" style={{ display: 'inline-flex' }}>
          {CONTENT.marqueeWords.map(w => <span key={w}>{w}</span>)}
        </div>
      ))}
    </div>
  </div>
);

/* ---------- Stats ---------- */

const HomeStats = () => (
  <Reveal as="section" style={{ maxWidth: 'var(--maxw)', margin: '0 auto', padding: '0 40px' }}>
    <div className="stats">
      {CONTENT.stats.map(s => (
        <div key={s.label} className="stat">
          <div className="stat-num"><Counter value={s.num} suffix={s.suffix} /></div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  </Reveal>
);

/* ---------- About ---------- */

const HomeAbout = () => {
  const c = CONTENT.home.about;
  return (
    <section className="page" style={{ paddingTop: 120 }}>
      <Reveal>
        <div className="about-grid">
          <div className="about-photo">
            <div className="photo-placeholder">{c.avatar}</div>
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
                  const Icon = ICONS_BY_NAME[item.icon] || I.rocket;
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

/* ---------- Projects (with hover preview) ---------- */

const HomeProjects = ({ preview, onMove, onLeave }) => {
  const c = CONTENT.home.sections.projects;
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
            <a className="project-row"
               data-cursor="hover"
               href={`https://${p.id}.com`}
               target="_blank"
               rel="noreferrer"
               onMouseMove={(e) => onMove(e, i)}>
              <span className="index">{String(i + 1).padStart(2, '0')}</span>
              <span className="name">{p.name}</span>
              <div>
                <div style={{ marginBottom: 8, color: 'var(--ink-2)', fontSize: 14 }}>{p.desc}</div>
                <div className="meta">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{p.year}</span>
                  {p.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              </div>
              <span className="arrow-go"><I.arrowUp /></span>
            </a>
          </Reveal>
        ))}
        <div className={`project-preview ${preview.visible ? 'visible' : ''}`}
             style={{ left: preview.x, top: preview.y }}>
          <div className="preview-canvas" style={{
            background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${CONTENT.projects[preview.idx].color} 80%, white), ${CONTENT.projects[preview.idx].color})`,
          }}>
            {CONTENT.projects[preview.idx].initial}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ---------- Skills ---------- */

const HomeSkills = () => {
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
          {CONTENT.skills.map(s => (
            <div key={s.num} className="skill-cell">
              <h3><span className="num">{s.num}</span>{s.title}</h3>
              <div className="skills">{s.skills.map(sk => <span key={sk}>{sk}</span>)}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
};

/* ---------- Testimonials ---------- */

const HomeTestimonials = () => {
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

/* ---------- Contribution grid ---------- */

const HomeContributions = () => {
  const c = CONTENT.home.sections.contributions;
  const heading = c.headingTemplate.replace('{count}', SITE.contributionsLastYear.toLocaleString());
  return (
    <section className="page contrib-section">
      <Reveal>
        <div className="contrib-head">
          <div>
            <span className="eyebrow">{c.eyebrow}</span>
            <Rich as="h2"
                  text={heading}
                  style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 5vw, 56px)', margin: '12px 0 0', fontWeight: 400, letterSpacing: '-0.02em' }} />
          </div>
          <a href={SITE.socials.github} target="_blank" rel="noreferrer" className="btn btn-ghost" data-cursor="hover">
            @{SITE.socials.github.split('/').pop()} <span className="arrow"><I.arrowUp /></span>
          </a>
        </div>
      </Reveal>
      <Reveal>
        <ContribGrid />
      </Reveal>
    </section>
  );
};

window.Home = Home;
