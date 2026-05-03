/* ============================================================
   lib/seo.ts — Metadata + JSON-LD builders.

   Every page imports `buildMetadata()` (returns a Next.js Metadata
   object for `generateMetadata`) and the JSON-LD generators it
   needs (`personSchema`, `websiteSchema`, `breadcrumbsSchema`,
   `articleSchema`, `blogListSchema`, `profilePageSchema`,
   `faqSchema`).

   Source of truth: lib/content.ts (CONTENT.site + CONTENT.seo).
   ============================================================ */

import type { Metadata } from 'next';
import { CONTENT } from './content';
import { tmpl, tmplWith } from './tmpl';
import { categorySlug, type ArticleMeta } from './markdown';
import type { RouteId } from './content';

const ORIGIN = CONTENT.seo.url.replace(/\/+$/, '');

const absoluteUrl = (path: string): string =>
  path.startsWith('http') ? path : `${ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;

export const canonicalFor = (route: RouteId, param?: string): string => {
  // Mirror next.config.mjs `trailingSlash: true` — the actual URL Next.js
  // emits for every public route ends with `/`. If the canonical disagrees,
  // Google sees two URLs per article and picks one to dedupe to.
  if (route === 'article' && param) return `${ORIGIN}/article/${param}/`;
  const r = CONTENT.seo.routes[route];
  return `${ORIGIN}${r.path === '/' ? '/' : r.path}`;
};

/** Per-article OG image URL — Next's file-convention image at
   `app/article/[slug]/opengraph-image.tsx` is exported under this path. */
export const articleOgImage = (slug: string): string =>
  `${ORIGIN}/article/${slug}/opengraph-image`;

interface BuildMetadataOpts {
  route: RouteId;
  param?: string;
  article?: ArticleMeta;
}

/**
 * Produce the Next.js Metadata object for a given route + optional article.
 * Used inside `generateMetadata` in every page.
 */
export const buildMetadata = ({ route, param, article }: BuildMetadataOpts): Metadata => {
  const seo  = CONTENT.seo;
  const site = CONTENT.site;
  const cfg  = seo.routes[route];

  const fillArticle = (s: string): string =>
    article
      ? tmplWith(s, {
          title:    article.title,
          excerpt:  article.excerpt || article.title,
          category: article.category || '',
          date:     article.date,
          readTime: article.readTime || '',
        })
      : tmpl(s);

  const title       = fillArticle(cfg.title);
  const description = fillArticle(cfg.description);
  const url         = canonicalFor(route, param);
  const ogType      = route === 'article' ? 'article' : (cfg.type === 'profile' ? 'profile' : 'website');

  const keywords = Array.from(new Set([
    ...(cfg.keywords || []),
    ...(article?.tags || []),
    ...seo.keywords,
  ])).join(', ');

  /* Build `other` once with all per-route additions baked in — Next.js's
     Metadata type for `other` has an index signature that conflicts with
     the conditional-spread pattern, so we assemble a plain Record first
     and assign at the end. */
  const other: Record<string, string | number | (string | number)[]> = {
    'rating': 'General',
    'distribution': 'Global',
    'geo.region': 'BD-13',
    'geo.placename': 'Dhaka',
    'geo.position': '23.8103;90.4125',
    'ICBM': '23.8103, 90.4125',
  };
  if (route === 'home' || route === 'resume') {
    other['profile:first_name'] = 'Maniruzzaman';
    other['profile:last_name']  = 'Akash';
    other['profile:username']   = site.twitterHandle;
  }

  const meta: Metadata = {
    metadataBase: new URL(ORIGIN),
    title,
    description,
    keywords,
    authors: [{ name: site.fullName, url: ORIGIN }],
    creator: site.fullName,
    publisher: site.fullName,
    applicationName: site.name,
    referrer: 'strict-origin-when-cross-origin',
    formatDetection: { telephone: false },
    alternates: {
      canonical: url,
      languages: { en: url, 'x-default': url },
    },
    robots: {
      index: true, follow: true,
      googleBot: {
        index: true, follow: true,
        'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1,
      },
    },
    /* Search-engine ownership verification — emits
       <meta name="google-site-verification" content="..."> when set.
       Empty/undefined env vars are dropped by Next.js, so the tag only
       appears when NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION is configured. */
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    },
    /* No explicit `images` for any route — every route (home, resume, blog,
       contact, article) ships an `opengraph-image.tsx` file convention
       sibling, which Next.js auto-injects as both `og:image` and
       `twitter:image`. Setting images here would override that with a
       static fallback. The previous SVG fallback (`/assets/og-default.svg`)
       was unrenderable on LinkedIn / X / Slack / iMessage anyway. */
    openGraph:
      route === 'article' && article
        ? {
            title, description, url,
            siteName: site.fullName,
            locale: seo.locale,
            type: 'article',
            publishedTime: article.date,
            modifiedTime:  article.date,
            authors: [ORIGIN],
            tags: article.tags,
            section: article.category,
          }
        : {
            title, description, url,
            siteName: site.fullName,
            locale: seo.locale,
            type: ogType as 'website' | 'profile',
          },
    twitter: {
      card: 'summary_large_image',
      title, description,
      site:    site.twitterHandle ? `@${site.twitterHandle}` : undefined,
      creator: site.twitterHandle ? `@${site.twitterHandle}` : undefined,
    },
    other,
  };

  return meta;
};

/* ============================================================
   JSON-LD generators — emitted as <script type="application/ld+json">
   inside each page's render. Search engines parse these regardless
   of whether JS executes.
   ============================================================ */

/* Areas of expertise — exposed to crawlers + AI search via knowsAbout so
   hiring-intent queries ("senior WordPress engineer", "ecommerce platform
   engineer") can extract concrete domains. Pulled from CONTENT.skills with
   a few outcome-oriented additions that don't fit the visible stack list. */
const KNOWS_ABOUT = [
  ...new Set([
    ...CONTENT.skills.flatMap((s) => s.skills),
    'WordPress plugin architecture',
    'Laravel application architecture',
    'TALL stack (Tailwind, Alpine, Laravel, Livewire)',
    'Lara Dashboard (TALL-stack CMS)',
    'WooCommerce platform engineering',
    'SureCart core engineering',
    'Payment gateway integration',
    'Headless commerce',
    'SaaS scaling',
    'Open-source maintenance',
    'Code review and mentorship',
  ]),
];

export const personSchema = () => {
  const site = CONTENT.site;
  const sameAs = Object.values(site.socials).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type':    'Person',
    '@id':      `${ORIGIN}/#person`,
    name:        site.fullName,
    alternateName: [site.name, site.short, site.twitterHandle],
    givenName:   'Maniruzzaman',
    familyName:  'Akash',
    url:         ORIGIN,
    /* Use the real portrait so Google Knowledge Panel + rich results
       render an actual face. ogImage stays as the social-share card. */
    image:       absoluteUrl('/assets/akash-about.png'),
    jobTitle:    site.jobTitle,
    description: site.tagline,
    email:       `mailto:${site.email}`,
    nationality: site.nationality,
    address: {
      '@type':         'PostalAddress',
      addressLocality: site.address.city,
      addressRegion:   site.address.region,
      addressCountry:  site.address.country,
    },
    worksFor: {
      '@type': 'Organization',
      name:    site.worksFor.name,
      url:     site.worksFor.url,
    },
    alumniOf: { '@type': 'CollegeOrUniversity', name: site.alumniOf },
    knowsAbout: KNOWS_ABOUT,
    /* `seeks` advertises the kind of role the person is open to. Schema.org
       has no first-class "open to roles" property — `seeks` is the canonical
       way to surface intent without manufacturing freelance Service offers. */
    seeks: {
      '@type':       'Demand',
      name:          'Senior or Staff Software Engineer (full-time)',
      description:   'Senior / Staff engineering roles at product companies — WordPress, ecommerce, developer tools, AI-native SaaS, or distributed systems. Remote-first with EU/US/CA overlap; open to relocation for the right team.',
      areaServed:    'Worldwide',
    },
    sameAs,
  };
};

export const websiteSchema = () => {
  const site = CONTENT.site;
  const seo  = CONTENT.seo;
  return {
    '@context': 'https://schema.org',
    '@type':    'WebSite',
    '@id':      `${ORIGIN}/#website`,
    url:        ORIGIN,
    name:       site.fullName,
    description: site.tagline,
    inLanguage: seo.language,
    publisher:  { '@id': `${ORIGIN}/#person` },
    potentialAction: {
      '@type':       'SearchAction',
      target:        `${ORIGIN}/blog?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
};

export const breadcrumbsSchema = (route: RouteId, param?: string, article?: ArticleMeta) => {
  const items: { name: string; url: string }[] = [{ name: 'Home', url: `${ORIGIN}/` }];
  if (route === 'resume')  items.push({ name: 'Resume',  url: `${ORIGIN}/resume/`  });
  if (route === 'blog')    items.push({ name: 'Writing', url: `${ORIGIN}/blog/`    });
  if (route === 'contact') items.push({ name: 'Contact', url: `${ORIGIN}/contact/` });
  if (route === 'article') {
    items.push({ name: 'Writing', url: `${ORIGIN}/blog/` });
    /* Slot the article's category between the section and the title so
       crawlers see the same hierarchy users see in the visible breadcrumb. */
    if (article?.category) {
      items.push({
        name: article.category,
        url:  `${ORIGIN}/blog/category/${categorySlug(article.category)}/`,
      });
    }
    items.push({
      name: article?.title || param || 'Article',
      url:  `${ORIGIN}/article/${param}/`,
    });
  }
  return {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: it.url,
    })),
  };
};

export const articleSchema = (article: ArticleMeta) => {
  const url = `${ORIGIN}/article/${article.slug}/`;
  return {
    '@context': 'https://schema.org',
    '@type':    'BlogPosting',
    '@id':      `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline:        article.title,
    description:     article.excerpt || article.title,
    keywords:        (article.tags || []).join(', '),
    articleSection:  article.category,
    inLanguage:      CONTENT.seo.language,
    datePublished:   article.date,
    dateModified:    article.date,
    url,
    /* Use the per-article OG image (generated by the file convention at
       app/article/[slug]/opengraph-image.tsx) — Article rich results and
       Discover want a real article image, not a generic site fallback. */
    image:           articleOgImage(article.slug),
    author:          { '@id': `${ORIGIN}/#person` },
    publisher: {
      '@type': 'Person',
      '@id':   `${ORIGIN}/#person`,
      name:    CONTENT.site.fullName,
    },
  };
};

export const blogListSchema = (articles: ArticleMeta[]) => ({
  '@context': 'https://schema.org',
  '@type':    'Blog',
  '@id':      `${ORIGIN}/blog#blog`,
  url:        `${ORIGIN}/blog`,
  name:       'Writing — ' + CONTENT.site.fullName,
  description: CONTENT.blog.hero.lede,
  inLanguage: CONTENT.seo.language,
  publisher:  { '@id': `${ORIGIN}/#person` },
  blogPost: articles.map((a) => ({
    '@type':        'BlogPosting',
    headline:       a.title,
    description:    a.excerpt || a.title,
    url:            `${ORIGIN}/article/${a.slug}/`,
    datePublished:  a.date,
    dateModified:   a.date,
    keywords:       (a.tags || []).join(', '),
    articleSection: a.category,
    image:          articleOgImage(a.slug),
    author:         { '@id': `${ORIGIN}/#person` },
  })),
});

/* Wraps each CONTENT.testimonials entry in a schema.org Quotation
   attributed to the testimonial author and `about` the Person. We use
   `Quotation` instead of `Review` because Google's Review rich-result
   spec rejects every itemReviewed type that fits an individual (Person,
   Service, etc.) and additionally bans self-serving reviews on the same
   site as the entity. `Quotation` isn't tied to any rich-result feature,
   so Search Console doesn't validate it as a Review — but crawlers and
   AI agents can still extract these as structured social-proof signals
   attributed to a named person, about you. The `about` reference resolves
   the testimonial back to the Person graph. */
export const reviewsSchema = () => CONTENT.testimonials.map((t) => ({
  '@context': 'https://schema.org',
  '@type':    'Quotation',
  text:       t.quote,
  about:      { '@id': `${ORIGIN}/#person` },
  creator: {
    '@type':  'Person',
    name:     t.name,
    jobTitle: t.role,
  },
}));

export const profilePageSchema = () => ({
  '@context': 'https://schema.org',
  '@type':    'ProfilePage',
  '@id':      `${ORIGIN}/#profile`,
  url:        `${ORIGIN}/`,
  name:       CONTENT.site.fullName,
  inLanguage: CONTENT.seo.language,
  mainEntity: { '@id': `${ORIGIN}/#person` },
  about:      { '@id': `${ORIGIN}/#person` },
});

export const faqSchema = () => ({
  '@context': 'https://schema.org',
  '@type':    'FAQPage',
  mainEntity: CONTENT.seo.faq.map((f) => ({
    '@type': 'Question',
    name:    f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});

/** Bundle the per-route JSON-LD payloads — Person + WebSite are emitted
   once at the layout level, so this function only returns route-specific
   graphs (BreadcrumbList, Article, Blog, ProfilePage, FAQPage). */
export const collectStructuredData = (
  route: RouteId,
  param?: string,
  article?: ArticleMeta,
  articles?: ArticleMeta[],
) => {
  const out: any[] = [breadcrumbsSchema(route, param, article)];
  if (route === 'home') {
    out.push(profilePageSchema(), faqSchema(), ...reviewsSchema());
  } else if (route === 'resume') {
    out.push(profilePageSchema(), ...reviewsSchema());
  } else if (route === 'blog') {
    if (articles?.length) out.push(blogListSchema(articles));
  } else if (route === 'contact') {
    out.push(faqSchema(), ...reviewsSchema());
  } else if (route === 'article' && article) {
    out.push(articleSchema(article));
  }
  return out;
};
