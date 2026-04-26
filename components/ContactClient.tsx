'use client';

import { useState } from 'react';
import { CONTENT } from '@/lib/content';
import { resolveAction } from '@/lib/actions';
import { openCalendly } from '@/lib/calendly';
import { tmpl } from '@/lib/tmpl';
import { Rich } from './Rich';
import { I } from './icons';

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? '';

type FormStatus = 'idle' | 'submitting' | 'sent' | 'error';

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

const ContactForm = ({
  status,
  errorMessage,
  onSubmit,
}: {
  status: FormStatus;
  errorMessage: string;
  onSubmit: (form: HTMLFormElement) => void;
}) => {
  const f = CONTENT.contact.form;
  const submitting = status === 'submitting';
  const sent = status === 'sent';

  return (
    <form
      className="contact-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (submitting) return;
        onSubmit(e.currentTarget);
      }}
    >
      {/* Web3Forms hidden fields — only rendered when configured */}
      {WEB3FORMS_KEY && (
        <>
          <input type="hidden" name="access_key" value={WEB3FORMS_KEY} />
          <input type="hidden" name="from_name" value={CONTENT.site.fullName} />
          <input
            type="hidden"
            name="subject"
            value={`New contact form submission — ${CONTENT.site.name}`}
          />
          {/* Honeypot — bots fill it, humans don't see it */}
          <input
            type="checkbox"
            name="botcheck"
            tabIndex={-1}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        </>
      )}

      <div className="input-group">
        <label htmlFor="contact-name">{f.fields.name.label}</label>
        <input
          id="contact-name"
          name="name"
          type="text"
          placeholder={f.fields.name.placeholder}
          required
          disabled={submitting}
        />
      </div>
      <div className="input-group">
        <label htmlFor="contact-email">{f.fields.email.label}</label>
        <input
          id="contact-email"
          name="email"
          type="email"
          placeholder={f.fields.email.placeholder}
          required
          disabled={submitting}
        />
      </div>
      <div className="input-group">
        <label htmlFor="contact-type">{f.fields.type.label}</label>
        <select id="contact-type" name="project_type" disabled={submitting}>
          {f.fields.type.options.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="input-group">
        <label htmlFor="contact-message">{f.fields.message.label}</label>
        <textarea
          id="contact-message"
          name="message"
          placeholder={f.fields.message.placeholder}
          required
          disabled={submitting}
        />
      </div>

      {status === 'error' && (
        <p className="contact-form-msg contact-form-msg--error" role="alert">
          {errorMessage || 'Something went wrong. Please try again or email me directly.'}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
        data-cursor="hover"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? 'Sending…' : sent ? f.submitted : <>{f.submit} <span className="arrow"><I.arrow /></span></>}
      </button>

      {!WEB3FORMS_KEY && (
        <p className="contact-form-hint">
          Form is in preview mode — set <code>NEXT_PUBLIC_WEB3FORMS_KEY</code> to enable email
          delivery. See <a href="https://web3forms.com/" target="_blank" rel="noreferrer">web3forms.com</a>.
        </p>
      )}
    </form>
  );
};

export const ContactClient = () => {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (form: HTMLFormElement) => {
    // No key configured — fall back to a mailto: draft so the form is never a dead end.
    if (!WEB3FORMS_KEY) {
      const data = new FormData(form);
      const name = String(data.get('name') ?? '');
      const email = String(data.get('email') ?? '');
      const projectType = String(data.get('project_type') ?? '');
      const message = String(data.get('message') ?? '');
      const subject = encodeURIComponent(`Portfolio enquiry — ${projectType || name}`);
      const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\nProject type: ${projectType}\n\n${message}`
      );
      window.location.href = `mailto:${CONTENT.site.email}?subject=${subject}&body=${body}`;
      setStatus('sent');
      setTimeout(() => setStatus('idle'), 3500);
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const data = new FormData(form);
      const payload: Record<string, string> = {};
      data.forEach((value, key) => { payload[key] = String(value); });

      const res = await fetch(WEB3FORMS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        setStatus('sent');
        form.reset();
        setTimeout(() => setStatus('idle'), 4000);
      } else {
        setStatus('error');
        setErrorMessage(json.message || 'Unable to send right now.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Network error — please try again or email me directly.');
    }
  };

  return (
    <div className="contact-page-grid">
      <ContactInfo />
      <ContactForm
        status={status}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
      />
    </div>
  );
};
