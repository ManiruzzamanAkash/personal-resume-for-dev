/* Shared Satori card for per-route opengraph-image.tsx files.
   Each route imports renderRouteOg() with its own copy and wraps the
   returned ReactElement in `new ImageResponse(...)`. Visual language
   matches app/article/[slug]/opengraph-image.tsx so social previews
   feel like one set, not five.

   IMPORTANT: every <div> needs an explicit `display` value — Satori
   throws on bare divs without one. Don't add JSX comments inside the
   returned tree; Satori treats them as extra children and bails. */

import { CONTENT } from './content';

export interface RouteOgProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

/* Strip the `*emphasis*` / `**bold**` markers from CONTENT copy so the
   raw markdown doesn't render as literal asterisks in the OG image. */
const stripMarkdown = (s: string): string =>
  s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png' as const;

export const renderRouteOg = ({ eyebrow, title, subtitle }: RouteOgProps) => {
  const accent = CONTENT.seo.themeColor;
  const author = CONTENT.site.fullName;
  const role   = CONTENT.site.jobTitle;
  const cleanTitle    = stripMarkdown(title);
  const cleanSubtitle = subtitle ? stripMarkdown(subtitle) : '';

  return (
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
          {eyebrow}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: -1.5,
          marginBottom: cleanSubtitle ? 24 : 'auto',
          maxWidth: 1056,
        }}
      >
        {cleanTitle}
      </div>
      {cleanSubtitle ? (
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            lineHeight: 1.35,
            color: '#d4d4d8',
            marginBottom: 'auto',
            maxWidth: 1056,
          }}
        >
          {cleanSubtitle}
        </div>
      ) : null}
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
          <div style={{ display: 'flex', fontSize: 20, color: '#a1a1aa' }}>{role}</div>
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
          maniruzzaman.me
        </div>
      </div>
    </div>
  );
};
