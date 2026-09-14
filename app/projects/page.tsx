import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CONTENT } from '@/lib/content';
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

/** IDs already featured as product cards — keep Platforms group deduped. */
const PRODUCT_IDS = new Set(CONTENT.productWork.map((p) => p.id));
const PLATFORM_PROJECTS = CONTENT.projects.filter((p) => !PRODUCT_IDS.has(p.id));

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
  index,
}: {
  name: string;
  desc: string;
  tags: string[];
  href: string;
  image: string;
  year?: string;
  index: number;
}) => (
  <Reveal delay={(index % 6) * 50} as="article" className="proj-card">
    <a
      className="proj-card-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-cursor="hover"
      aria-label={`${name} — open live site`}
    >
      <div className="proj-card-media">
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
          className="proj-card-img"
        />
      </div>
      <div className="proj-card-body">
        <div className="proj-card-top">
          <h3 className="proj-card-title">{name}</h3>
          <ExternalLinkIcon />
        </div>
        {year && <div className="proj-card-year">{year}</div>}
        <p className="proj-card-desc">{desc}</p>
        <div className="proj-card-tags">
          {tags.map((t) => (
            <span key={t} className="proj-chip">{t}</span>
          ))}
        </div>
      </div>
    </a>
  </Reveal>
);

const PlatformRow = ({
  name,
  desc,
  tags,
  year,
  href,
  index,
  initial,
  color,
}: {
  name: string;
  desc: string;
  tags: string[];
  year: string;
  href?: string;
  index: number;
  initial: string;
  color: string;
}) => {
  const inner = (
    <>
      <div
        className="proj-platform-mark"
        style={{
          background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${color} 75%, white), ${color})`,
        }}
        aria-hidden="true"
      >
        {initial}
      </div>
      <div className="proj-platform-body">
        <div className="proj-platform-top">
          <h3 className="proj-platform-title">{name}</h3>
          <span className="proj-platform-year">{year}</span>
        </div>
        <p className="proj-platform-desc">{desc}</p>
        <div className="proj-card-tags">
          {tags.map((t) => (
            <span key={t} className="proj-chip">{t}</span>
          ))}
        </div>
      </div>
      {href && <ExternalLinkIcon />}
    </>
  );

  return (
    <Reveal delay={index * 50} as="li" className="proj-platform-item">
      {href ? (
        <a
          className="proj-platform-row"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-cursor="hover"
          aria-label={`${name} — open`}
        >
          {inner}
        </a>
      ) : (
        <div className="proj-platform-row is-static">{inner}</div>
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
                Product work
              </a>
            </Magnetic>
            <Magnetic>
              <a className="btn btn-ghost" href="#platforms" data-cursor="hover">
                Platforms
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

        <section id="platforms" className="page proj-section" aria-labelledby="platforms-heading">
          <Reveal>
            <div className="section-head">
              <div>
                <span className="eyebrow">{c.platforms.eyebrow}</span>
                <Rich as="h2" id="platforms-heading" text={c.platforms.heading} />
              </div>
              <span className="count">
                {String(PLATFORM_PROJECTS.length).padStart(2, '0')} platforms
              </span>
            </div>
            <p className="proj-section-lead">{c.platforms.lead}</p>
          </Reveal>

          <ul className="proj-platform-list">
            {PLATFORM_PROJECTS.map((p, i) => (
              <PlatformRow key={p.id} {...p} index={i} />
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
