/* ============================================================
   components.jsx — Shared page-level components.
   Nav, Footer, ContactCTA, TestimonialCarousel, ContribGrid.
   Each is small and self-contained.
   ============================================================ */

/* ---------- Nav ---------- */

const Nav = ({ route, theme, setTheme }) => {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <a className="nav-logo" href="#/home" onClick={(e) => { e.preventDefault(); navTo('home'); }}>
        <span className="dot"></span>
        {SITE.short}
      </a>

      <div className="nav-links">
        {NAV_LINKS.map(l => (
          <a key={l.id}
             href={`#/${l.id}`}
             className={`nav-link ${route === l.id ? 'active' : ''} ${theme === 'dark' ? 'is-dark' : ''}`}
             onClick={(e) => { e.preventDefault(); navTo(l.id); }}>
            {route === l.id && (
              <span className="pill" style={{ background: theme === 'dark' ? '#fafafa' : '#0a0a0a' }} />
            )}
            <span>{l.label}</span>
          </a>
        ))}
      </div>

      <div className="nav-actions">
        <button className="icon-btn"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle theme">
          {theme === 'dark' ? <I.sun /> : <I.moon />}
        </button>
      </div>
    </nav>
  );
};

/* ---------- Footer ---------- */

const Footer = () => (
  <footer className="footer">
    <div>{SITE.copyright}</div>
    <div className="footer-links">
      <a href={SITE.socials.github} target="_blank" rel="noreferrer">GitHub</a>
      <a href={SITE.socials.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
      <a href={SITE.socials.youtube} target="_blank" rel="noreferrer">YouTube</a>
      <a href={SITE.socials.stackoverflow} target="_blank" rel="noreferrer">SO</a>
    </div>
  </footer>
);

/* ---------- Contact CTA (used at bottom of Home) ---------- */

const ContactCTA = () => (
  <section className="contact-block">
    <div style={{ maxWidth: 'var(--maxw)', margin: '0 auto', padding: '0 40px' }}>
      <Reveal>
        <span className="eyebrow contact-eyebrow">Let's talk</span>
        <h2 className="contact-headline">Got a <em>plugin</em> idea?<br />Let's build it.</h2>
        <div className="contact-channels">
          <Magnetic>
            <a className="contact-chip" href={`mailto:${SITE.email}`} data-cursor="hover">
              <I.mail />{SITE.email}
            </a>
          </Magnetic>
          <Magnetic>
            <a className="contact-chip"
               href={SITE.calendly}
               target="_blank" rel="noreferrer"
               onClick={openCalendly}
               data-cursor="hover">
              <I.cal />Book a 30-min call
            </a>
          </Magnetic>
          <Magnetic>
            <a className="contact-chip" href={SITE.socials.github} target="_blank" rel="noreferrer" data-cursor="hover">
              <I.github />GitHub
            </a>
          </Magnetic>
        </div>
      </Reveal>
    </div>
  </section>
);

/* ---------- Testimonial carousel ---------- */

const TestimonialCarousel = () => {
  const [i, setI] = React.useState(0);
  const t = TESTIMONIALS[i];

  return (
    <Reveal>
      <div className="t-card">
        <p className="t-quote">{t.quote}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <div className="t-author">
            <div className="t-avatar">{t.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</div>
            <div>
              <div className="t-author-name">{t.name}</div>
              <div className="t-author-role">{t.role}</div>
            </div>
          </div>
          <div className="t-controls">
            <button className="icon-btn"
                    onClick={() => setI((i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}
                    aria-label="Previous">
              <I.chevronLeft />
            </button>
            <button className="icon-btn"
                    onClick={() => setI((i + 1) % TESTIMONIALS.length)}
                    aria-label="Next">
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

/* ---------- GitHub-style contribution grid (decorative) ---------- */

const buildContribGrid = () => {
  const cells = [];
  for (let i = 0; i < 53 * 7; i++) {
    const r = Math.random();
    let lvl = 0;
    if (r > 0.55) lvl = 1;
    if (r > 0.75) lvl = 2;
    if (r > 0.88) lvl = 3;
    if (r > 0.96) lvl = 4;
    const day = i % 7;
    if (day === 0 || day === 6) lvl = Math.max(0, lvl - 1);
    cells.push(lvl);
  }
  return cells;
};

const ContribGrid = () => {
  const [cells] = React.useState(buildContribGrid);

  return (
    <>
      <div className="contrib-grid">
        {cells.map((lvl, i) => (
          <div key={i}
               className={`contrib-cell ${lvl ? 'l' + lvl : ''}`}
               style={{ animation: `fadeIn 0.6s ${(i % 53) * 8}ms both` }} />
        ))}
      </div>
      <div className="contrib-legend">
        <span>Less</span>
        <div className="scale">
          <span style={{ background: 'var(--muted-2)' }} />
          <span style={{ background: 'color-mix(in srgb, var(--primary) 25%, var(--muted-2))' }} />
          <span style={{ background: 'color-mix(in srgb, var(--primary) 50%, var(--muted-2))' }} />
          <span style={{ background: 'color-mix(in srgb, var(--primary) 75%, var(--muted-2))' }} />
          <span style={{ background: 'var(--primary)' }} />
        </div>
        <span>More</span>
      </div>
    </>
  );
};

Object.assign(window, {
  Nav, Footer, ContactCTA, TestimonialCarousel,
  ContribGrid, buildContribGrid,
});
