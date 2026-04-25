import type { MetadataRoute } from 'next';
import { CONTENT } from '@/lib/content';

const ORIGIN = CONTENT.seo.url.replace(/\/+$/, '');

/**
 * /robots.txt — Next.js writes this at build time. We allow every
 * well-behaved crawler (including AI training bots like GPTBot,
 * ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended) since the
 * portfolio is intentionally public. Remove individual entries if you
 * later decide to opt out of AI training.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*',                  allow: '/' },
      { userAgent: 'GPTBot',             allow: '/' },
      { userAgent: 'ClaudeBot',          allow: '/' },
      { userAgent: 'anthropic-ai',       allow: '/' },
      { userAgent: 'PerplexityBot',      allow: '/' },
      { userAgent: 'Google-Extended',    allow: '/' },
      { userAgent: 'Googlebot-Image',    allow: '/' },
    ],
    sitemap: `${ORIGIN}/sitemap.xml`,
    host: ORIGIN,
  };
}
