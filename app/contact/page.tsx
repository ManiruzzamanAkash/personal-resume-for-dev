import type { Metadata } from 'next';
import { CONTENT } from '@/lib/content';
import { buildMetadata, collectStructuredData } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Rich } from '@/components/Rich';
import { Reveal } from '@/components/Reveal';
import { ContactClient } from '@/components/ContactClient';

export const metadata: Metadata = buildMetadata({ route: 'contact' });

export default function ContactPage() {
  const c = CONTENT.contact.hero;
  return (
    <>
      <JsonLd graph={collectStructuredData('contact')} />
      <Nav />
      <main id="main">
        <section className="subhero">
          <span className="eyebrow">{c.eyebrow}</span>
          <Rich as="h1" text={c.heading} />
          <Rich as="p" className="lede" text={c.lede} />
        </section>

        <section className="page" style={{ paddingTop: 40 }}>
          <Reveal>
            <ContactClient />
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
