/* ============================================================
   pages/Contact.jsx — Contact page with info + form.
   All copy comes from CONTENT.contact in src/data.js.
   Form is currently UI-only (no backend). Wire up via
   onSubmit -> fetch('/api/...') when a backend exists.
   ============================================================ */

const ContactPage = () => {
  const c = CONTENT.contact.hero;
  const [sent, setSent] = React.useState(false);

  return (
    <>
      <section className="subhero">
        <span className="eyebrow">{c.eyebrow}</span>
        <Rich as="h1" text={c.heading} />
        <Rich as="p" className="lede" text={c.lede} />
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

const ContactInfo = () => {
  const c = CONTENT.contact;
  return (
    <div className="contact-info">
      <Rich as="p"
            text={c.summary}
            style={{ fontSize: 22, fontFamily: 'var(--font-serif)', lineHeight: 1.4, color: 'var(--ink)', marginBottom: 32 }} />

      <ul className="contact-list">
        {c.links.map((link, i) => {
          const Icon = (I[link.icon] || I.mail);
          const a = resolveAction(link.action);
          return (
            <li key={i}>
              <a {...a}
                 onClick={a.onClick}
                 className="contact-list-link"
                 data-cursor="hover">
                <span className="icon-btn" style={{ width: 40, height: 40 }}><Icon /></span>
                <div>
                  <b>{tmpl(link.title)}</b>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{link.subtitle}</div>
                </div>
              </a>
            </li>
          );
        })}
      </ul>

      <div style={{ marginTop: 40, display: 'flex', gap: 8 }}>
        <a href={SITE.socials.github}        target="_blank" rel="noreferrer" className="icon-btn" data-cursor="hover"><I.github /></a>
        <a href={SITE.socials.linkedin}      target="_blank" rel="noreferrer" className="icon-btn" data-cursor="hover"><I.linkedin /></a>
        <a href={SITE.socials.youtube}       target="_blank" rel="noreferrer" className="icon-btn" data-cursor="hover"><I.yt /></a>
        <a href={SITE.socials.stackoverflow} target="_blank" rel="noreferrer" className="icon-btn" data-cursor="hover"><I.so /></a>
      </div>
    </div>
  );
};

const ContactForm = ({ sent, onSubmit }) => {
  const f = CONTENT.contact.form;
  return (
    <form className="contact-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div className="input-group">
        <label>{f.fields.name.label}</label>
        <input type="text" placeholder={f.fields.name.placeholder} required />
      </div>
      <div className="input-group">
        <label>{f.fields.email.label}</label>
        <input type="email" placeholder={f.fields.email.placeholder} required />
      </div>
      <div className="input-group">
        <label>{f.fields.type.label}</label>
        <select>
          {f.fields.type.options.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="input-group">
        <label>{f.fields.message.label}</label>
        <textarea placeholder={f.fields.message.placeholder} required />
      </div>
      <button type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              data-cursor="hover">
        {sent ? f.submitted : <>{f.submit} <span className="arrow"><I.arrow /></span></>}
      </button>
    </form>
  );
};

window.ContactPage = ContactPage;
