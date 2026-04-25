import type { MetadataRoute } from 'next';
import { CONTENT } from '@/lib/content';
import { getAllArticles, getAllCategories } from '@/lib/markdown';

const ORIGIN = CONTENT.seo.url.replace(/\/+$/, '');

/**
 * Static sitemap generator — Next.js writes this to /sitemap.xml at build
 * time. Routes come from CONTENT.seo.routes; article entries come from
 * the filesystem via getAllArticles().
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, categories] = await Promise.all([
    getAllArticles(),
    getAllCategories(),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  /* `trailingSlash: true` in next.config.mjs makes every public URL end
     in a slash. Mirror that here so sitemap entries match the canonical
     links emitted by the framework. */
  const withSlash = (path: string) => path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`;

  const routeKeys: (keyof typeof CONTENT.seo.routes)[] = ['home', 'resume', 'blog', 'contact'];
  const routeEntries: MetadataRoute.Sitemap = routeKeys.map((key) => {
    const r = CONTENT.seo.routes[key];
    const url = key === 'home' ? `${ORIGIN}/` : `${ORIGIN}${withSlash(r.path)}`;
    const lastmod = (key === 'blog' || key === 'home')
      ? (articles[0]?.meta.date || today)
      : today;
    return {
      url,
      lastModified: new Date(lastmod),
      changeFrequency: r.changefreq,
      priority: r.priority,
    };
  });

  const articleEntries: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${ORIGIN}/article/${a.meta.slug}/`,
    lastModified: new Date(a.meta.date || today),
    changeFrequency: 'yearly',
    priority: 0.7,
  }));

  /* Category index pages — newest article in the category determines
     lastmod so re-publishing doesn't make the whole index look fresh. */
  const newestPerCat: Record<string, string> = {};
  for (const a of articles) {
    if (!a.meta.category) continue;
    const slug = categories.find((c) => c.name === a.meta.category)?.slug;
    if (!slug) continue;
    if (!newestPerCat[slug] || (a.meta.date || '') > newestPerCat[slug]) {
      newestPerCat[slug] = a.meta.date || today;
    }
  }
  const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${ORIGIN}/blog/category/${c.slug}/`,
    lastModified: new Date(newestPerCat[c.slug] || today),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...routeEntries, ...categoryEntries, ...articleEntries];
}
