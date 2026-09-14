import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CONTENT, type ProductWorkItem } from '@/lib/content';
import { pathFor } from '@/lib/routing';
import { buildMetadata, collectStructuredData } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Rich, RichTitle } from '@/components/Rich';
import { Reveal } from '@/components/Reveal';
import { Magnetic } from '@/components/Magnetic';
import { I } from '@/components/icons';

export const metadata: Metadata = buildMetadata({ route: 'projects' });

const ExternalLinkIcon = () => (
  <span className="proj-card-arrow" aria-hidden="true">
    <I.arrowUp />
  </span>
);

const ProductCard = ({
  name,
  desc,
  tags,
  href,
  image,
  year,
  color,
  initial,
  index,
}: ProductWorkItem & { index: number }) => {
  const media = image ? (
    <Image
      src={image}
      alt=""
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
      className="proj-card-img"
    />
  ) : (
    <div
      className="proj-card-mark"
      style={{
        background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${color ?? 'var(--primary)'} 75%, white), ${color ?? 'var(--primary)'})`,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );

  const body = (
    <>
      <div className="proj-card-media">{media}</div>
      <div className="proj-card-body">
        <div className="proj-card-top">
          <h3 className="proj-card-title">{name}</h3>
          {href && <ExternalLinkIcon />}
        </div>
        {year && <div className="proj-card-year">{year}</div>}
        <p className="proj-card-desc">{desc}</p>
        <div className="proj-card-tags">
          {tags.map((t) => (
            <span key={t} className="proj-chip">{t}</span>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <Reveal delay={(index % 6) * 50} as="article" className="proj-card">
      {href ? (
        <a
          className="proj-card-link"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-cursor="hover"
          aria-label={`${name} — open live site`}
        >
          {body}
        </a>
      ) : (
        <div className="proj-card-link is-static">{body}</div>
      )}
    </Reveal>
  );
};

export default function ProjectsPage() {
  const c = CONTENT.projectsPage;

  return (
    <>
      <JsonLd graph={collectStructuredData('projects')} />
      <Nav />
      <main id="main">
        <section className="subhero">
          <span className="eyebrow">{c.hero.eyebrow}</span>
          <RichTitle text={c.hero.heading} />
          <Rich as="p" className="lede" text={c.hero.lede} />
          <div className="proj-hero-actions">
            <Magnetic>
              <a className="btn btn-ghost" href="#product-work" data-cursor="hover">
                View work
              </a>
            </Magnetic>
            <Magnetic>
              <Link className="btn btn-primary" href={pathFor('contact')} data-cursor="hover">
                Get in touch <span className="arrow"><I.arrow /></span>
              </Link>
            </Magnetic>
          </div>
        </section>

        <section id="product-work" className="page proj-section" aria-labelledby="product-work-heading">
          <Reveal>
            <div className="section-head">
              <div>
                <span className="eyebrow">{c.products.eyebrow}</span>
                <Rich as="h2" id="product-work-heading" text={c.products.heading} />
              </div>
              <span className="count">
                {String(CONTENT.productWork.length).padStart(2, '0')} products
              </span>
            </div>
            <p className="proj-section-lead">{c.products.lead}</p>
          </Reveal>

          <div className="proj-grid">
            {CONTENT.productWork.map((p, i) => (
              <ProductCard key={p.id} {...p} index={i} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
