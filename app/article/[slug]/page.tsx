import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CONTENT } from '@/lib/content';
import { buildMetadata, collectStructuredData } from '@/lib/seo';
import { getAllArticleSlugs, getArticle, categorySlug } from '@/lib/markdown';
import { JsonLd } from '@/components/JsonLd';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Breadcrumb } from '@/components/Breadcrumb';
import { ArticleProse } from '@/components/ArticleProse';
import { RichTitle } from '@/components/Rich';
import { I } from '@/components/icons';

interface Props {
  params: { slug: string };
}

/* ---------- Static rendering ---------- */

export async function generateStaticParams() {
  const slugs = await getAllArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

/* Lock the build to the static set — surfacing 404 for unknown slugs at
   build time instead of trying to render dynamically. */
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle(params.slug);
  if (!article) return buildMetadata({ route: 'blog' });
  return buildMetadata({ route: 'article', param: params.slug, article: article.meta });
}

const formatLongDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default async function ArticlePage({ params }: Props) {
  const article = await getArticle(params.slug);
  if (!article) notFound();
  const { meta, html } = article;

  const catSlug = meta.category ? categorySlug(meta.category) : null;
  const catHref = catSlug ? `/blog/category/${catSlug}/` : null;

  const crumbs = [
    { label: 'Home',    href: '/' },
    { label: 'Writing', href: '/blog/' },
    ...(meta.category && catHref ? [{ label: meta.category, href: catHref }] : []),
    { label: meta.title },
  ];

  return (
    <>
      <JsonLd graph={collectStructuredData('article', params.slug, meta)} />
      <Nav />
      <main id="main">
        <article className="article" itemScope itemType="https://schema.org/BlogPosting">
          <link itemProp="mainEntityOfPage" href={`${CONTENT.seo.url.replace(/\/+$/, '')}/article/${meta.slug}`} />
          <meta itemProp="author" content={CONTENT.site.fullName} />

          <Breadcrumb items={crumbs} />

          <div className="article-meta">
            {meta.category && catHref ? (
              <Link className="cat" href={catHref} itemProp="articleSection" data-cursor="hover">
                {meta.category}
              </Link>
            ) : meta.category ? (
              <span className="cat" itemProp="articleSection">{meta.category}</span>
            ) : null}
            {meta.category && meta.date && <span className="dot" />}
            {meta.date && (
              <time dateTime={meta.date} itemProp="datePublished">{formatLongDate(meta.date)}</time>
            )}
            {meta.readTime && <span className="dot" />}
            {meta.readTime && <span>{meta.readTime} read</span>}
          </div>

          <RichTitle className="article-title" text={meta.title} itemProp="headline" />

          {meta.excerpt && <p className="article-excerpt" itemProp="description">{meta.excerpt}</p>}

          <ArticleProse html={html} />

          <div className="article-footer">
            <Link className="btn btn-ghost" href="/blog" data-cursor="hover">
              <I.arrowLeft /> {CONTENT.article.backLabel}
            </Link>
            <a
              className="btn btn-primary"
              href={`mailto:${CONTENT.site.email}?subject=${encodeURIComponent('Re: ' + meta.title)}`}
              data-cursor="hover"
            >
              {CONTENT.article.replyLabel} <span className="arrow"><I.arrow /></span>
            </a>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
