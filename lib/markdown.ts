/* ============================================================
   lib/markdown.ts — Server-side article reader.

   Articles live in /articles/<slug>.md with YAML frontmatter at the
   top. This module reads them at build time so generateStaticParams
   and generateMetadata can produce static HTML for every article
   without any client fetch.

   Public API (server only):
     getAllArticleSlugs()      -> string[]
     getAllArticles()          -> Article[]   (sorted desc by date)
     getArticle(slug)          -> Article | null
   ============================================================ */

import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypePrism from 'rehype-prism-plus';
import rehypeStringify from 'rehype-stringify';

const ARTICLES_DIR = path.join(process.cwd(), 'articles');
const INDEX_FILE = path.join(ARTICLES_DIR, 'index.json');

export interface ArticleMeta {
  slug: string;
  title: string;
  date: string;
  category?: string;
  excerpt?: string;
  readTime?: string;
  tags?: string[];
}

export interface Article {
  meta: ArticleMeta;
  body: string;
  html: string;
}

/* The markdown renderer is reusable; built once per process. */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypePrism, { ignoreMissing: true })
  .use(rehypeStringify, { allowDangerousHtml: true });

const renderMarkdown = async (md: string): Promise<string> => {
  const result = await processor.process(md);
  return String(result);
};

/* Strip a duplicated leading H1: title lives in frontmatter and the page
   renders it separately, so `# Title` at the top of the body becomes a
   visual duplicate. Drop it so authors can write either way. */
const stripLeadingH1 = (md: string): string => md.replace(/^\s*#\s+[^\n]+\n+/, '');

/* YAML parses unquoted ISO dates (e.g. `date: 2026-04-26`) as JS Date
   objects. `String(date)` then emits the platform `toString()` form
   ("Sun Apr 26 2026 06:00:00 GMT+0600 …") which (a) is not valid for
   schema.org `datePublished`, and (b) breaks lexicographic sort, putting
   the feed and blog list in arbitrary order. Normalise to ISO `YYYY-MM-DD`
   on read so every consumer downstream sees the same shape. */
const toIsoDate = (raw: unknown): string => {
  if (!raw) return '';
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? '' : raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
};

interface IndexEntry {
  file: string;
  slug?: string;
  title?: string;
  date?: string;
  category?: string;
  excerpt?: string;
}

const readIndex = async (): Promise<IndexEntry[]> => {
  const text = await fs.readFile(INDEX_FILE, 'utf8');
  const parsed = JSON.parse(text);
  const list: (string | IndexEntry)[] = parsed.articles || [];
  return list.map((entry) => {
    if (typeof entry === 'string') {
      return { file: entry, slug: entry.replace(/\.md$/, '') };
    }
    return { ...entry, slug: entry.slug || entry.file.replace(/\.md$/, '') };
  });
};

export const getAllArticleSlugs = async (): Promise<string[]> => {
  const entries = await readIndex();
  return entries.map((e) => e.slug!).filter(Boolean);
};

const readArticleFile = async (slug: string, file?: string): Promise<Article | null> => {
  const filename = file || `${slug}.md`;
  const fullPath = path.join(ARTICLES_DIR, filename);
  let raw: string;
  try {
    raw = await fs.readFile(fullPath, 'utf8');
  } catch {
    return null;
  }
  const { data, content } = matter(raw);
  const body = stripLeadingH1(content);
  const html = await renderMarkdown(body);

  /* gray-matter parses YAML inline arrays for tags etc. — surface them
     with a stable shape so consumers don't need to know the format. */
  const meta: ArticleMeta = {
    slug:     (data.slug as string) || slug,
    title:    String(data.title ?? slug),
    date:     toIsoDate(data.date),
    category: data.category != null ? String(data.category) : undefined,
    excerpt:  data.excerpt  != null ? String(data.excerpt)  : undefined,
    readTime: data.readTime != null ? String(data.readTime) : undefined,
    tags:     Array.isArray(data.tags) ? data.tags.map(String) : undefined,
  };

  return { meta, body, html };
};

export const getArticle = async (slug: string): Promise<Article | null> => {
  const entries = await readIndex();
  const match = entries.find((e) => e.slug === slug);
  return readArticleFile(slug, match?.file);
};

export const getAllArticles = async (): Promise<Article[]> => {
  const entries = await readIndex();
  const articles = await Promise.all(
    entries.map((e) => readArticleFile(e.slug!, e.file))
  );
  return articles
    .filter((a): a is Article => a != null)
    .sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || ''));
};

/* ============================================================
   Categories — derived from article frontmatter, used to power
   /blog/category/<slug>/ pages and the article-page breadcrumb.
   ============================================================ */

export interface Category {
  slug: string;
  name: string;
  count: number;
}

/** Slugify a free-form category name into a URL-safe segment. */
export const categorySlug = (raw: string): string =>
  raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Unique categories present across all published articles, with counts. */
export const getAllCategories = async (): Promise<Category[]> => {
  const articles = await getAllArticles();
  const map = new Map<string, Category>();
  for (const a of articles) {
    const name = a.meta.category;
    if (!name) continue;
    const slug = categorySlug(name);
    const existing = map.get(slug);
    if (existing) existing.count++;
    else map.set(slug, { slug, name, count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

/** All articles whose frontmatter category slugs to the given segment. */
export const getArticlesByCategory = async (slug: string): Promise<Article[]> => {
  const articles = await getAllArticles();
  return articles.filter((a) => a.meta.category && categorySlug(a.meta.category) === slug);
};

/** Resolve a category slug back to its display name (first article wins). */
export const getCategoryName = async (slug: string): Promise<string | null> => {
  const cats = await getAllCategories();
  return cats.find((c) => c.slug === slug)?.name ?? null;
};
