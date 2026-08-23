---
title: Gutenberg block deprecations without breaking a hundred thousand editors
slug: gutenberg-block-deprecations-without-breaking-editors
date: 2026-08-23
category: Architecture
excerpt: Changing a block’s save() output without a deprecation is how you turn a routine release into an editor outage. Here’s the migration path I actually use when markup has to evolve.
readTime: 8 min
tags: [wordpress, gutenberg, blocks, deprecations, migrations]
---

I’ve already written about the broader checklist for shipping Gutenberg blocks. This post is narrower on purpose: **what happens when the HTML your `save()` produces has to change**, and how to do that without lighting up “This block contains unexpected or invalid content” across a huge install base.

If your block saves static markup into the post, this is not optional reading. It’s the difference between a quiet release and a support week.

## The failure mode (and why the front end lies to you)

Static blocks serialize HTML into post content. On load, the editor re-runs your current `save()` and compares it to what’s stored. Mismatch → invalid block.

The front end can still look fine. Merchants don’t open the editor every day. Then someone edits a product page, sees recovery UI, and suddenly your “small cleanup” is a product incident.

I’ve watched this play out at plugin scale. You don’t get to tell 100K site owners to “just re-insert the block.”

## Prefer not needing this: dynamic render

If `save` returns `null` and PHP renders from attributes, you skip a lot of save-validation pain. That’s still my default for product blocks.

But plenty of real blocks are static — or were static for years — and still need to evolve. Deprecations are how you keep those honest.

## Mental model: deprecations are not a database migration chain

WordPress does **not** run deprecation #1, then feed the result into #2, then #3 like a Laravel migration stack.

Roughly:

1. Current `save()` fails validation against stored content.
2. The editor tries each entry in `deprecated` (newest first is the usual convention) until one old `save()` matches the stored HTML.
3. Attributes (and `migrate`, if present) from that match are handed back to the **current** block definition to re-save.

Miss that model and you’ll “add a migrate” on the newest deprecation only, then wonder why older content never upgrades.

## What I put in a deprecation object

At minimum, for the version you’re retiring:

- The old `attributes` shape (not silently inherited)
- The old `save()` that still validates against historical HTML
- A `migrate()` when attributes move, rename, or change meaning
- Sometimes `supports` / `isEligible` when the match rules get subtle

I keep each retired version as a named constant in `deprecated.js` (or similar), then export an array with **newest deprecation first**. Readable beats clever.

## A practical sequence before you ship the breaking markup change

1. **Freeze the old `save()`** in a deprecation *before* you change the current one.
2. Write `migrate()` for any attribute reshaping — test it with real post HTML from staging, not a hand-built fixture only.
3. Change the current `save()` / edit UI.
4. Open posts that still contain **old** serialized blocks. Confirm: no invalid state, attributes look right after update, front end still matches.
5. Only then cut the release.

If step 4 is “we’ll see what support says,” you’re not ready.

## Migrations people forget

- Renaming an attribute (`buttonText` → `label`) without `migrate`
- Moving inner content into `InnerBlocks` and leaving old string attributes behind
- Changing wrapper tags or classnames “for BEM cleanliness” with no deprecation
- Tightening `save()` output (extra whitespace, attribute order) enough to fail equality checks
- Shipping a dynamic (`save: null`) rewrite of a formerly static block without a path for old HTML

That last one bites teams who assume “we’re dynamic now, validation is gone.” Old posts still contain the old static HTML until someone opens and updates them.

## Editor UX is part of the migration

A technically correct deprecation that leaves the sidebar in a confusing state still fails users. After migrate:

- Defaults should fill gaps
- Deprecated UI controls shouldn’t haunt the inspector
- Preview should match front end closely enough that merchants trust the update

You’re not only migrating data. You’re migrating trust.

## When I still choose static `save()` on purpose

Dynamic isn’t free. Static can be right when:

- Output is truly stable documentation-like markup
- You want a usable HTML fallback if the plugin is deactivated
- The block is simple and you accept the deprecation discipline

Just choose it with eyes open. Static without a deprecation culture is technical debt with a support pager.

## Checklist I run on every markup-changing PR

- [ ] Old `save()` captured in `deprecated` (newest first)
- [ ] `migrate()` covers attribute renames/moves
- [ ] Fixture posts with **v1 and v2** HTML both upgrade cleanly
- [ ] Front end checked before and after opening the editor
- [ ] No “Attempt Recovery” on a fresh load of old content
- [ ] Release notes mention the content upgrade (one sentence is enough)

## Closing

The Interactivity API and server render help you need fewer painful save migrations. They don’t erase the ones you already owe.

If you change what `save()` prints, you own a deprecation. That’s not ceremony — it’s how Gutenberg content stays editable at scale.
