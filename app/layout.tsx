import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

import { CONTENT } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { personSchema, websiteSchema } from '@/lib/seo';
import { Cursor } from '@/components/Cursor';
import { RouteProgress } from '@/components/RouteProgress';
import { Analytics } from '@/components/Analytics';

/**
 * Root metadata defaults — every page-level generateMetadata() inherits
 * these and can override individual fields. The home route's metadata is
 * applied here at the layout level.
 */
export const metadata: Metadata = buildMetadata({ route: 'home' });

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#8345dd' },
    { media: '(prefers-color-scheme: dark)',  color: '#0a0a0b' },
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/* Inline theme bootstrapper — runs before React hydrates so the chosen
   palette is applied on first paint. Without this, dark-preferring users
   would see a flash of the light theme until React mounted. The script
   sets `data-theme` on <html> only; React's useTheme() hook reads it back
   in useEffect to keep state in sync without causing a hydration mismatch. */
const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* `suppressHydrationWarning` is required on <html> because the inline
       script above mutates `data-theme` before React reconciles the tree —
       legitimate divergence, not a real bug. */
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />

        {/* Performance: preconnect early to font + Calendly origins. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://assets.calendly.com" crossOrigin="anonymous" />

        {/* Site identity icons. The PNG variants are referenced from the
            manifest; the SVG handles modern browsers + print. */}
        <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png" />
        <link rel="mask-icon" href="/assets/favicon.svg" color={CONTENT.seo.themeColor} />
        <link rel="manifest" href="/manifest.json" />

        {/* RSS feed discovery — feed readers and AI agents look for this. */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`Writing — ${CONTENT.site.fullName}`}
          href="/feed.xml"
        />

        {/* Calendly widget styles. The script is loaded with next/script
            below so it doesn't block rendering. */}
        <link rel="stylesheet" href="https://assets.calendly.com/assets/external/widget.css" />

        {/* Always-on JSON-LD: Person + WebSite. Per-route schemas are
            emitted inside each page (BreadcrumbList, Article, Blog, etc.). */}
        <JsonLd graph={[personSchema(), websiteSchema()]} />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to main content</a>
        <RouteProgress />
        {children}

        <Cursor />
        <div className="page-curtain" />

        <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="afterInteractive" />

        {/* Google Analytics 4 — no-op when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset. */}
        <Analytics />
      </body>
    </html>
  );
}
