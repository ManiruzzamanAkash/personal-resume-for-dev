'use client';

import { CONTENT } from '@/lib/content';
import { resolveAction } from '@/lib/actions';
import { openCalendly } from '@/lib/calendly';
import { tmpl } from '@/lib/tmpl';
import { Rich } from './Rich';
import { Reveal } from './Reveal';
import { Magnetic } from './Magnetic';
import { I } from './icons';

export const ContactCTA = () => {
  const c = CONTENT.home.contactCta;
  return (
    <section className="contact-block">
      <div style={{ maxWidth: 'var(--maxw)', margin: '0 auto', padding: '0 40px' }}>
        <Reveal>
          <span className="eyebrow contact-eyebrow">{c.eyebrow}</span>
          <Rich as="h2" className="contact-headline" text={c.heading} />
          <div className="contact-channels">
            {c.chips.map((chip, i) => {
              const Icon = I[chip.icon] || I.mail;
              const a = resolveAction(chip.action);
              const onClick = chip.action === 'calendly' ? openCalendly : undefined;
              return (
                <Magnetic key={i}>
                  <a
                    className="contact-chip"
                    href={a.href}
                    target={a.target}
                    rel={a.rel}
                    onClick={onClick}
                    data-cursor="hover"
                  >
                    <Icon />
                    {tmpl(chip.label)}
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
