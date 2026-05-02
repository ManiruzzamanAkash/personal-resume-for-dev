import Link from 'next/link';
import { getAllArticles, type ArticleMeta } from '@/lib/markdown';
import { I } from './icons';

/* Curated picks first — these are the essays a senior hiring manager will
   read end-to-end and remember (judgment, taste, architecture). Recency
   alone surfaces meta posts and time-bound platform comparisons; the
   curated list keeps the homepage signaling at staff level. Fill the
   remaining slots with the most recent unique articles. */
const FEATURED_SLUGS = [
  'trading-fast-hands-for-trusted-judgment',
  'the-slow-way-to-become-an-engineer-whose-opinion-changes-rooms',
  'solid-principles-for-wordpress-plugins',
];

const pickHomepageArticles = (all: ArticleMeta[], n = 3): ArticleMeta[] => {
  const bySlug = new Map(all.map((a) => [a.slug, a]));
  const seen = new Set<string>();
  const out: ArticleMeta[] = [];
  for (const slug of FEATURED_SLUGS) {
    const a = bySlug.get(slug);
    if (a && !seen.has(slug)) {
      out.push(a);
      seen.add(slug);
      if (out.length === n) return out;
    }
  }
  for (const a of all) {
    if (seen.has(a.slug)) continue;
    out.push(a);
    seen.add(a.slug);
    if (out.length === n) return out;
  }
  return out;
};

export const HomeWriting = async () => {
  const all = await getAllArticles();
  const picks = pickHomepageArticles(all.map((a) => a.meta), 3);
  if (picks.length === 0) return null;

  return (
    <section className="page home-writing-section" style={{ paddingTop: 80 }}>
      <div className="section-head">
        <div>
          <span className="eyebrow">Recent writing</span>
          <h2 className="home-writing-heading">
            Notes on <em>building</em> for the long haul.
          </h2>
        </div>
        <Link href="/blog/" className="btn btn-ghost" data-cursor="hover">
          All writing <span className="arrow"><I.arrowUp /></span>
        </Link>
      </div>

      <ul className="home-writing-grid">
        {picks.map((a) => (
          <li key={a.slug} className="home-writing-card">
            <Link
              href={`/article/${a.slug}/`}
              className="home-writing-link"
              data-cursor="hover"
              aria-label={`Read article: ${a.title}`}
            >
              {a.category && <span className="home-writing-cat">{a.category}</span>}
              <h3 className="home-writing-title">{a.title}</h3>
              {a.excerpt && <p className="home-writing-excerpt">{a.excerpt}</p>}
              <span className="home-writing-more">
                Read <I.arrowUp />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
