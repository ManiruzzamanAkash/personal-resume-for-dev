---
title: "Code review comments that make a team faster, not slower"
slug: code-review-comments-that-make-a-team-faster
date: 2026-11-12
category: Career
excerpt: "Most slow code reviews are not slow because of the code. They are slow because comments are vague, unranked, and late. Here is how I write review comments so a pull request gets better and merges in one or two rounds."
readTime: 11 min
tags: [code-review, pull-requests, engineering-leadership, mentoring, senior-engineer, team-velocity, communication]
---

# Code review comments that make a team faster, not slower

> **In short**
> - **The problem:** pull requests sit for days and go through four or five rounds because review comments are vague, mix serious problems with personal taste, and arrive late. Features ship slower, and good engineers start dreading review.
> - **What I do about it:** review in a fixed order (boundaries, then correctness, then style), label every comment so the author knows what blocks the merge, and write each comment so it can be acted on without a follow-up question.
> - **Who this is for:** senior engineers and tech leads who review a lot of code, and engineering managers wondering why "done" work takes a week to merge.

A typical slow review looks like this. An engineer opens a pull request on Monday. On Wednesday a reviewer leaves fourteen comments. Three are about variable names, two ask "why?" with no context, one points out a real bug in how refunds are rounded, and the rest are suggestions the reviewer half-remembers from another project. Nothing says which of them must be fixed.

The author, reasonably, tries to fix all fourteen. Some fixes start a new thread. The reviewer comes back on Friday with six more comments, two of them on lines the author only changed because of the first round. The refund bug, the one comment that mattered, got the same weight as "maybe rename `$tmp`."

Nobody here was careless. The reviewer was being thorough and the author was being cooperative. The problem was the shape of the comments. Review speed is mostly a writing problem, and writing is something a senior engineer can fix.

## Review in a fixed order so the expensive problems surface first

I review for boundaries first, correctness second, and style last. It is the order I have used while mentoring engineers on plugin architecture and code review at Brainstorm Force, and across the 100+ pull requests I have reviewed and merged on Lara Dashboard, WP React Kit, and contributor work on WP ERP and Dokan.

The order matters because the cost of a problem grows with how late it is found:

1. **Boundaries.** Does this change respect the public contract? In a WordPress plugin that means hooks, filters, REST routes, database tables, and option names other code may depend on. In a Laravel app it means module boundaries, events, and API responses. A boundary mistake is expensive to undo once it ships, because someone else starts relying on it.
2. **Correctness.** Does it do what the ticket says, including the unhappy paths? Failed payments, empty lists, a user without permission, a retry that runs twice.
3. **Style and readability.** Naming, structure, small simplifications. Real, but cheap, and usually not worth a second round on their own.

If the first pass finds a boundary problem, I stop there and say so. There is no point polishing names in a function that is about to move or disappear. One comment that says "this filter changes what third-party code receives, let's talk before going further" saves the author a round of fixing things that will not survive.

## Label every comment so the author knows what blocks the merge

The most useful habit I have adopted is a short prefix on every comment saying what kind of comment it is. The format I use is close to [Conventional Comments](https://conventionalcomments.org/): a label such as `issue`, `suggestion`, `question`, `nitpick`, or `praise`, optionally marked `blocking` or `non-blocking`.

```text
issue (blocking): refunds round each line item before summing, so a
3-item partial refund can be off by a cent from what the gateway charges.
Sum in minor units (cents) first, round once.

suggestion (non-blocking): this query could use the existing
OrderRepository::forCustomer() instead of a new raw query.

nitpick: `$data` -> `$renewalPayload` would make the next function easier to read.

question: is this endpoint meant to be public? It has no permission_callback check
I can see. If it is intentional, a short code comment would help the next reader.
```

The labels do three things. The author can sort the work in seconds: fix the blocking items, decide on the rest. The reviewer has to be honest about what they actually require, which cuts a surprising number of comments. And the conversation stays calmer, because "nitpick" openly admits it is taste, so nobody has to argue about whether it is a real problem.

If a pull request has no blocking comments, I approve it with the non-blocking ones attached and trust the author to take what is useful. Holding an approval hostage for a rename is how a two-day merge becomes a week.

## Write each comment so it can be acted on without a reply

A comment that needs a follow-up question costs a full round trip, which on a distributed team can be a day. Before I post a comment I check that it has three things:

- **What I see.** The specific line or behavior, not "this feels off."
- **Why it matters.** The consequence: wrong totals, a slow query on large stores, a breaking change for an extension.
- **What would resolve it.** A concrete fix, a direction, or the question I need answered.

Compare these two:

> "Why are we doing this here?"

> "question: this runs the stock sync inside the checkout request, so a slow inventory API would slow every checkout. Was that intentional, or could it go to a background job like the order export does?"

The first one is honest but it hands all the work back to the author, who has to guess what worried the reviewer. The second one can be answered in one reply, and often the author just moves the work and says "done."

Where the fix is small and mechanical, I write the code. GitHub's suggested-changes block lets the author apply a fix with one click, which is faster for both of us than describing it in prose:

````markdown
```suggestion
if ( ! current_user_can( 'manage_woocommerce' ) ) {
    return new WP_Error( 'forbidden', __( 'Not allowed.', 'my-plugin' ), [ 'status' => 403 ] );
}
```
````

## Speed of the first response matters more than speed of the whole review

A pull request waiting two days for a first look blocks the author, encourages them to start something else, and makes the eventual review feel like an interruption to both sides. Google's published [engineering practices](https://google.github.io/eng-practices/review/reviewer/speed.html) set one business day as the maximum time to respond to a review request, and I think that is the right ceiling for most teams.

A first response does not have to be a full review. If I cannot do the whole thing today, I do the boundary pass and post it, or I leave a short note: "Looked at the structure, it's fine, I'll do correctness tomorrow morning." The author knows the approach is safe and can keep working on tests or docs instead of waiting.

The same thinking applies to size. Large pull requests get slow, shallow reviews, because nobody can hold 1,500 changed lines in their head. When I get one, the most helpful comment is often to suggest splitting it: the migration first, then the service, then the UI. That is not a refusal to review. It is the fastest route to a review that actually catches things.

## Praise is information, not politeness

I leave at least one `praise` comment on most reviews, and not to soften the criticism. Positive comments tell the author what to keep doing, which is just as useful as telling them what to change.

"praise: the test for the double-submit case is exactly the one I would have asked for" teaches a less experienced engineer that writing that test was a good call, so they write it again next time without being asked. Over months, specific praise does more to shape how a team writes code than any number of corrections, because it describes the target rather than just the misses.

Generic praise ("LGTM, nice work") carries no information. Name the specific thing.

## Move the repeated comments out of review and into tooling or docs

If I leave the same comment on three pull requests, it is no longer a review comment. It is a missing rule.

- **Formatting and simple style** belong to a formatter and a linter in CI: PHP_CodeSniffer with the WordPress Coding Standards, Laravel Pint, ESLint and Prettier on the JavaScript side. A machine leaving the comment is faster and nobody takes it personally.
- **Patterns the team has agreed on** (where business logic lives, how REST permissions are checked, how money is stored) belong in a short contributing guide or the codebase's own structure, the way I described in [structuring a Laravel SaaS codebase for its first three engineers](/article/structuring-laravel-saas-codebase-first-three-engineers/).
- **Behavior that must not regress** belongs in a test. I expect tests to lock in behavior before a refactor lands, so the review can focus on the change instead of re-checking everything around it.

Each of these removes a category of comment for good. That is how review gets faster over a year, not just on one pull request.

## Take big disagreements off the pull request

Some threads should not be threads. When a disagreement goes past two replies each, it is usually about design, not code, and comment boxes are a bad place to settle design.

My rule: on the third reply, I suggest a short call or move it to a design note. We agree on the approach, one of us writes a one-line summary back on the pull request so the reasoning is recorded, and the review continues. If the disagreement is big enough to change the plan, it probably needed a [design doc a product manager could read](/article/technical-design-doc-a-product-manager-can-read/) before the code was written, and that is worth saying out loud for next time.

## Trade-offs: where this approach breaks down

None of this is free, and some of it is wrong for some teams.

- **Labels can become bureaucracy.** On a two-person team that talks all day, prefixing every comment is ceremony. I keep the `blocking` marker and drop the rest.
- **Non-blocking comments can be ignored forever.** If an engineer never acts on suggestions, the label is not the problem. That is a mentoring conversation, held one-to-one, not a reason to make everything blocking.
- **Fast first responses can fragment a reviewer's day.** Someone reviewing for the whole team needs set review times, not a promise to drop everything. One business day is a ceiling, not a target of one hour.
- **Approving with open suggestions needs trust.** On payment code, permission checks, or anything touching stored data, I am stricter: I re-check the final diff before it merges, even if my remaining comments were non-blocking.
- **Some code needs a slow review.** A change to a public plugin API, a migration on large tables, or a new payment gateway integration should get two reviewers and more time. Speed is the goal for ordinary changes, not for the ones that are hard to undo.

## What I check before I submit a review

1. **Did I review boundaries before style?** If there is a contract or architecture problem, it is the first comment and I stopped polishing after it.
2. **Does every comment have a label, and is every `blocking` one actually blocking?** If I would merge it anyway, it is not blocking.
3. **Could the author act on each comment without asking me a question?** What I see, why it matters, what would fix it.
4. **Are small mechanical fixes written as suggestions** the author can apply in one click?
5. **Is there at least one specific `praise` comment** for something worth repeating?
6. **Am I repeating a comment I have left before?** If so, note it for a linter rule, a test, or the contributing guide.
7. **Is any thread past two replies each?** Move it to a call and record the outcome on the pull request.
8. **Did I respond within one business day,** even if only with a first pass?

My verdict: code review slows a team down when comments are vague, unranked, and late, and it speeds a team up when every comment says what it is, why it matters, and what would resolve it. Review the expensive things first, label what blocks the merge, write comments that need no follow-up, and move repeated feedback into tools and tests. The result is fewer rounds, calmer conversations, and engineers who get better with each pull request instead of more cautious.
