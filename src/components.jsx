/* ============================================================
   components.jsx — Shared page-level components.
   Nav, Footer, ContactCTA, TestimonialCarousel, ContribGrid.
   Each is small and self-contained.
   ============================================================ */

/* ---------- Nav ---------- */

const Nav = ({ route, theme, setTheme }) => {
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu when the route changes.
  React.useEffect(() => { setMenuOpen(false); }, [route]);

  // Lock body scroll while menu is open (mobile only).
  React.useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [menuOpen]);

  const goTo = (id) => (e) => {
    e.preventDefault();
    navTo(id);
  };

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''} ${menuOpen ? 'menu-open' : ''}`}>
      <a className="nav-logo" href="#/home" onClick={goTo('home')}>
        <span className="dot"></span>
        {SITE.short}
      </a>

      <div className={`nav-links ${menuOpen ? 'is-open' : ''}`}>
        {CONTENT.navigation.map(l => (
          <a key={l.id}
             href={`#/${l.id}`}
             className={`nav-link ${route === l.id ? 'active' : ''} ${theme === 'dark' ? 'is-dark' : ''}`}
             onClick={goTo(l.id)}>
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
        <button className="icon-btn nav-toggle"
                onClick={() => setMenuOpen(o => !o)}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}>
          {menuOpen ? <I.close /> : <I.menu />}
        </button>
      </div>
    </nav>
  );
};

/* ---------- Footer ---------- */

const Footer = () => {
  const c = CONTENT.footer;
  return (
    <footer className="footer">
      <div>{c.copyright}</div>
      <div className="footer-links">
        {c.links.map((link) => {
          const a = resolveAction(link.action);
          return <a key={link.label} {...a}>{link.label}</a>;
        })}
      </div>
    </footer>
  );
};

/* ---------- Contact CTA (used at bottom of Home) ---------- */

const ContactCTA = () => {
  const c = CONTENT.home.contactCta;
  return (
    <section className="contact-block">
      <div style={{ maxWidth: 'var(--maxw)', margin: '0 auto', padding: '0 40px' }}>
        <Reveal>
          <span className="eyebrow contact-eyebrow">{c.eyebrow}</span>
          <Rich as="h2" className="contact-headline" text={c.heading} />
          <div className="contact-channels">
            {c.chips.map((chip, i) => {
              const Icon = (I[chip.icon] || I.mail);
              const a = resolveAction(chip.action);
              return (
                <Magnetic key={i}>
                  <a className="contact-chip" {...a} onClick={a.onClick} data-cursor="hover">
                    <Icon />{tmpl(chip.label)}
                  </a>
                </Magnetic>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
};

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
