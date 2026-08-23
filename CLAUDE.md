# CLAUDE.md — Project guide

A static personal portfolio for **Md. Maniruzzaman Akash**, built with
**Next.js 14 (App Router) + TypeScript** and statically exported. The
production site is deployed to **GitHub Pages** at
[`maniruzzaman.me`](https://maniruzzaman.me) via the workflow in
[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml). The
`out/` directory works on any static host (Vercel, Cloudflare Pages,
Netlify, S3 + CloudFront) — see the **Deploy** section below.

This file is the canonical map of the project. Read it before editing.
Also read [`AGENTS.md`](./AGENTS.md) for git authorship rules that apply to every coding agent.

---

## Run it locally

```bash
npm install
npm run dev          # → http://localhost:3000
```

Build + verify the static export:

```bash
npm run build        # writes out/
npx serve out        # smoke-test the export locally
```

The `dev` server hot-reloads. The `build` step pre-renders every public
route — including each article — into static HTML, so the deployed site
is indexable without ever executing JavaScript.

---

## Directory layout

```
portfolio-main/
├── CLAUDE.md                 ← you are here
├── AGENTS.md                 ← git authorship + agent rules
├── README.md
├── package.json              ← Next.js + React + remark + gray-matter
├── tsconfig.json
├── next.config.mjs           ← static export, trailingSlash, etc.
├── next-env.d.ts
├── .github/workflows/
│   └── deploy.yml            ← GitHub Pages CI (build + publish out/)
├── articles/                 ← markdown blog content
│   ├── index.json            ← ordered list of articles + metadata
│   └── *.md                  ← one file per post
├── public/                   ← served from / (favicon, og image, manifest)
│   ├── assets/
│   │   ├── favicon.svg
│   │   ├── og-default.svg
│   │   ├── apple-touch-icon.png
│   │   ├── akash-avatar.jpg
│   │   └── akash-about.jpg
│   ├── screenshots/          ← README screenshots (dark + light)
│   └── manifest.json
├── styles/                   ← per-section CSS, imported via app/globals.css
│   ├── tokens.css            ← design tokens, fonts, both themes
│   ├── nav.css   hero.css   about.css   projects.css   skills.css
│   ├── testimonials.css   contrib.css   blog.css   article.css
│   ├── breadcrumb.css   route-progress.css
│   └── resume.css   contact.css   footer.css
├── lib/                      ← server-safe helpers + data
│   ├── content.ts            ← CONTENT (typed) — single source of truth
│   ├── seo.ts                ← buildMetadata + JSON-LD generators
│   ├── markdown.ts           ← server-only article reader + categories
│   ├── tmpl.ts               ← {token} substitution
│   ├── routing.ts            ← pathFor()
│   ├── actions.ts            ← server-safe link resolver
│   ├── calendly.ts           ← client-only openCalendly()
│   └── theme.ts              ← client useTheme() hook
├── components/               ← shared components (server + client)
│   ├── Nav.tsx               (client — route-aware active link, theme toggle)
│   ├── Footer.tsx            (server)
│   ├── Breadcrumb.tsx        (server — emits visible crumbs + JSON-LD)
│   ├── ContactCTA.tsx        (client)
│   ├── ContactClient.tsx     (client form — UI only)
│   ├── HomeHero.tsx          (client — magnetic + calendly)
│   ├── HomeProjects.tsx      (client — hover preview)
│   ├── HomeSections.tsx      (client — Marquee/Stats/About/Skills/Testimonials/Contributions)
│   ├── TestimonialCarousel.tsx (client)
│   ├── ContribGrid.tsx       (client)
│   ├── ArticleProse.tsx      (server — wraps rendered HTML with prose styles)
│   ├── Cursor.tsx            (client — custom cursor)
│   ├── RouteProgress.tsx     (client — top bar on route transitions)
│   ├── Magnetic.tsx          (client)
│   ├── Reveal.tsx            (client — IntersectionObserver fade-in)
│   ├── Counter.tsx           (client — animated stats)
│   ├── Rich.tsx              (server-safe markdown-lite renderer)
│   ├── icons.tsx             (server-safe SVG icons)
│   └── JsonLd.tsx            (server emits <script type="application/ld+json">)
└── app/                      ← App Router routes
    ├── layout.tsx            ← root <html>, global CSS, baseline JSON-LD,
    │                           inline theme bootstrap, RouteProgress, Cursor
    ├── globals.css           ← imports styles/*.css
    ├── page.tsx              ← /
    ├── resume/page.tsx       ← /resume/
    ├── blog/page.tsx         ← /blog/
    ├── blog/category/[category]/page.tsx ← /blog/category/<slug>/
    ├── contact/page.tsx      ← /contact/
    ├── article/[slug]/page.tsx          ← /article/<slug>/
    ├── article/[slug]/opengraph-image.tsx ← per-article OG image
    ├── sitemap.ts            ← /sitemap.xml (auto from articles + routes)
    ├── robots.ts             ← /robots.txt
    └── not-found.tsx         ← 404 page
```

---

## How it works

- **Static export.** `next.config.mjs` sets `output: 'export'`. `npm run build`
  writes a fully pre-rendered `out/` directory. No Node runtime is needed
  to serve it.
- **App Router.** Every page is a server component by default. Components
  marked `'use client'` are bundled separately and hydrate on the client.
- **Articles** live in `/articles/<slug>.md` with YAML frontmatter. The
  build reads them via `lib/markdown.ts` (uses `gray-matter` + `remark`)
  and emits one static `index.html` per slug under
  `out/article/<slug>/`. `generateStaticParams` enumerates them.
- **Content + SEO.** `lib/content.ts` holds the typed `CONTENT` object —
  one source of truth for site identity, route metadata, FAQ, projects,
  experience, skills, testimonials, page copy. `lib/seo.ts` reads from
  it to produce per-route Next.js `Metadata` and JSON-LD payloads.
- **Trailing slashes.** `trailingSlash: true` makes every public URL end
  with `/` — `/blog/`, `/article/welcome-to-my-blog/`. Mirror this when
  hand-writing links so canonical URLs match.

---

## Routing

| URL                              | File                                       |
| -------------------------------- | ------------------------------------------ |
| `/`                              | `app/page.tsx`                             |
| `/resume/`                       | `app/resume/page.tsx`                      |
| `/blog/`                         | `app/blog/page.tsx`                        |
| `/blog/category/<slug>/`         | `app/blog/category/[category]/page.tsx`    |
| `/contact/`                      | `app/contact/page.tsx`                     |
| `/article/<slug>/`               | `app/article/[slug]/page.tsx`              |
| `/article/<slug>/opengraph-image`| `app/article/[slug]/opengraph-image.tsx`   |
| `/sitemap.xml`                   | `app/sitemap.ts`                           |
| `/robots.txt`                    | `app/robots.ts`                            |

Add a route by creating its page file under `app/<route>/page.tsx`, then
adding entries to `CONTENT.navigation` and `CONTENT.seo.routes` in
`lib/content.ts`. The sitemap, breadcrumbs, and nav pick it up
automatically. Category pages are derived from article frontmatter at
build time — they don't need a navigation entry.

---

## Adding a new article

1. **Create `articles/<slug>.md`** with frontmatter:

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

   Body in plain markdown — GFM works, code blocks get syntax-highlighted
   via rehype-prism-plus.
   ```

2. **Register it in `articles/index.json`** (object form, kept in
   reverse-chronological order):

   ```json
   {
     "articles": [
       {
         "file":     "my-new-article.md",
         "slug":     "my-new-article",
         "title":    "My new article",
         "date":     "2026-04-30",
         "category": "Engineering",
         "excerpt":  "One-sentence summary that shows up in the blog list."
       }
     ]
   }
   ```

   Plain-string entries (`"my-new-article.md"`) are still accepted for
   back-compat — `lib/markdown.ts` falls back to parsing the file's
   frontmatter — but the object form lets the SEO engine and sitemap
   reflect content without touching every `.md` at build time.

3. Run `npm run build`. The new article gets:
   - A static page at `/article/<slug>/`
   - An entry in `/sitemap.xml`
   - An entry on the `/blog/` listing
   - An auto-derived `/blog/category/<slug>/` page if the category is new
   - A dynamic OG image at `/article/<slug>/opengraph-image`
   - Per-page metadata + Article JSON-LD with `datePublished`, `articleSection`, `keywords`

---

## Editing content

**All visible copy lives in `lib/content.ts`** under the `CONTENT` object.

- Site identity (name, email, socials, Calendly URL): `CONTENT.site`
- Per-route SEO (title, description, keywords, type): `CONTENT.seo.routes`
- Lists: `CONTENT.projects`, `.experience`, `.skills`, `.testimonials`, `.openSource`
- Prose: `CONTENT.home`, `.resume`, `.blog`, `.contact`, `.footer`

Strings flow through `<Rich />` which parses a tiny markdown-lite format:

| Marker      | Renders as            |
| ----------- | --------------------- |
| `*italic*`  | `<em>italic</em>`     |
| `**bold**`  | `<b>bold</b>`         |
| `\n`        | `<br />`              |

Plus a `{key}` placeholder syntax that substitutes against `CONTENT.site`:

```ts
"I'm **{fullName}** — 7+ years…"   // → "I'm Md. Maniruzzaman Akash — …"
"{email}"                          // → "manirujjamanakash@gmail.com"
```

### Action helper

Link items in `CONTENT.*` use `action: '<name>'` instead of hardcoded URLs.
`lib/actions.ts` maps them to `{ href, target, rel }`. For Calendly's
popup behavior, client components attach `openCalendly` from
`lib/calendly.ts` as the `onClick`.

| action            | href                            |
| ----------------- | ------------------------------- |
| `mail`            | `mailto:{email}`                |
| `calendly`        | Calendly URL (popup on click)   |
| `github`          | `site.socials.github`           |
| `linkedin`        | `site.socials.linkedin`         |
| `youtube`         | `site.socials.youtube`          |
| `stackoverflow`   | `site.socials.stackoverflow`    |

The full action set is defined as `ActionName` in `lib/content.ts`; add a
new value there + a case in `lib/actions.ts` to extend it.

---

## SEO surface

Every page produces:

- `<title>` + `<meta description>` from `CONTENT.seo.routes[<route>]`
- `<link rel="canonical">` (with trailing slash)
- Open Graph + Twitter Card tags including image, locale, type
- For `/article/<slug>/`: `og:type=article`, `article:published_time`,
  `article:section`, `article:tag`, plus a per-article OG image emitted
  by `app/article/[slug]/opengraph-image.tsx`
- JSON-LD: Person + WebSite (always, from `app/layout.tsx`), plus
  per-route schemas:
  - `/`: ProfilePage, FAQPage, BreadcrumbList
  - `/resume/`: ProfilePage, BreadcrumbList
  - `/blog/`: Blog (with all posts), BreadcrumbList
  - `/blog/category/<slug>/`: Blog (filtered), BreadcrumbList
  - `/article/<slug>/`: BlogPosting, BreadcrumbList
  - `/contact/`: FAQPage, BreadcrumbList
- `/robots.txt` (allows all major crawlers including AI bots)
- `/sitemap.xml` (auto-generated from articles + routes)

To verify: `npm run build` then open any HTML file in `out/` and search
for `og:`, `application/ld+json`, `<title>`, etc.

---

## Design tokens

All colors, spacing, fonts, radii, shadows live in `styles/tokens.css`
as CSS variables. Don't hardcode colors in component styles — use
`var(--ink)`, `var(--paper)`, etc.

Fonts:

| Variable        | Family                    | Use                              |
| --------------- | ------------------------- | -------------------------------- |
| `--font-sans`   | Inter                     | Body, UI, buttons                |
| `--font-serif`  | Instrument Serif (italic) | Display headings                 |
| `--font-mono`   | JetBrains Mono            | Code, eyebrows, dates, metadata  |

---

## Contact form (Web3Forms)

The contact form on `/contact/` posts to **[Web3Forms](https://web3forms.com)** — a
free, no-backend email-relay service. Sign-up takes about a minute and the
free tier covers 250 submissions/month with built-in spam protection. No
Node runtime, serverless function, or third-party infra needed; submissions
go straight from the browser to Web3Forms, which emails them to you.

### One-time setup (per fork)

1. Go to [web3forms.com](https://web3forms.com) and submit your email.
   You'll receive an **access key** by return mail. (No account, no
   credit card — they verify the inbox by sending the key there.)
2. Copy `.env.example` → `.env.local` and paste the key:

   ```bash
   cp .env.example .env.local
   # then edit .env.local:
   # NEXT_PUBLIC_WEB3FORMS_KEY=your-key-here
   ```

3. Run `npm run dev` and submit the form. The first submission appears
   in your inbox within seconds.

### Deploying with the key

`NEXT_PUBLIC_*` variables are inlined into the client bundle at **build
time**, so the key must be present when `npm run build` runs.

- **Local builds.** `.env.local` is read automatically — nothing else to do.
- **GitHub Pages CI.** Add `NEXT_PUBLIC_WEB3FORMS_KEY` as a repository
  secret (Settings → Secrets and variables → Actions → New secret), then
  expose it to the build step in `.github/workflows/deploy.yml`:

  ```yaml
  - run: npm run build
    env:
      NEXT_PUBLIC_WEB3FORMS_KEY: ${{ secrets.NEXT_PUBLIC_WEB3FORMS_KEY }}
  ```

- **Vercel / Netlify / Cloudflare Pages.** Add the same name + value as
  an environment variable in the project's dashboard. Redeploy once.

### How it works

- `components/ContactClient.tsx` reads `process.env.NEXT_PUBLIC_WEB3FORMS_KEY`
  and POSTs the form (as JSON) to `https://api.web3forms.com/submit`.
  Hidden fields supply the access key, a `from_name`, a `subject`, and a
  honeypot (`botcheck`) for spam.
- States: `idle → submitting → sent` on success, `error` with an inline
  message on failure. The button is disabled while submitting.
- **No key configured?** The form gracefully falls back to a `mailto:`
  draft prefilled with the user's input — so a freshly cloned repo
  still works without setup, just less polished.

### Switching providers

The same pattern works for any HTTP form-relay (Formspree, Getform,
Formsubmit, Basin, etc.). Swap `WEB3FORMS_ENDPOINT` and the hidden
field names at the top of `components/ContactClient.tsx`. The
component stays unchanged.

### Security note

Web3Forms access keys are designed to be public — they're rate-limited
per-key, the service applies hCaptcha-grade spam filtering, and the
honeypot field catches naive bots. Don't treat the key as a secret;
do rotate it from the dashboard if abuse spikes.

---

## Analytics & Search Console

Both integrations are **opt-in via env vars**. Leave them blank and the
site ships with zero third-party tracking; set them and the relevant
tags / scripts get injected at build time.

| Env var                               | Purpose                                                 |
| ------------------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`       | Google Analytics 4 measurement ID (`G-XXXXXXXXXX`)      |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`| Search Console HTML-tag verification token              |

### Google Analytics 4

1. Create a GA4 property at [analytics.google.com](https://analytics.google.com).
2. **Admin → Data Streams → Web**, add your domain, copy the Measurement ID.
3. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in `.env.local` (or
   the deploy env — see below).

`components/Analytics.tsx` reads the env var and injects the gtag.js
loader + init snippet via `next/script` (`afterInteractive`). When the
var is unset the component returns `null`, so no requests are made.

### Google Search Console

1. Add your property at [search.google.com/search-console](https://search.google.com/search-console).
2. Choose the **HTML tag** verification method. Google shows a snippet
   like `<meta name="google-site-verification" content="ABC123…">`.
   Copy only the `content` value.
3. Set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=ABC123…` in `.env.local`.
4. Build + deploy. Open `out/index.html` and search for
   `google-site-verification` to confirm the meta tag rendered, then
   click **Verify** in Search Console.

The tag is emitted from `lib/seo.ts` via the Next.js `Metadata.verification.google`
field — that means it appears on every public route (home, blog,
articles, etc.), so Google can verify on whichever URL it crawls first.

### Deploying with the keys

Same pattern as Web3Forms — `NEXT_PUBLIC_*` vars are inlined at build
time, so they must be present when `npm run build` runs.

- **GitHub Pages CI.** Add both as repository secrets (Settings →
  Secrets and variables → Actions). The workflow at
  [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)
  already wires them up:

  ```yaml
  env:
    NEXT_PUBLIC_GA_MEASUREMENT_ID: ${{ secrets.NEXT_PUBLIC_GA_MEASUREMENT_ID }}
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: ${{ secrets.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }}
  ```

- **Vercel / Netlify / Cloudflare Pages.** Add the same names + values
  in the project's environment-variable dashboard. Redeploy once.

---

## Conventions

- **TypeScript everywhere** — strict mode, no `any` unless commented why.
- **Server components by default.** Add `'use client'` only when the
  component needs hooks, browser APIs, or event handlers.
- **Data lives in `lib/content.ts`,** not in components. Components consume it.
- **Styles split by concern.** One CSS file per section in `styles/`.
- **CSS variables, not hardcoded colors.**
- **Real URLs.** No hash routing. Use `<Link href="/blog/">` or pathFor().

---

## Common changes — where to look

| Task                                   | File                                  |
| -------------------------------------- | ------------------------------------- |
| Update name/email/socials              | `lib/content.ts` → `CONTENT.site`     |
| Add/remove a project                   | `lib/content.ts` → `CONTENT.projects` |
| Update job history                     | `lib/content.ts` → `CONTENT.experience` |
| Tweak skills list                      | `lib/content.ts` → `CONTENT.skills`   |
| Change testimonials                    | `lib/content.ts` → `CONTENT.testimonials` |
| Change nav links                       | `lib/content.ts` → `CONTENT.navigation` + add `app/<route>/page.tsx` |
| Edit hero / about / section copy       | `lib/content.ts` → `CONTENT.home` / `.resume` / `.blog` / `.contact` |
| Edit footer                            | `lib/content.ts` → `CONTENT.footer`   |
| Add a new article                      | `articles/<slug>.md` + `articles/index.json` |
| Change colors / accent                 | `styles/tokens.css`                   |
| Add a new icon                         | `components/icons.tsx`                |
| Add a new page                         | `app/<route>/page.tsx`                |
| Update per-route SEO                   | `lib/content.ts` → `CONTENT.seo.routes` |
| Tweak per-article OG image             | `app/article/[slug]/opengraph-image.tsx` |
| Change deploy domain                   | `.github/workflows/deploy.yml` (`CNAME` line) |
| Enable / change contact-form delivery  | See **Contact form (Web3Forms)** above — set `NEXT_PUBLIC_WEB3FORMS_KEY` in `.env.local` (or the deploy env). To swap providers, edit `WEB3FORMS_ENDPOINT` in `components/ContactClient.tsx` |
| Regenerate README screenshots          | See **Screenshots** in [README.md](./README.md) |

---

## Deploy

**GitHub Pages (current setup).** Pushing to `main` triggers
[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml), which:

1. Runs `npm ci` then `npm run build` (writes `out/`)
2. Adds `.nojekyll` and `CNAME` (`maniruzzaman.me`) to the export
3. Calls `actions/configure-pages@v5` (auto-enables Pages on first run)
4. Uploads `out/` and deploys to the `github-pages` environment

To use the workflow on a fork: change the `CNAME` line in
`.github/workflows/deploy.yml` to your domain (or remove that line to
publish at `<user>.github.io/<repo>`), then push to `main`.

**Vercel** — push to GitHub, import the repo on Vercel. Next.js + static
export are auto-detected; no extra config needed.

**Anywhere else** — run `npm run build` and deploy the `out/` directory.
- Cloudflare Pages: build command `npm run build`, output dir `out`
- Netlify: same — build command `npm run build`, publish dir `out`
- S3 + CloudFront: upload `out/` to the bucket (trailing slash routing
  Just Works because of `trailingSlash: true`)

---

## Known limitations

- The contact form delivers via **Web3Forms** when
  `NEXT_PUBLIC_WEB3FORMS_KEY` is set; without a key it falls back to a
  `mailto:` draft. See **Contact form (Web3Forms)** above for the
  one-time setup.
- The contributions grid uses `Math.random()` so the displayed activity
  doesn't reflect real GitHub data. Replace with the GitHub GraphQL API
  if you want live data.

---

## Git authorship for agents

See [`AGENTS.md`](./AGENTS.md). Summary:

- Commits that land on `main` must be attributed to **ManiruzzamanAkash**, not bots (`cursoragent`, etc.).
- Prefer PRs; **Squash and merge** when a cloud agent could only author as a bot.
- Do not add bot co-author trailers unless explicitly requested.
