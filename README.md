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

## Make this site yours (rebrand in 5 minutes)

This template is set up so a non-developer can swap out the entire portfolio
by editing one file. Here's the canonical workflow:

### 1. Edit `src/data.js` → `CONTENT.site`

```js
site: {
  name:     'Jane Doe',
  fullName: 'Jane M. Doe',
  short:    'Jane',                  // shown in nav logo
  title:    'Senior Backend Engineer & Systems Designer',
  location: 'Berlin, Germany',
  timezone: 'CET',
  email:    'jane@example.com',
  status:   'Open to chat',          // status pill on hero
  calendly: 'https://calendly.com/jane/chat',
  socials: {
    github:        'https://github.com/janedoe',
    linkedin:      'https://linkedin.com/in/janedoe',
    youtube:       'https://www.youtube.com/@janedoe',
    stackoverflow: 'https://stackoverflow.com/users/123456/jane-doe',
  },
  contributionsLastYear: 1234,
},
```

That single change cascades everywhere: nav logo, footer, mailto links,
GitHub buttons, the hero subtext (uses `{fullName}` token), `{email}` in
contact links — all auto-update.

### 2. Replace structured data

Each list is an array of plain objects. Empty an array to hide its section.

```js
projects:    [...]   // replace with your work
experience:  [...]   // your job history
skills:      [...]   // your tech clusters
testimonials:[...]   // your LinkedIn recommendations
openSource:  [...]   // your repos / contributions
stats:       [...]   // your headline numbers
marqueeWords:[...]   // tags scrolling across the hero
```

Field shapes are documented in [CLAUDE.md](./CLAUDE.md#editing-the-site-content).

### 3. Rewrite the prose

Five blocks under `CONTENT.*` hold every word of editable copy:

```js
home:    { hero, about, sections, contactCta }
resume:  { hero, aside, sections }
blog:    { hero, loading, feedEnd, empty, error }
article: { backLabel, replyLabel, notFoundHead }
contact: { hero, summary, links, form }
footer:  { copyright, links }
```

Use `*italic*` for accent words and `**bold**` for emphasis. The hero title
splits on `\n` for line breaks and animates each word in sequence.

### 4. Swap the colors / fonts (optional)

Open [`styles/tokens.css`](./styles/tokens.css):

```css
:root {
  --primary: #8345dd;     /* accent color (italic words, links, CTAs) */
  --secondary: #ff5b04;   /* secondary blob in hero */
  --font-sans:  "Inter",            ...;
  --font-serif: "Instrument Serif", ...;
  --font-mono:  "JetBrains Mono",   ...;
}

[data-theme="dark"] { ... }
```

Or use the live Tweaks panel (handed to a host iframe) to adjust accent and
display serif at runtime — no edit required.

### 5. Replace the articles

Delete the markdown files in `articles/` and write your own. Update
`articles/index.json` with the new filenames. The blog list and article
view auto-render from there.

### Hide a section entirely

Easiest: empty the array.

```js
testimonials: [],   // testimonials carousel hides itself
projects: [],       // projects list shows nothing
```

For full removal of a section, comment out its component call in the
relevant page file under `src/pages/`. The site is built so each section is
a small named component (`<HomeAbout />`, `<HomeProjects />`, etc.) — rip
out the line and rebuild your home page in any order you like.

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

**Everything visible on the site lives in one file: [`src/data.js`](./src/data.js)**.
There's a single `CONTENT` object that holds every piece of editable text,
every URL, every list. To rebrand for someone else, you only edit this
file — no JSX, no CSS, no component changes.

```js
const CONTENT = {
  site:        { name, email, socials, calendly, … },
  navigation:  [...],
  projects:    [...],
  experience:  [...],
  skills:      [...],
  testimonials:[...],
  openSource:  [...],
  stats:       [...],
  marqueeWords:[...],

  // All page prose — strings flow through the <Rich /> helper:
  home:        { hero, about, sections, contactCta },
  resume:      { hero, aside, sections },
  blog:        { hero, loading, feedEnd, empty, error },
  article:     { backLabel, replyLabel, notFoundHead },
  contact:     { hero, summary, links, form },
  footer:      { copyright, links },
};
```

### Inline formatting cheat sheet

Strings in `CONTENT.*` are passed through a tiny markdown-lite parser:

| You write                         | Renders as            | Used for         |
| --------------------------------- | --------------------- | ---------------- |
| `*plugin*`                        | `<em>plugin</em>`     | accent words     |
| `**Md. Maniruzzaman Akash**`      | `<b>…</b>`            | bold emphasis    |
| `Got a *plugin* idea?\nLet's…`    | line break before "Let's" | hard newline |
| `I'm **{fullName}** — 7+ years…`  | substitutes `{fullName}` from `CONTENT.site` | keeps copy in sync |

### Action helper

Link items use `action: '<name>'` instead of hardcoded URLs. The
[`resolveAction()`](./src/lib.jsx) helper centralizes the contract.

| `action`         | Resolves to                          |
| ---------------- | ------------------------------------ |
| `mail`           | `mailto:{email}`                     |
| `calendly`       | Opens Calendly popup modal           |
| `github`         | `site.socials.github`                |
| `linkedin`       | `site.socials.linkedin`              |
| `youtube`        | `site.socials.youtube`               |
| `stackoverflow`  | `site.socials.stackoverflow`         |

### Design tokens

Colors, spacing, fonts, and both light + dark themes live in
[`styles/tokens.css`](./styles/tokens.css). Always go through CSS variables
— don't hardcode colors in component styles.

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
