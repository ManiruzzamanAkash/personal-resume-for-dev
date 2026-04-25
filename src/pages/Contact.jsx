/* ============================================================
   pages/Contact.jsx — Contact page with info + form.
   Form is currently UI-only (no backend). Wire up via
   onSubmit -> fetch('/api/...') when a backend exists.
   ============================================================ */

const ContactPage = () => {
  const [sent, setSent] = React.useState(false);

  return (
    <>
      <section className="subhero">
        <span className="eyebrow">Contact</span>
        <h1>Let's <em>talk</em>.</h1>
        <p className="lede">
          Whether you want to swap notes on architecture, pick my brain about a
          plugin, or just say hi — drop a line. I usually respond within a day.
        </p>
      </section>

      <section className="page" style={{ paddingTop: 40 }}>
        <Reveal>
          <div className="contact-page-grid">
            <ContactInfo />
            <ContactForm sent={sent} onSubmit={() => {
              setSent(true);
              setTimeout(() => setSent(false), 3500);
            }} />
          </div>
        </Reveal>
      </section>
      <Footer />
    </>
  );
};

const ContactInfo = () => (
  <div className="contact-info">
    <p style={{ fontSize: 22, fontFamily: 'var(--font-serif)', lineHeight: 1.4, color: 'var(--ink)', marginBottom: 32 }}>
      I'm currently <b>@ Brainstorm Force</b>, but I'm always happy to chat —
      about engineering problems, plugin architecture, AI, or whatever
      you're building.
    </p>

    <ul className="contact-list">
      <li>
        <a href={`mailto:${SITE.email}`} className="contact-list-link" data-cursor="hover">
          <span className="icon-btn" style={{ width: 40, height: 40 }}><I.mail /></span>
          <div>
            <b>{SITE.email}</b>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>The fastest way to reach me</div>
          </div>
        </a>
      </li>
      <li>
        <a href={SITE.calendly} target="_blank" rel="noreferrer"
           onClick={openCalendly} className="contact-list-link" data-cursor="hover">
          <span className="icon-btn" style={{ width: 40, height: 40 }}><I.cal /></span>
          <div>
            <b>Book a 30-minute intro</b>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Calendly · usually within the week</div>
          </div>
        </a>
      </li>
      <li>
        <a href={SITE.socials.linkedin} target="_blank" rel="noreferrer"
           className="contact-list-link" data-cursor="hover">
          <span className="icon-btn" style={{ width: 40, height: 40 }}><I.linkedin /></span>
          <div>
            <b>linkedin.com/in/maniruzzamanakash</b>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Connect professionally</div>
          </div>
        </a>
      </li>
    </ul>

    <div style={{ marginTop: 40, display: 'flex', gap: 8 }}>
      <a href={SITE.socials.github} target="_blank" rel="noreferrer" className="icon-btn" data-cursor="hover"><I.github /></a>
      <a href={SITE.socials.linkedin} target="_blank" rel="noreferrer" className="icon-btn" data-cursor="hover"><I.linkedin /></a>
      <a href={SITE.socials.youtube} target="_blank" rel="noreferrer" className="icon-btn" data-cursor="hover"><I.yt /></a>
      <a href={SITE.socials.stackoverflow} target="_blank" rel="noreferrer" className="icon-btn" data-cursor="hover"><I.so /></a>
    </div>
  </div>
);

const ContactForm = ({ sent, onSubmit }) => (
  <form className="contact-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
    <div className="input-group">
      <label>Name</label>
      <input type="text" placeholder="Your name" required />
    </div>
    <div className="input-group">
      <label>Email</label>
      <input type="email" placeholder="you@company.com" required />
    </div>
    <div className="input-group">
      <label>Project type</label>
      <select>
        <option>Plugin development</option>
        <option>Technical consulting</option>
        <option>Architecture review</option>
        <option>Other</option>
      </select>
    </div>
    <div className="input-group">
      <label>Tell me about it</label>
      <textarea placeholder="Goals, timeline, anything I should know…" required />
    </div>
    <button type="submit" className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            data-cursor="hover">
      {sent ? 'Sent — thanks!' : <>Send message <span className="arrow"><I.arrow /></span></>}
    </button>
  </form>
);

window.ContactPage = ContactPage;
