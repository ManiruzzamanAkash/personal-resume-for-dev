import { CONTENT } from '@/lib/content';
import { getAllArticles } from '@/lib/markdown';

// Static RSS 2.0 feed for the blog. Statically prerendered so the static
// export emits /feed.xml as a flat file.
export const dynamic = 'force-static';

const ORIGIN = CONTENT.seo.url.replace(/\/+$/, '');

const escape = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const rfc822 = (iso: string): string => {
  const d = iso ? new Date(iso) : new Date();
  return (isNaN(d.getTime()) ? new Date() : d).toUTCString();
};

export async function GET() {
  const articles = await getAllArticles();
  const site = CONTENT.site;
  const seo = CONTENT.seo;

  const channelTitle = `Writing — ${site.fullName}`;
  const channelLink = `${ORIGIN}/blog/`;
  const channelDescription = site.tagline;
  const lastBuild = articles[0]?.meta.date
    ? rfc822(articles[0].meta.date)
    : new Date().toUTCString();

  const items = articles
    .map((a) => {
      const url = `${ORIGIN}/article/${a.meta.slug}/`;
      const title = escape(a.meta.title);
      const description = escape(a.meta.excerpt || a.meta.title);
      const pubDate = rfc822(a.meta.date);
      const category = a.meta.category ? `\n      <category>${escape(a.meta.category)}</category>` : '';
      return `    <item>
      <title>${title}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>${category}
      <author>${escape(site.email)} (${escape(site.fullName)})</author>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(channelTitle)}</title>
    <link>${channelLink}</link>
    <description>${escape(channelDescription)}</description>
    <language>${seo.language}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
