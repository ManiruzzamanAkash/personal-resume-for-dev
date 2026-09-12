// Validates article frontmatter before `next build`.
// Catches YAML parse errors early with a clear file path — e.g. unquoted
// colons in titles (`title: Foo: bar` must be `title: "Foo: bar"`).
//
// Run from the repo root:
//   node scripts/validate-articles.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = path.resolve(__dirname, '../articles');
const INDEX_FILE = path.join(ARTICLES_DIR, 'index.json');

const readIndex = async () => {
  const text = await fs.readFile(INDEX_FILE, 'utf8');
  const parsed = JSON.parse(text);
  const list = parsed.articles || [];
  return list.map((entry) => {
    if (typeof entry === 'string') {
      return { file: entry, slug: entry.replace(/\.md$/, '') };
    }
    return {
      ...entry,
      slug: entry.slug || entry.file.replace(/\.md$/, ''),
    };
  });
};

const entries = await readIndex();
let failed = false;

for (const entry of entries) {
  const file = entry.file;
  const fullPath = path.join(ARTICLES_DIR, file);
  let raw;
  try {
    raw = await fs.readFile(fullPath, 'utf8');
  } catch {
    console.error(`✗ ${file}: file not found (listed in articles/index.json)`);
    failed = true;
    continue;
  }

  try {
    matter(raw);
  } catch (err) {
    failed = true;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${file}: invalid YAML frontmatter`);
    console.error(`  ${message}`);
    console.error('  Tip: quote values that contain colons, e.g. title: "My post: subtitle"');
  }
}

if (failed) {
  process.exit(1);
}

console.log(`✓ Validated ${entries.length} article(s)`);
