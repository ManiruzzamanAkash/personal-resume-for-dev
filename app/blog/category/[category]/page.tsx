import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CONTENT } from '@/lib/content';
import {
  getAllCategories, getArticlesByCategory, getCategoryName, type ArticleMeta,
} from '@/lib/markdown';
import { JsonLd } from '@/components/JsonLd';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Reveal } from '@/components/Reveal';
import { I } from '@/components/icons';

interface Props {
  params: { category: string };
}

const ORIGIN = CONTENT.seo.url.replace(/\/+$/, '');

export async function generateStaticParams() {
  const cats = await getAllCategories();
  return cats.map((c) => ({ category: c.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = await getCategoryName(params.category);
  if (!name) {
    return {
      title: 'Category not found',
      robots: { index: false, follow: false },
    };
  }
  const url = `${ORIGIN}/blog/category/${params.category}/`;
  return {
    metadataBase: new URL(ORIGIN),
    title: `${name} · Writing — ${CONTENT.site.fullName}`,
    description: `Articles by ${CONTENT.site.fullName} filed under ${name}.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${name} · Writing — ${CONTENT.site.fullName}`,
      description: `Articles by ${CONTENT.site.fullName} filed under ${name}.`,
      url,
      siteName: CONTENT.site.fullName,
      type: 'website',
      locale: CONTENT.seo.locale,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} · Writing — ${CONTENT.site.fullName}`,
      description: `Articles by ${CONTENT.site.fullName} filed under ${name}.`,
    },
  };
}

const formatDate = (iso: string): string => {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  return m ? `${y} — ${m}` : y;
};

export default async function CategoryPage({ params }: Props) {
  const name = await getCategoryName(params.category);
  if (!name) notFound();

  const articles = await getArticlesByCategory(params.category);
  const articleMetas = articles.map((a) => a.meta) as ArticleMeta[];

  /* Per-page CollectionPage + ItemList JSON-LD so the category page
     ranks for "<category> · Writing" queries on its own. */
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${ORIGIN}/blog/category/${params.category}/#collection`,
    url: `${ORIGIN}/blog/category/${params.category}/`,
    name: `${name} · Writing — ${CONTENT.site.fullName}`,
    isPartOf: { '@id': `${ORIGIN}/#website` },
    about: name,
    inLanguage: CONTENT.seo.language,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: articleMetas.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${ORIGIN}/article/${a.slug}/`,
        name: a.title,
      })),
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',    item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Writing', item: `${ORIGIN}/blog/` },
      { '@type': 'ListItem', position: 3, name,            item: `${ORIGIN}/blog/category/${params.category}/` },
    ],
  };

  return (
    <>
      <JsonLd graph={[collectionSchema, breadcrumbSchema]} />
      <Nav />
      <main id="main">
        <section className="subhero">
          <Breadcrumb
            items={[
              { label: 'Home',    href: '/' },
              { label: 'Writing', href: '/blog/' },
              { label: name },
            ]}
          />
          <span className="eyebrow">Category</span>
          <h1>
            <em style={{ fontStyle: 'italic', color: 'var(--primary)' }}>{name}</em>
          </h1>
          <p className="lede">
            {articles.length === 1 ? '1 article' : `${articles.length} articles`} filed under <em>{name}</em>.
          </p>
        </section>

        <section className="page" style={{ paddingTop: 40 }}>
          <Reveal>
            {articles.length === 0 ? (
              <div className="blog-empty">No articles in this category yet.</div>
            ) : (
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
            )}
          </Reveal>

          <div style={{ marginTop: 40 }}>
            <Link className="btn btn-ghost" href="/blog/" data-cursor="hover">
              <I.arrowLeft /> All articles
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
