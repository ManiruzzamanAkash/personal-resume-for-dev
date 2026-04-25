# CLAUDE.md — Project guide

A static personal portfolio for **Maniruzzaman Akash**. No build step, no
framework runtime — just React + Babel-standalone in the browser, with a
file-based blog backed by Markdown.

This file is the canonical map of the project. Read it before editing.

---

## Run it locally

The site reads `articles/*.md` via `fetch()`, which won't work from `file://`.
Serve the directory over HTTP:

```bash
# Python (built-in, no install needed)
python3 -m http.server 8000

# or Node
npx serve .
```

Then open http://localhost:8000.

---

## Directory layout

```
portfolio-main/
├── CLAUDE.md                 ← you are here
├── index.html                ← entry. loads scripts in dependency order
├── styles.css                ← root stylesheet — only @imports the files in styles/
├── tweaks-panel.jsx          ← prebuilt host-aware tweaks UI (don't edit, has postMessage protocol)
├── articles/                 ← blog content
│   ├── index.json            ← list of article filenames (browsers can't list dirs)
│   └── *.md                  ← one file per post, YAML frontmatter inside
├── src/
│   ├── App.jsx               ← root component + routing
│   ├── lib.jsx               ← routing, theme, motion primitives, icons (I)
│   ├── data.js               ← SITE, PROJECTS, EXPERIENCE, SKILLS, etc.
│   ├── markdown.js           ← frontmatter parser + article loader
│   ├── components.jsx        ← Nav, Footer, ContactCTA, ContribGrid, ...
│   └── pages/
│       ├── Home.jsx
│       ├── Resume.jsx
│       ├── Blog.jsx
│       ├── Article.jsx
│       └── Contact.jsx
└── styles/                   ← per-section CSS, all imported by styles.css
    ├── tokens.css            ← design tokens, fonts, reset, base primitives
    ├── nav.css
    ├── hero.css
    ├── about.css
    ├── projects.css
    ├── skills.css
    ├── testimonials.css
    ├── contrib.css
    ├── blog.css
    ├── article.css
    ├── resume.css
    ├── contact.css
    └── footer.css
```

---

## How the runtime works (no build step)

`index.html` loads each `<script type="text/babel">` in order. Babel-standalone
compiles JSX in the browser at startup. Every file shares one global scope —
top-level `const Foo = ...` declarations are visible to later scripts.

**Implication:** load order in `index.html` matters. Dependencies must load
before consumers. The current order is:

```
1. tweaks-panel.jsx     → useTweaks, TweaksPanel, TweakRadio, ...
2. src/lib.jsx          → useHashRoute, navTo, useTheme, Cursor, Magnetic,
                          Reveal, Counter, I (icons)
3. src/data.js          → SITE, NAV_LINKS, PROJECTS, EXPERIENCE, SKILLS,
                          TESTIMONIALS, STATS, OPEN_SOURCE, MARQUEE_WORDS
4. src/markdown.js      → parseFrontmatter, fetchArticleIndex, fetchArticle,
                          fetchAllArticles, renderMarkdown
5. src/components.jsx   → Nav, Footer, ContactCTA, TestimonialCarousel,
                          ContribGrid, buildContribGrid
6. src/pages/*.jsx      → Home, ResumePage, BlogPage, ArticlePage, ContactPage
7. src/App.jsx          → mounts <App /> to #app
```

If you add a new file, slot it into `index.html` after its dependencies.

---

## Routing

Hash-based, two segments: `#/route/param`.

| URL                          | Page                 |
| ---------------------------- | -------------------- |
| `#/` or `#/home`             | Home                 |
| `#/resume`                   | Resume               |
| `#/blog`                     | Blog list            |
| `#/article/<slug>`           | Single article       |
| `#/contact`                  | Contact              |

Navigate programmatically via `navTo('blog')` or `navTo('article', 'my-slug')`.

Add a route by:
1. Creating the page component in `src/pages/`.
2. Listing the file in `index.html`.
3. Adding the conditional render in `src/App.jsx`.
4. (Optional) Adding it to `NAV_LINKS` in `src/data.js`.

---

## Adding a new article

This is the workflow you'll use most. Three steps:

### 1. Create the markdown file

Path: `articles/<slug>.md`. The filename should match the slug.

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

# My new article

Body in plain markdown. All standard GFM works:

- Lists
- **Bold** and *italic*
- [Links](https://example.com)
- `inline code` and fenced code blocks
- > blockquotes

Three dashes (`---`) for a horizontal rule.
```

**Frontmatter fields** (parsed by `src/markdown.js`):

| Field     | Required | Notes                                                  |
| --------- | -------- | ------------------------------------------------------ |
| title     | yes      | Article title.                                         |
| slug      | rec.     | URL slug. Defaults to filename without `.md`.          |
| date      | yes      | ISO date `YYYY-MM-DD`. Used for sort + display.        |
| category  | no       | Shown in list and on the article page header.          |
| excerpt   | no       | One-sentence preview shown in the list and lede.       |
| readTime  | no       | Free-form, e.g. `"8 min"`. Shown next to date.         |
| tags      | no       | Inline YAML array, e.g. `[wordpress, scaling]`.        |

The frontmatter parser is intentionally minimal — strings, quoted strings,
and inline arrays only. No nested objects, no multi-line values.

### 2. Register it in the index

Add the filename to `articles/index.json`:

```json
{
  "articles": [
    "my-new-article.md",
    "welcome-to-my-blog.md",
    ...
  ]
}
```

The order in `index.json` doesn't matter — articles are sorted by `date` desc
on render.

(Why an index file? Browsers can't list directory contents over HTTP. The
index is the only way to know which markdown files exist.)

### 3. That's it

Reload. Article appears on `/#/blog` and is reachable at `#/article/<slug>`.

---

## Editing the site content

Most copy lives in **`src/data.js`** — projects, experience, skills,
testimonials, nav links, social URLs, site name. Edit values there; pages will
re-read on next load.

Free-form prose (hero copy, About paragraphs, page headings) lives in the
relevant page component under `src/pages/`.

---

## Adding a new section to the home page

1. Add a new `Home<Section>` component at the bottom of `src/pages/Home.jsx`.
2. Slot it into the `<Home>` component's render order.
3. If it needs its own styling, create `styles/<section>.css` and import it
   from the root `styles.css`.

---

## Design tokens

All colors, spacing, fonts, radii, and shadows are CSS variables defined in
`styles/tokens.css`. Light + dark themes both live there. Don't hardcode
colors in component styles — use `var(--ink)`, `var(--paper)`, etc.

Fonts:

| Variable        | Family                    | Use                              |
| --------------- | ------------------------- | -------------------------------- |
| `--font-sans`   | Inter                     | Body, UI, buttons                |
| `--font-serif`  | Instrument Serif (italic) | Display headings, decorative     |
| `--font-mono`   | JetBrains Mono            | Code, eyebrows, dates, metadata  |

Inter is the default sans for readability. The display serif can be swapped at
runtime via the Tweaks panel (Instrument Serif, Playfair, Fraunces, Lora).

---

## Tweaks panel (host integration)

`tweaks-panel.jsx` is a prebuilt component that talks to a parent host iframe
via `postMessage` (events: `__activate_edit_mode`, `__edit_mode_set_keys`,
etc.). **Don't edit it** unless you understand the host protocol.

`useTweaks(defaults)` returns `[values, setTweak]`. Call as
`setTweak('accent', '#ff0000')` — **not** `setTweak({ accent: '#ff0000' })`.
The defaults are wrapped in `EDITMODE-BEGIN`/`EDITMODE-END` markers in
`src/App.jsx` so the host can rewrite them on disk.

---

## Conventions

- **No build, no bundler.** Keep dependencies to globals via CDN or local files.
- **Small files over big ones.** When a file passes ~300 lines, split it.
- **Data lives in `src/data.js`,** not in components. Components consume it.
- **Styles split by concern.** One CSS file per section in `styles/`.
- **CSS variables, not hardcoded colors.** Always go through tokens.
- **Hash routes, two segments max.** `#/route/param` — that's the contract.
- **No comments unless the *why* is non-obvious.** Names should explain *what*.

---

## Common changes — where to look

| What you want to do                    | File(s) to edit                                    |
| -------------------------------------- | -------------------------------------------------- |
| Update name/email/socials              | `src/data.js` → `SITE`                             |
| Add/remove a project                   | `src/data.js` → `PROJECTS`                         |
| Update job history                     | `src/data.js` → `EXPERIENCE`                       |
| Tweak skills list                      | `src/data.js` → `SKILLS`                           |
| Change nav links                       | `src/data.js` → `NAV_LINKS` + `src/App.jsx` route  |
| Edit a hero/about copy block           | `src/pages/Home.jsx`                               |
| Add a new article                      | `articles/<slug>.md` + `articles/index.json`       |
| Change article typography              | `styles/article.css`                               |
| Change colors / accent                 | `styles/tokens.css` (or live via Tweaks panel)     |
| Change fonts                           | `styles/tokens.css` → `--font-sans` / `--font-serif` |
| Add a new icon                         | `src/lib.jsx` → `I`                                |
| Add a new page                         | `src/pages/`, register in `index.html` + `App.jsx` |

---

## Known limitations

- `fetch()` of articles needs HTTP (won't work via `file://`).
- Markdown frontmatter parser is minimal — no nested objects, no multi-line
  strings. If you need richer metadata, swap in a real YAML parser.
- No syntax highlighting for code blocks. Add Prism or Shiki via CDN if needed.
- No RSS feed. Generate one from `articles/index.json` if you want one.
