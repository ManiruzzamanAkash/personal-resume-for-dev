/* Per-article OG image — generated at build time via Next.js's
   file convention. One PNG per article, picked up automatically by
   <meta property="og:image"> and <meta name="twitter:image"> on
   /article/<slug>/. The previous fallback was a single shared SVG,
   which renders inconsistently on Twitter / LinkedIn / Slack.

   Note for editors: do NOT add JSX comments inside the returned tree
   below — Satori (the engine behind ImageResponse) treats comment
   nodes as extra children and bails on any <div> without an explicit
   display value. Keep prose comments here, outside the JSX. */

import { ImageResponse } from 'next/og';
import { CONTENT } from '@/lib/content';
import { getAllArticleSlugs, getArticle } from '@/lib/markdown';

export const alt = 'Article preview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export async function generateStaticParams() {
  const slugs = await getAllArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  const meta = article?.meta;

  const title    = meta?.title    || 'Article';
  const category = meta?.category || 'Writing';
  const readTime = meta?.readTime || '';
  const date     = meta?.date     || '';

  const accent = CONTENT.seo.themeColor;
  const author = CONTENT.site.fullName;

  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : 'maniruzzaman.me';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0b',
          color: '#fafafa',
          padding: '72px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: 8,
            background: accent,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div
            style={{
              display: 'flex',
              padding: '8px 18px',
              borderRadius: 999,
              background: accent,
              color: '#fff',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            {category}
          </div>
          {readTime ? (
            <div style={{ display: 'flex', fontSize: 22, color: '#a1a1aa' }}>
              {readTime} read
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -1,
            marginBottom: 'auto',
            maxWidth: 1056,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 40,
            paddingTop: 32,
            borderTop: '1px solid #27272a',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 600 }}>{author}</div>
            <div style={{ display: 'flex', fontSize: 20, color: '#a1a1aa' }}>
              Freelance WordPress & Ecommerce Engineer
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              color: accent,
              fontWeight: 600,
              fontFamily: 'monospace',
            }}
          >
            {formattedDate}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
