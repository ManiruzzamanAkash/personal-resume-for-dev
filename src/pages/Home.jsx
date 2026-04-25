/* ============================================================
   pages/Home.jsx — landing page.
   Hero → marquee → stats → about → projects → skills →
   testimonials → contributions → contact CTA → footer.
   ============================================================ */

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

const HomeHero = () => (
  <header className="hero">
    <div className="hero-grid-bg" />
    <div className="hero-blob b1" />
    <div className="hero-blob b2" />

    <div className="hero-meta">
      <span className="status-pill"><span className="status-dot" />{SITE.status}</span>
      <span>{SITE.location.split(',')[0]}, BD · {SITE.timezone}</span>
    </div>

    <h1 className="hero-title">
      <span className="word"><span style={{ animationDelay: '0.05s' }}>Senior</span></span>{' '}
      <span className="word"><span style={{ animationDelay: '0.15s' }}>WordPress</span></span><br />
      <span className="word"><span style={{ animationDelay: '0.25s' }}><em>plugin</em></span></span>{' '}
      <span className="word"><span style={{ animationDelay: '0.35s' }}>developer</span></span>{' '}
      <span className="word"><span style={{ animationDelay: '0.45s' }}>&</span></span><br />
      <span className="word"><span style={{ animationDelay: '0.55s' }}>software</span></span>{' '}
      <span className="word"><span style={{ animationDelay: '0.65s' }}><em>architect.</em></span></span>
    </h1>

    <div className="hero-sub">
      <p className="hero-sub-text">
        I'm <b>{SITE.fullName}</b> — 7+ years building scalable WordPress plugins,
        eCommerce systems, and developer tools used by <b>100K+</b> users worldwide.
        Currently engineering <b>SureCart</b> at Brainstorm Force.
      </p>
      <div className="hero-cta-row">
        <Magnetic>
          <a href="#/resume" className="btn btn-primary" data-cursor="hover"
             onClick={(e) => { e.preventDefault(); navTo('resume'); }}>
            View résumé <span className="arrow"><I.arrow /></span>
          </a>
        </Magnetic>
        <Magnetic>
          <a href={SITE.calendly} className="btn btn-ghost" data-cursor="hover"
             target="_blank" rel="noreferrer"
             onClick={openCalendly}>
            Book a call <span className="arrow"><I.arrow /></span>
          </a>
        </Magnetic>
      </div>
    </div>
  </header>
);

/* ---------- Marquee ---------- */

const HomeMarquee = () => (
  <div className="marquee" aria-hidden>
    <div className="marquee-track">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="marquee-item" style={{ display: 'inline-flex' }}>
          {MARQUEE_WORDS.map(w => <span key={w}>{w}</span>)}
        </div>
      ))}
    </div>
  </div>
);

/* ---------- Stats ---------- */

const HomeStats = () => (
  <Reveal as="section" style={{ maxWidth: 'var(--maxw)', margin: '0 auto', padding: '0 40px' }}>
    <div className="stats">
      {STATS.map(s => (
        <div key={s.label} className="stat">
          <div className="stat-num"><Counter value={s.num} suffix={s.suffix} /></div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  </Reveal>
);

/* ---------- About ---------- */

const HomeAbout = () => (
  <section className="page" style={{ paddingTop: 120 }}>
    <Reveal>
      <div className="about-grid">
        <div className="about-photo">
          <div className="photo-placeholder">A</div>
        </div>
        <div className="about-text">
          <span className="eyebrow">About</span>
          <h2>Building software that <em>scales</em> — one principle at a time.</h2>
          <p>
            I'm a passionate WordPress plugin developer and full-stack engineer based in Dhaka.
            For seven years I've been crafting scalable systems — from high-traffic eCommerce
            platforms to multi-tenant SaaS — always with a bias toward <b>clean architecture</b>,
            <b> SOLID principles</b>, and well-tested code.
          </p>
          <p>
            Currently I'm a Senior Plugin Developer at <b>Brainstorm Force</b>, where I work on
            <b> SureCart</b>. I've helped take it from one thousand active installations to over
            a hundred thousand — touching everything from payment gateways and subscriptions to
            Gutenberg blocks and performance.
          </p>

          <div className="now-widget">
            <div className="now-head">
              <span className="title">Currently</span>
              <span className="status-pill"><span className="status-dot" />Live</span>
            </div>
            <ul className="now-list">
              <li>
                <span className="ico"><I.rocket /></span>
                <div><b>Shipping SureCart 4.0</b><small>Subscription redesign + new checkout architecture</small></div>
              </li>
              <li>
                <span className="ico"><I.pen /></span>
                <div><b>Writing about plugin architecture</b><small>A series on SOLID for WordPress engineers</small></div>
              </li>
              <li>
                <span className="ico"><I.book /></span>
                <div><b>Reading <i>Domain-Driven Design</i></b><small>Re-reading Eric Evans, third pass</small></div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Reveal>
  </section>
);

/* ---------- Projects (with hover preview) ---------- */

const HomeProjects = ({ preview, onMove, onLeave }) => (
  <section className="page projects-section" style={{ paddingTop: 80 }}>
    <Reveal>
      <div className="section-head">
        <div>
          <span className="eyebrow">Selected work</span>
          <h2>Things I've <em>shipped</em>.</h2>
        </div>
        <span className="count">{String(PROJECTS.length).padStart(2, '0')} projects</span>
      </div>
    </Reveal>
    <div onMouseLeave={onLeave}>
      {PROJECTS.map((p, i) => (
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
          background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${PROJECTS[preview.idx].color} 80%, white), ${PROJECTS[preview.idx].color})`,
        }}>
          {PROJECTS[preview.idx].initial}
        </div>
      </div>
    </div>
  </section>
);

/* ---------- Skills ---------- */

const HomeSkills = () => (
  <section className="page" style={{ paddingTop: 40 }}>
    <Reveal>
      <div className="section-head">
        <div>
          <span className="eyebrow">Stack</span>
          <h2>What I work <em>with</em>.</h2>
        </div>
      </div>
    </Reveal>
    <Reveal>
      <div className="skills-grid">
        {SKILLS.map(s => (
          <div key={s.num} className="skill-cell">
            <h3><span className="num">{s.num}</span>{s.title}</h3>
            <div className="skills">{s.skills.map(sk => <span key={sk}>{sk}</span>)}</div>
          </div>
        ))}
      </div>
    </Reveal>
  </section>
);

/* ---------- Testimonials ---------- */

const HomeTestimonials = () => (
  <section className="page" style={{ paddingTop: 40 }}>
    <Reveal>
      <div className="section-head">
        <div>
          <span className="eyebrow">Words</span>
          <h2>From the people I've <em>worked with</em>.</h2>
        </div>
      </div>
    </Reveal>
    <TestimonialCarousel />
  </section>
);

/* ---------- Contribution grid ---------- */

const HomeContributions = () => (
  <section className="page contrib-section">
    <Reveal>
      <div className="contrib-head">
        <div>
          <span className="eyebrow">Activity</span>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 5vw, 56px)', margin: '12px 0 0', fontWeight: 400, letterSpacing: '-0.02em' }}>
            <em style={{ color: 'var(--primary)' }}>{SITE.contributionsLastYear.toLocaleString()}</em> contributions in the last year
          </h2>
        </div>
        <a href={SITE.socials.github} target="_blank" rel="noreferrer" className="btn btn-ghost" data-cursor="hover">
          @ManiruzzamanAkash <span className="arrow"><I.arrowUp /></span>
        </a>
      </div>
    </Reveal>
    <Reveal>
      <ContribGrid />
    </Reveal>
  </section>
);

window.Home = Home;
