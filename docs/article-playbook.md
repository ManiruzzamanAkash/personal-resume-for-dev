# Article playbook

How every article on maniruzzaman.me is written. The daily writing task
follows this file; humans should too. Mechanics (frontmatter, `index.json`,
build) live in [`CLAUDE.md`](../CLAUDE.md#adding-a-new-article) — this file
covers **what** to write and **how it should read**.

## Why the blog exists

To get Maniruzzaman Akash hired. Every post is evidence for one of three
readers:

| Reader | Reads | Wants to leave with |
| --- | --- | --- |
| **Recruiter / hiring manager** (often non-technical) | Title, the "In short" box, headings, the author card. ~30 seconds. | "Senior, owns outcomes, communicates clearly, knows our stack." |
| **Agency / founder / store owner** with a problem | Title from a Google search, "In short", the checklist. | "He has solved exactly this. I should book a call." |
| **Engineer** (often the one asked "is this guy good?") | The whole thing, especially code. | "Real judgment, real trade-offs, not a rewritten docs page." |

The engineering depth is the proof. The structure is what lets the first two
readers find it.

## The shape of every article

1. **Title** — outcome-led and searchable, ≤ 65 characters where possible.
   Name the problem or the decision, not a vibe.
   - Good: `Why your WooCommerce checkout slows down after 50K orders`
   - Good: `Laravel vs WordPress for a membership site: how I decide`
   - Avoid: another "…I trust" title. It is already used ~10 times — at
     most one in any ten new posts.
2. **H1** repeating the title, then the **"In short" block**, immediately:

   ```markdown
   > **In short**
   > - **The problem:** one sentence a non-engineer understands, with the business cost (lost orders, slow admin, failed deploys, wasted hours).
   > - **What I do about it:** one or two sentences, plain words.
   > - **Who this is for:** e.g. "WooCommerce store owners past 10K orders", "Laravel teams before their first big launch".
   ```

3. **Opening (2–4 short paragraphs)** — a concrete scene or failure that
   shows the problem. Lead with consequence, then cause.
4. **Body** — `##` sections that each make one claim. Headings should read
   as a summary on their own (a recruiter skimming only headings should get
   the argument). Code only where it earns its place; explain *why* before
   *how*.
5. **"Trade-offs" or "When not to do this"** — always. Senior judgment is
   the product; showing where an idea breaks is what separates this from a
   tutorial.
6. **Closing checklist** — "What I check on a project like this" as a
   numbered list of 5–8 items. This is what agencies screenshot.
7. **One-paragraph verdict.** No "Conclusion" heading, no sign-off, **no
   hire-me paragraph** — the author card under every article handles that
   (`components/ArticleAuthorCard.tsx`).

Length: **1,200–2,200 words**. `readTime` ≈ words ÷ 200, rounded.

## Voice

- First person, direct, calm. Short paragraphs. British/American spelling:
  American.
- Opinions with reasons: "I default to X because Y; I switch to Z when W."
- Explain jargon once, in passing, for the non-engineer reader.
- No filler openers ("In today's fast-paced world…"), no "Let's dive in",
  no emoji, no exclamation marks, no "game-changer", "robust", "seamless",
  "leverage", "delve".

## Honesty rules (non-negotiable)

These posts are published under a real person's name and read by people
deciding whether to hire him.

- **Only claim experience that is on the record** in `lib/content.ts`
  (`CONTENT.site`, `.experience`, `.projects`, `.openSource`) or in an
  already-published article. Products that can be named: SureCart
  (Brainstorm Force), Paysera payment plugins, Dokan and WP ERP (weDevs),
  Akij Group HR/POS/ERP, Lara Dashboard.
- **Never invent** incidents, client names, dates, metrics, percentages,
  team sizes, or quotes. No "a client of mine saw 43% faster checkouts".
- When there is no on-record story, write it as a **pattern**: "The failure
  I see most often is…", "A typical version of this bug looks like…".
  That is honest and still reads as experience.
- Figures about tools (default timeouts, version numbers, API names) must
  be correct for current versions. If unsure, leave the number out.
- Never promote or mention Awesome Motive hiring/content.

## Topic mix

Rotate formats so the blog shows breadth, not one tutorial pattern. Over
any 7 consecutive posts aim for roughly:

| Format | Per week | Mostly for | Example |
| --- | --- | --- | --- |
| **Deep-dive** — a technique done properly | 2 | Engineers | HPOS-safe order queries |
| **Decision guide** — X vs Y, build vs buy, when to hire | 1–2 | Founders, agencies | Headless WooCommerce: when it's worth it |
| **Problem audit** — "signs your … needs …" + checklist | 1 | Store owners, agencies | 9 signs your WordPress site needs a plugin audit |
| **Architecture teardown** — how a system should be shaped | 1 | Hiring managers | Structuring a Laravel SaaS for its first 3 engineers |
| **Career / leadership** — reviews, mentoring, estimates, ownership | 1 | Hiring managers | How I write a technical design doc a PM can read |

Never publish the same primary topic (e.g. Redis, Docker, Gutenberg) twice
within 7 days. Check the newest ~10 entries in `articles/index.json`.

## Categories

Use exactly one of these for new posts (category pages are generated from
them, so stay consistent):

`WordPress` · `WooCommerce` · `Laravel` · `React & Frontend` ·
`DevOps & Cloud` · `AI Engineering` · `Architecture` · `Career`

(Older posts use `Engineering`; leave them unless re-categorising in a
dedicated change.)

## Frontmatter and SEO

- `excerpt`: 1–2 sentences, ≤ 240 characters, states the problem and the
  payoff. It is the meta description and the blog-list blurb.
- `tags`: 5–9 lowercase, hyphenated, searchable terms (`woocommerce`,
  `hpos`, `performance`). Include the audience term where natural
  (`ecommerce`, `saas`, `agency`).
- `slug`: from the title, lowercase, hyphenated, no dates, ≤ 70 characters,
  unique.
- Quote any frontmatter value containing a colon (the build validates this).
- Link to 1–3 earlier articles where genuinely related, using
  `/article/<slug>/` with the trailing slash.

## Before it ships

- [ ] "In short" block present and readable by a non-engineer
- [ ] Headings alone tell the story
- [ ] A trade-offs / when-not-to section exists
- [ ] Closing checklist of 5–8 items
- [ ] No invented experience, clients, or numbers (see Honesty rules)
- [ ] Category from the list above; topic not repeated in the last 7 posts
- [ ] Entry added at the **top** of `articles/index.json` (same title,
      date, category, excerpt as frontmatter)
- [ ] Topic ticked off in `docs/article-backlog.md` (or appended there as done)
- [ ] `npm run build` passes
