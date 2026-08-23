---
title: What you must never forget when building a Gutenberg block in WordPress
slug: what-you-must-never-forget-building-gutenberg-block
date: 2026-08-23
category: Architecture
excerpt: Most Gutenberg pain isn’t React — it’s choosing the wrong render model, skipping migrations, ignoring accessibility, or fighting the browser instead of using the Interactivity API. Here’s the checklist I wish every new block started with.
readTime: 9 min
tags: [wordpress, gutenberg, blocks, interactivity-api, accessibility, seo]
---

# What you must never forget when building a Gutenberg block in WordPress

I've shipped a lot of Gutenberg blocks — the kind that land on real stores, real editors, and real support tickets. The hard part usually isn’t “can I make a block?” It’s the things people forget until 100K installs later.

This is the list I don’t skip anymore.

## 1. Don’t default to a client-saved HTML block just because it feels familiar

A lot of developers still start the same way: build the markup in JavaScript, put it in `save()`, ship it, celebrate.

That works… until you change an attribute, tweak the markup, rename a wrapper, or “just clean up” a class name.

Then WordPress compares what was saved in the post with what your new `save()` produces. If they don’t match, editors get the classic **“This block contains unexpected or invalid content”** experience.

Here’s the painful part:

- The **front end** can still look fine (especially if something else is covering for you).
- The **editor** is where it breaks — recovery UI, broken previews, confused merchants.
- If that block is on tens of thousands of sites, you’ve just created a content migration incident.

So yes: if your block’s HTML is baked into the post via `save()`, every meaningful markup change needs a proper **deprecation + migrate** path. Not “we’ll tell people to re-insert the block.” That’s not a plan.

**Rule of thumb:** if the block’s output can change over time (and it will), prefer a **server-rendered / dynamic** block (`save` → `null`, PHP `render_callback` or `render.php`) unless you have a strong reason to save static HTML.

Static blocks still have a place. Just don’t choose them by accident.

## 2. Prefer server-rendered blocks when you can — for migrations, SEO, and sanity

Server-rendered blocks store attributes (and maybe a lightweight fallback), then build the HTML in PHP at request time.

Why I reach for that first on product work:

1. **Fewer “invalid block” disasters** when the markup evolves.
2. **Better SEO posture** for content that should be real HTML in the response, not something a heavy client script has to invent.
3. **One source of truth** for front-end output — especially useful for ecommerce, dynamic data, gated content, pricing, inventory, etc.
4. **Editor preview can still be rich** — `edit()` is still React. You’re not giving up a good editing UX.

This is the model I’d teach a junior on day one if they’re building plugin blocks for merchants, not a one-off brochure site.

## 3. Need interactivity? Don’t rebuild a mini React app in `view.js` by default

Previously, “make it interactive on the front end” often meant: ship a separate front-end React bundle (`viewScript`), hydrate something, fight SEO, fight performance, fight maintenance.

That path still exists. It’s just not the default I want anymore for most block UI.

WordPress now has the **Interactivity API** (stable in Core since **6.5**, with further improvements in **7.0**). The idea is simple and powerful:

- Render meaningful HTML on the **server**
- Add behavior with **directives** + a small store
- Keep the experience interactive without turning the whole block into a client-only island

You can update elements, classes, state, and UI feel — while staying in a server-first world.

That’s a big win for Gutenberg development. If you’re starting a new interactive block in 2026, ask first:

> Can this be server-rendered HTML + Interactivity API instead of a custom front-end React runtime?

Often the answer is yes.

## 4. Accessibility is not a polish pass — it’s part of the block contract

If your block ships a fancy UI that only works with a mouse, you’ve shipped a broken block for a lot of real users — including people editing content all day in WordPress.

Never forget:

- Prefer **semantic HTML** (`button`, `a`, headings, lists, labels) over `div` + click handlers
- Everything interactive must work with **keyboard** (Tab / Shift+Tab / Enter / Space / arrows where expected)
- Visible **focus** states matter
- Use **ARIA** only when native HTML can’t express the state (`aria-expanded`, etc.) — and keep ARIA in sync with reality
- Heading levels should respect the surrounding page, not always restart at `h2` because it looked nice in your demo
- In the editor, prefer `@wordpress/components` when you can — they’re built with accessibility in mind

I treat a11y like escaping HTML: if you “add it later,” you probably won’t.

## 5. Escape, sanitize, capability-check — every output path

Gutenberg doesn’t remove the old WordPress rules.

- Escape on output (`esc_html`, `esc_attr`, `esc_url`, `wp_kses_post` where appropriate)
- Sanitize on input / attribute updates
- Don’t trust attributes just because they came from “your” block
- If the block does privileged things, check capabilities the same way you would in classic PHP

A beautiful block that prints raw attribute HTML is still a security bug.

## 6. Design attributes like a public API

Attributes are your long-term contract with existing content.

Before you ship v1:

- Name attributes for stability, not for today’s component tree
- Avoid stuffing huge HTML blobs into attributes if a better model exists
- Think about defaults and what happens when an attribute is missing
- If you must rename or reshape attributes later, plan `migrate` early

Changing attribute shape without a migration story is how you get silent data loss or endless “attempt recovery” loops.

## 7. Editor experience is product experience

Merchants don’t care that your `block.json` is elegant. They care that:

- The block is discoverable (category, keywords, example preview)
- Settings are understandable
- The preview matches the front end closely enough to trust
- Broken states fail clearly
- You’re not requiring a developer to “fix invalid blocks” after every plugin update

If you support 100K installs, support load is part of your architecture.

## 8. Performance: ship less JavaScript than your ego wants

Every block script is a tax on the editor and sometimes the front end.

- Split editor scripts from front-end scripts cleanly
- Don’t enqueue globally what only one block needs
- Prefer Interactivity API / small modules over giant bundles
- Lazy where it makes sense
- Measure on a real content-heavy page, not an empty local install

“It works on my machine with one block inserted” is not a performance review.

## 9. Test the upgrade path, not just the happy path

Before release, I want at least:

1. Insert block → save → reload editor → still valid
2. Change attributes → save → front end matches
3. Upgrade plugin with old content in a post → no invalid block explosion
4. Keyboard-only pass in editor + front end
5. One screen-reader sanity check on interactive UI
6. No console errors with `SCRIPT_DEBUG`

If you changed `save()` output, write the deprecation first — then test with a post that still contains the old markup.

## The short checklist I keep near `block.json`

- [ ] Did I choose **dynamic/server render** on purpose (or static on purpose)?
- [ ] If static: do I have **deprecations/migrations** for markup changes?
- [ ] Is front-end interactivity using **Interactivity API** when possible?
- [ ] Is output **escaped/sanitized**?
- [ ] Is it **keyboard + screen-reader** usable?
- [ ] Do attributes look like a stable API?
- [ ] Are scripts scoped and lean?
- [ ] Did I test **old content → new plugin version**?

## Closing

Gutenberg makes it easy to build a block that demos well.

The things you must never forget are the ones that show up later — at scale, in the editor, in accessibility audits, in SEO complaints, and in support queues.

Default to server-rendered output when you can.
Use the Interactivity API for front-end behavior instead of reinventing a client app.
Treat migrations and accessibility as release requirements, not blog-post ideals.

That’s how blocks survive contact with real WordPress sites.
