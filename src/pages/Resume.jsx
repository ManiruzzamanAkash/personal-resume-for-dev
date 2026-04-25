/* ============================================================
   pages/Resume.jsx — long-form CV.
   ============================================================ */

const ResumePage = () => (
  <>
    <section className="subhero">
      <span className="eyebrow">Resume</span>
      <h1>Seven years of <em>shipping</em> software.</h1>
      <p className="lede">
        Across WordPress, Laravel, and React — a long-form view of what I've
        built, what I've learned, and what I want to do next.
      </p>
      <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Magnetic>
          <a className="btn btn-primary"
             href="#/contact"
             onClick={(e) => { e.preventDefault(); navTo('contact'); }}
             data-cursor="hover">
            Get in touch <span className="arrow"><I.arrow /></span>
          </a>
        </Magnetic>
      </div>
    </section>

    <section className="page" style={{ paddingTop: 60 }}>
      <Reveal>
        <div className="resume-grid">
          <ResumeAside />
          <div>
            <ResumeExperience />
            <ResumeSkills />
            <ResumeOpenSource />
          </div>
        </div>
      </Reveal>
    </section>
    <Footer />
  </>
);

const ResumeAside = () => (
  <aside className="resume-aside">
    <h4>Location</h4>
    <ul><li>{SITE.location}</li><li>{SITE.timezone}</li></ul>
    <h4>Email</h4>
    <ul><li>{SITE.email}</li></ul>
    <h4>Languages</h4>
    <ul><li>English (Fluent)</li><li>Bengali (Native)</li></ul>
    <h4>Education</h4>
    <ul><li>Patuakhali Science & Technology University</li><li>BSc, Computer Science</li></ul>
  </aside>
);

const ResumeExperience = () => (
  <div className="resume-section">
    <span className="eyebrow">01 — Experience</span>
    <h2>Where I've <em>worked</em>.</h2>
    <p className="lead">A timeline of teams, products, and the hard problems I helped solve.</p>
    <div className="timeline">
      {EXPERIENCE.map((e, i) => (
        <Reveal key={i} delay={i * 80}>
          <div className="tl-item">
            <div className="tl-date">{e.date}</div>
            <div>
              <h3 className="tl-role">{e.role}</h3>
              <div className="tl-company">{e.company}</div>
              <p className="tl-desc">{e.desc}</p>
              <div className="tl-tags">{e.tags.map(t => <span key={t}>{t}</span>)}</div>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  </div>
);

const ResumeSkills = () => (
  <div className="resume-section">
    <span className="eyebrow">02 — Stack</span>
    <h2>What I work <em>with</em>.</h2>
    <p className="lead">A working list — sharper at the top, broader at the bottom.</p>
    <div className="skills-grid">
      {SKILLS.map(s => (
        <div key={s.num} className="skill-cell">
          <h3><span className="num">{s.num}</span>{s.title}</h3>
          <div className="skills">{s.skills.map(sk => <span key={sk}>{sk}</span>)}</div>
        </div>
      ))}
    </div>
  </div>
);

const ResumeOpenSource = () => (
  <div className="resume-section">
    <span className="eyebrow">03 — Open Source</span>
    <h2>Things I <em>maintain</em>.</h2>
    <p className="lead">Code I've written or contributed to that's used by other developers.</p>
    <ul className="oss-list">
      {OPEN_SOURCE.map((item) => {
        const primaryHref = item.live || item.github;
        return (
          <li key={item.name} className="oss-item">
            <a className="oss-row"
               href={primaryHref}
               target="_blank"
               rel="noreferrer"
               data-cursor="hover">
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

window.ResumePage = ResumePage;
