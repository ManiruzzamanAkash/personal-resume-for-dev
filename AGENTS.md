# Agent instructions

Rules for any coding agent (Cursor IDE/CLI, cloud agents, Claude, etc.) working in this repo.

## Git authorship (required)

- **Primary author must be Maniruzzaman Akash / GitHub `ManiruzzamanAkash`.**
- Do **not** leave bot-only authorship on `main` (no `cursoragent`, Cursor Agent, Copilot, or other bot as the sole or primary author of history that lands on `main`).
- Prefer opening a **pull request**; do not push straight to `main` unless explicitly asked.
- When merging to `main`, use **Squash and merge** (or an equivalent rewrite) so the commit that lands on `main` is attributed to **ManiruzzamanAkash**, not a bot.
- Do not add bot `Co-authored-by` / “Made with …” trailers unless Maniruzzaman Akash explicitly asks for them.
- If a hosted cloud agent can only commit as a bot identity: still open the PR, note that limitation, and rely on **Squash and merge** (or a follow-up user-authored commit via GitHub as `ManiruzzamanAkash`) so `main` stays clean.

## Content / site work

- Follow `CLAUDE.md` for article workflow, `lib/content.ts`, and deploy conventions.
- Do not invent portfolio facts. Prefer edits the owner has reviewed in chat when copy is sensitive.
- Never suggest or promote Awesome Motive hiring/content unless the owner asks.
