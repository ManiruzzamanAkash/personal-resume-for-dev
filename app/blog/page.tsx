import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTENT } from '@/lib/content';
import { buildMetadata, collectStructuredData } from '@/lib/seo';
import { getAllArticles, getAllCategories } from '@/lib/markdown';
import { JsonLd } from '@/components/JsonLd';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Rich, RichTitle } from '@/components/Rich';
import { Reveal } from '@/components/Reveal';
import { I } from '@/components/icons';

export const metadata: Metadata = buildMetadata({ route: 'blog' });

const formatDate = (iso: string): string => {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  return m ? `${y} — ${m}` : y;
};

export default async function BlogPage() {
  const [articles, categories] = await Promise.all([
    getAllArticles(),
    getAllCategories(),
  ]);
  const articleMetas = articles.map((a) => a.meta);
  const c = CONTENT.blog.hero;

  return (
    <>
      <JsonLd graph={collectStructuredData('blog', undefined, undefined, articleMetas)} />
      <Nav />
      <main id="main">
        <section className="subhero">
          <span className="eyebrow">{c.eyebrow}</span>
          <RichTitle text={c.heading} />
          <Rich as="p" className="lede" text={c.lede} />

          {categories.length > 0 && (
            <nav className="blog-categories" aria-label="Filter by category">
              <span className="blog-categories-label">Topics</span>
              <ul>
                {categories.map((cat) => (
                  <li key={cat.slug}>
                    <Link
                      href={`/blog/category/${cat.slug}/`}
                      data-cursor="hover"
                      className="blog-cat-chip"
                    >
                      {cat.name}
                      <span className="blog-cat-count">{cat.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </section>

        <section className="page" style={{ paddingTop: 40 }}>
          <Reveal>
            {articles.length === 0 ? (
              <div className="blog-empty">{CONTENT.blog.empty}</div>
            ) : (
              <>
                <div className="blog-list">
                  {articles.map((a) => (
                    <Link
                      key={a.meta.slug}
                      className="blog-row"
                      href={`/article/${a.meta.slug}/`}
                      data-cursor="hover"
                      aria-label={`Read article: ${a.meta.title}`}
                    >
                      <time className="date" dateTime={a.meta.date}>{formatDate(a.meta.date)}</time>
                      <div>
                        <div className="title">{a.meta.title}</div>
                        {a.meta.excerpt && <div className="excerpt">{a.meta.excerpt}</div>}
                      </div>
                      <span className="cat">{a.meta.category || ''}</span>
                      <span className="arr"><I.arrowUp /></span>
                    </Link>
                  ))}
                </div>
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em' }}>
                  {CONTENT.blog.feedEnd}
                </div>
              </>
            )}
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
