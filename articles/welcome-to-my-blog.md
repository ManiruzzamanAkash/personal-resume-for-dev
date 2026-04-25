---
title: Welcome to my blog
slug: welcome-to-my-blog
date: 2026-04-25
category: Meta
excerpt: A short note on why I'm starting to write here, what to expect, and how this little site is built.
readTime: 3 min
tags: [writing, meta, intro]
---

# Welcome to my blog

I've been meaning to write more for years. Tweets, half-finished Notion docs, abandoned drafts — none of it ever quite stuck. So this is the simplest version I could ship: a folder of markdown files, no CMS, no database, no excuses.

## Why now

After seven years of shipping WordPress plugins — from a thousand active installs to a hundred thousand — I've built up opinions. Some are sharp. Some are wrong. Most are worth writing down so I can either defend them or admit I was off.

I want to write about:

- **Plugin architecture** — what scales, what doesn't, and why most "best practices" don't survive contact with a real codebase.
- **Engineering discipline** — testing, refactoring, and the boring habits that compound into senior judgement.
- **Career stuff** — the parts nobody tells you about going from "I can code" to "I can ship a thing that 100K people use."
- **Small experiments** — half-built things I want feedback on.

## How this is built

This blog is just markdown files in an `articles/` folder. Each file has a YAML frontmatter block at the top — title, date, category, excerpt — and the body is plain markdown. The site reads them at runtime and renders them.

No build step. No deploy pipeline. Add a file, commit, done.

If you're a developer who wants this same setup, the source is on GitHub.

## What's next

I'll be publishing roughly once a week to start. If something here is useful, wrong, or worth arguing about — [email me](mailto:manirujjamanakash@gmail.com).

Thanks for reading.
