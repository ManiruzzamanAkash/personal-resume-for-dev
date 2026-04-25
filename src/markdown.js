/* ============================================================
   markdown.js — Article loader + frontmatter parser.

   Articles live in /articles as plain .md files with YAML
   frontmatter at the top. /articles/index.json lists which
   files to load (browsers cannot list directory contents).

   Public API:
     parseFrontmatter(text)  -> { meta, body }
     renderMarkdown(text)    -> html string (uses marked, global)
     fetchArticleIndex()     -> Promise<string[]>   filenames
     fetchArticle(filename)  -> Promise<{ meta, body, html }>
     fetchAllArticles()      -> Promise<Article[]>  (sorted desc by date)
   ============================================================ */

/**
 * Parse YAML-ish frontmatter. Supports strings, numbers, and inline arrays.
 * Frontmatter must be wrapped in --- on its own lines at the top of the file.
 */
const parseFrontmatter = (text) => {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };

  const meta = {};
  const lines = match[1].split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    // Inline array: [a, b, "c"]
    if (value.startsWith('[') && value.endsWith(']')) {
      meta[key] = value.slice(1, -1)
        .split(',')
        .map(v => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      continue;
    }

    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    meta[key] = value;
  }

  return { meta, body: match[2] };
};

/**
 * Render markdown to HTML using the global `marked` library.
 * Falls back to plain text wrapped in <pre> if marked isn't loaded yet.
 */
const renderMarkdown = (md) => {
  if (typeof marked === 'undefined') {
    return `<pre>${md.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>`;
  }
  return marked.parse(md, { gfm: true, breaks: false });
};

const fetchArticleIndex = async () => {
  const res = await fetch('articles/index.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load articles index (${res.status})`);
  const data = await res.json();
  return data.articles || [];
};

/**
 * Strip a leading H1 from markdown body. The title lives in frontmatter and
 * is rendered separately, so duplicating `# Title` at the top of the body is
 * a no-op visually — strip it so authors can write naturally either way.
 */
const stripLeadingH1 = (md) => md.replace(/^\s*#\s+[^\n]+\n+/, '');

const fetchArticle = async (filename) => {
  const res = await fetch(`articles/${filename}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${filename} (${res.status})`);
  const text = await res.text();
  const { meta, body } = parseFrontmatter(text);
  const cleanBody = stripLeadingH1(body);
  return {
    meta: { ...meta, filename, slug: meta.slug || filename.replace(/\.md$/, '') },
    body: cleanBody,
    html: renderMarkdown(cleanBody),
  };
};

const fetchAllArticles = async () => {
  const filenames = await fetchArticleIndex();
  const articles = await Promise.all(
    filenames.map(name => fetchArticle(name).catch(err => {
      console.error(err);
      return null;
    }))
  );
  return articles
    .filter(Boolean)
    .sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || ''));
};

Object.assign(window, {
  parseFrontmatter, renderMarkdown, stripLeadingH1,
  fetchArticleIndex, fetchArticle, fetchAllArticles,
});
