# Maniruzzaman Akash — Portfolio

A static, build-step-free personal portfolio with a file-based markdown blog,
hash routing, syntax highlighting, and a Calendly booking modal.

> **Live:** _(deploy URL)_
> **Source:** this repo
> **Author guide:** see [CLAUDE.md](./CLAUDE.md) — file map, conventions,
> where-to-edit table, and the article-publishing workflow.

---

## How it works

There is **no build step** and **no framework runtime**. The site is plain
HTML, CSS, and JSX served as static files:

- **React 18** + **Babel-standalone** load from a CDN at runtime. Babel
  transpiles each `<script type="text/babel">` in the browser before mounting.
- **Hash-based routing** (`#/route` or `#/route/param`) — no server-side
  rewrite needed. Works on any static host.
- **Articles** are plain `.md` files in `articles/`, with YAML frontmatter at
  the top of each file. A small index file (`articles/index.json`) lists which
  files exist (browsers can't list directory contents over HTTP).
- **Markdown** is rendered with [marked](https://github.com/markedjs/marked).
- **Syntax highlighting** uses [Prism](https://prismjs.com/) with a custom
  token theme that respects light + dark mode.
- **Calendly** popup loads via Calendly's public widget script.

The trade-off: every visitor pays a one-time Babel transform cost on first
load (~150ms on a fast connection). Worth it for the editing speed — change
a file, reload, see the result. No bundler, no `npm install`, no waiting.

---

## Run locally

The articles fetch over HTTP, so `file://` won't work. Serve the directory
with any static server:

```bash
# Python (built-in)
python3 -m http.server 8000

# Node (one-off, no install)
npx serve .

# Or any other static server you like
```

Open http://localhost:8000.

There is **no `npm install`** to run, no watcher, no dev script. Edit any
file in `src/`, `styles/`, or `articles/` and reload the page.

---

## Project structure (short)

```
.
├── index.html              # entry, loads scripts in dependency order
├── styles.css              # root — only @imports per-section files
├── tweaks-panel.jsx        # prebuilt host-aware tweaks UI (don't edit)
├── articles/               # blog content
│   ├── index.json          # which .md files to load
│   └── *.md                # one file per post, YAML frontmatter inside
├── src/
│   ├── App.jsx             # root component + routing
│   ├── lib.jsx             # routing, theme, motion primitives, icons
│   ├── data.js             # SITE, PROJECTS, EXPERIENCE, SKILLS, ...
│   ├── markdown.js         # frontmatter parser + article loader
│   ├── components.jsx      # Nav, Footer, ContactCTA, ContribGrid, ...
│   └── pages/              # one file per route
│       ├── Home.jsx
│       ├── Resume.jsx
│       ├── Blog.jsx
│       ├── Article.jsx
│       └── Contact.jsx
└── styles/                 # per-section CSS, all imported by styles.css
    ├── tokens.css          # design tokens, fonts, reset
    ├── nav.css   hero.css   about.css   projects.css   skills.css
    ├── testimonials.css    contrib.css   blog.css   article.css
    └── resume.css   contact.css   footer.css
```

For the long version (load order, conventions, common-changes table, and
the article workflow), read [CLAUDE.md](./CLAUDE.md).

---

## Adding a new article

Three steps, no rebuild:

1. Create `articles/<slug>.md`:

   ```markdown
   ---
   title: My new article
   slug: my-new-article
   date: 2026-04-30
   category: Engineering
   excerpt: One-sentence summary that shows up in the blog list.
   readTime: 5 min
   tags: [wordpress, php]
   ---

   Body in plain markdown. GFM features (lists, code blocks, tables, links)
   all work.
   ```

2. Add the filename to `articles/index.json`:

   ```json
   { "articles": ["my-new-article.md", "..."] }
   ```

3. Reload. The article appears at `#/blog` and is reachable at
   `#/article/my-new-article`.

Frontmatter fields and how each is used are documented in
[CLAUDE.md](./CLAUDE.md#adding-a-new-article).

---

## Editing site content

Most copy lives in **`src/data.js`** as plain JS objects:

| Want to update              | Edit                              |
| --------------------------- | --------------------------------- |
| Name, email, socials        | `SITE`                            |
| Projects                    | `PROJECTS`                        |
| Job history                 | `EXPERIENCE`                      |
| Skills clusters             | `SKILLS`                          |
| Testimonials                | `TESTIMONIALS`                    |
| Stats (years, users, etc.)  | `STATS`                           |
| Open source items           | `OPEN_SOURCE`                     |
| Marquee strip words         | `MARQUEE_WORDS`                   |
| Nav link labels             | `NAV_LINKS`                       |
| Calendly booking URL        | `SITE.calendly`                   |

Free-form prose (hero copy, about paragraphs) lives in the relevant page
component under `src/pages/`.

Design tokens (colors, spacing, fonts, both light + dark themes) live in
`styles/tokens.css`. Always go through CSS variables — don't hardcode
colors in component styles.

---

## Deploy to production

Because everything is static, any static host works. Pick one:

### GitHub Pages

The simplest option. Push to GitHub, then in repo Settings → Pages, set
source to your default branch (`main`) and root folder. Done in under a
minute.

```bash
git add -A
git commit -m "Update site"
git push origin main
```

Site appears at `https://<username>.github.io/<repo-name>/`.
For a custom domain, add a `CNAME` file with your domain.

### Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod --dir .
```

Or drag-and-drop the project folder onto https://app.netlify.com/drop.
Connect a git repo for auto-deploy on push.

No `netlify.toml` is required — there is nothing to build.

### Vercel

```bash
npm i -g vercel
vercel --prod
```

Accept the defaults — Vercel detects this as a static site automatically.

### Cloudflare Pages

Connect the GitHub repo in the Cloudflare Pages dashboard. Settings:

- **Build command:** _(leave blank)_
- **Build output directory:** `/` (project root)
- **Framework preset:** None

### Plain Nginx / Apache / S3

Upload the entire project folder as-is. Make sure `.md` and `.json` files
under `articles/` are accessible (no auth, correct MIME types). Recommended
nginx snippet:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
location ~* \.(md|json)$ {
  add_header Cache-Control "no-cache";
}
```

The `try_files` rule handles deep links so `/#/article/...` works on full
page loads.

---

## Production hardening (optional)

The defaults work fine for a personal portfolio, but if you care about
shaving the first-paint:

- **Pre-compile JSX.** Use `npx babel src/ --out-dir dist/src/` and update
  `index.html` to load the compiled `.js` files. Drops Babel-standalone
  entirely (~280 KB).
- **Pin CDN URLs.** Replace `unpkg`/`cdn.jsdelivr.net` URLs with vendored
  local copies in a `vendor/` folder for offline resilience.
- **Service worker.** Cache `articles/*.md` and JSX files for offline reads.
- **Add a sitemap.** Generate `sitemap.xml` from `articles/index.json` at
  publish time (a 10-line script).

None of this is needed to deploy.

---

## Tech stack

| Area              | Choice                                              |
| ----------------- | --------------------------------------------------- |
| UI                | React 18 (CDN, dev build)                           |
| JSX transform     | Babel-standalone (in-browser)                       |
| Routing           | Hash-based, custom (`src/lib.jsx`)                  |
| Markdown          | marked 13                                           |
| Syntax highlight  | Prism 1.29 (PHP, JS, TS, JSX, Bash, JSON loaded)    |
| Booking           | Calendly widget                                     |
| Fonts             | Inter (sans), Instrument Serif (display), JetBrains Mono (code) |
| Build             | None                                                |
| Bundler           | None                                                |

---

## License

Code is MIT. Article content is © Maniruzzaman Akash, all rights reserved
(don't republish posts without asking).
