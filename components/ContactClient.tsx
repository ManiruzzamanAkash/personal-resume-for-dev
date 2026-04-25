'use client';

import { useState } from 'react';
import { CONTENT } from '@/lib/content';
import { resolveAction } from '@/lib/actions';
import { openCalendly } from '@/lib/calendly';
import { tmpl } from '@/lib/tmpl';
import { Rich } from './Rich';
import { I } from './icons';

const ContactInfo = () => {
  const c = CONTENT.contact;
  return (
    <div className="contact-info">
      <Rich
        as="p"
        text={c.summary}
        style={{
          fontSize: 22,
          fontFamily: 'var(--font-serif)',
          lineHeight: 1.4,
          color: 'var(--ink)',
          marginBottom: 32,
        }}
      />

      <ul className="contact-list">
        {c.links.map((link, i) => {
          const Icon = I[link.icon] || I.mail;
          const a = resolveAction(link.action);
          const onClick = link.action === 'calendly' ? openCalendly : undefined;
          return (
            <li key={i}>
              <a
                href={a.href}
                target={a.target}
                rel={a.rel}
                onClick={onClick}
                className="contact-list-link"
                data-cursor="hover"
              >
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
        <a href={CONTENT.site.socials.github} target="_blank" rel="noreferrer" className="icon-btn" data-cursor="hover" aria-label="GitHub"><I.github /></a>
        <a href={CONTENT.site.socials.linkedin} target="_blank" rel="noreferrer" className="icon-btn" data-cursor="hover" aria-label="LinkedIn"><I.linkedin /></a>
        <a href={CONTENT.site.socials.youtube} target="_blank" rel="noreferrer" className="icon-btn" data-cursor="hover" aria-label="YouTube"><I.yt /></a>
        <a href={CONTENT.site.socials.stackoverflow} target="_blank" rel="noreferrer" className="icon-btn" data-cursor="hover" aria-label="Stack Overflow"><I.so /></a>
      </div>
    </div>
  );
};

const ContactForm = ({ sent, onSubmit }: { sent: boolean; onSubmit: () => void }) => {
  const f = CONTENT.contact.form;
  return (
    <form
      className="contact-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
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
          {f.fields.type.options.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="input-group">
        <label>{f.fields.message.label}</label>
        <textarea placeholder={f.fields.message.placeholder} required />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
        data-cursor="hover"
      >
        {sent ? f.submitted : <>{f.submit} <span className="arrow"><I.arrow /></span></>}
      </button>
    </form>
  );
};

export const ContactClient = () => {
  const [sent, setSent] = useState(false);
  return (
    <div className="contact-page-grid">
      <ContactInfo />
      <ContactForm
        sent={sent}
        onSubmit={() => {
          setSent(true);
          setTimeout(() => setSent(false), 3500);
        }}
      />
    </div>
  );
};
