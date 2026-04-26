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

Seven years in, I've worked across more surfaces than the bullet-point version of my CV admits. WordPress plugins from a thousand active installs to a hundred thousand — yes, but also Symfony microservices behind a payment gateway used by 10K+ European merchants, Laravel SaaS and a TALL-stack CMS I founded, React and React Native apps for a 50K-employee group, the occasional .NET Core API, and lately a lot of AI-augmented engineering — MCP servers, RAG, agents, and the slow rewrite of how I actually work day-to-day.

That spread is the point. Most of my opinions came from the boundaries between those worlds — what travels well, what doesn't, and where "best practice" in one ecosystem is plainly wrong in another. I want to write them down so I can either defend them or admit I was off.

I want to write about:

- **Plugin & application architecture** — what scales across WordPress, Laravel, and Symfony, and why most "best practices" don't survive contact with a real codebase.
- **Ecommerce engineering** — WooCommerce, Shopify, SureCart, payment gateways. Three platforms, three different deals, and the calls I make on real briefs.
- **AI in the loop** — agents, MCP, RAG, eval discipline, and what changes when the LLM writes half the diff.
- **Engineering judgment** — testing, refactoring, code review, and the boring habits that compound into the kind of taste an LLM can't fake.
- **Career stuff** — the parts nobody tells you about going from "I can code" to "I can ship a thing that 100K people use."
- **Small experiments** — half-built things I want feedback on.

## How this is built

This blog is just markdown files in an `articles/` folder. Each file has a YAML frontmatter block at the top — title, date, category, excerpt — and the body is plain markdown. The site reads them at build time and pre-renders one static HTML page per post.

No CMS. No database. Add a file, commit, done.

If you're a developer who wants this same setup, the source is on GitHub.

## What's next

I'll be publishing roughly once a week to start. If something here is useful, wrong, or worth arguing about — [email me](mailto:manirujjamanakash@gmail.com).

Thanks for reading.
