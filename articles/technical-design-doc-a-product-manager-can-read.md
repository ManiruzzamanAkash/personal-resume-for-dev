---
title: "Writing a technical design doc a product manager can actually read"
slug: technical-design-doc-a-product-manager-can-read
date: 2026-11-08
category: Career
excerpt: "Most design docs are written for the engineer who wrote them, so the people who approve the work skim, nod, and get surprised later. Here is the structure I use so a product manager can read the first page and make a real decision."
readTime: 10 min
tags: [design-docs, technical-writing, engineering-leadership, product-management, senior-engineer, communication, saas]
---

# Writing a technical design doc a product manager can actually read

> **In short**
> - **The problem:** design docs are usually written for other engineers, so the product manager or founder who approves the work cannot tell what they are agreeing to. The surprises show up later as missed dates, scope fights, and features that work but are not what anyone wanted.
> - **What I do about it:** write the first page for the decision-maker in plain words (the problem, the recommendation, what it costs, what we are not doing, what could go wrong) and put the engineering detail after it, for the people who need it.
> - **Who this is for:** engineers moving into senior roles, and the product managers, founders, and engineering managers who have to approve their plans.

The pattern I see most often goes like this. An engineer spends two days writing a careful design doc. It has a sequence diagram, a database schema, three alternatives with pros and cons, and a section on caching. It goes to the product manager for sign-off. The PM reads the first two paragraphs, sees nothing alarming, and approves it.

Three weeks later the feature is half built and the PM asks why it will not support the case their biggest customer needs. The answer was in the doc, on page four, in a sentence that said "multi-currency is out of scope for v1." Technically, everyone agreed to it. In practice, only one person knew.

Nobody did anything wrong here except the format. The doc answered the engineer's questions in the engineer's order. The PM needed different answers, in a different order, and needed them on the first page.

## A design doc exists to get a decision, not to record a design

The most useful shift I made in how I write these was to stop treating the doc as documentation and start treating it as a request. Every design doc is asking someone to agree to something: spend this time, accept this risk, drop that feature, choose this approach over that one.

If the doc is a request, the questions become obvious. Who has to say yes? What do they need to know to say yes with their eyes open? What would make them say no, and is that in the doc where they will see it?

The engineering design still matters. It is how the other engineers check the thinking and how the next person understands why the system looks the way it does. But it is the supporting evidence, not the headline. Owning the Paysera WooCommerce gateway plugin from spec through maintenance taught me how long a spec has to keep paying its way: the useful ones make the business decision obvious before anyone reaches the technical part.

## The first page is for the person who approves the work

I keep the top of every design doc to one page, written so someone who has never opened the codebase can follow it. It has six parts, always in this order:

1. **The problem, in user or business terms.** "Store owners cannot refund part of a subscription renewal without cancelling the whole subscription, so support does it by hand." Not "the refund endpoint lacks line-item granularity."
2. **The recommendation, in one or two sentences.** What we will build, stated plainly enough that someone could repeat it in a meeting.
3. **What it costs.** A time range, the people involved, and anything else it consumes: a new service, a paid API, a migration window.
4. **What we are not doing.** The scope cuts, spelled out. This is the section that prevents the multi-currency surprise.
5. **The risks, and what we do about each.** Two to four, ranked. "If the payment provider's partial-refund API behaves differently from its docs, we lose a week. We test it against a sandbox account on day one."
6. **The decision we need, and by when.** "Approve the approach and the scope cuts by Thursday so we can start the migration work next sprint."

Everything after that page is for engineers, and the doc says so: a line like "Details for reviewers below" tells the PM they can stop reading without missing anything they are responsible for.

## Lead with the problem, because that is where the misunderstandings live

Most disagreements I have seen on a project were not about the solution. They were about the problem. The engineer thought the goal was "support partial refunds." The PM thought it was "stop support doing refunds by hand." Those sound the same and lead to different features.

Writing the problem in the reader's language forces this into the open early. If the PM reads the problem statement and says "that's not quite it," the doc has already paid for itself, before a line of code exists.

I also write down how we will know it worked. One concrete signal, not a dashboard: "support stops filing manual refund tickets for renewals." That gives the PM something to hold the work against, and it gives the engineer a reason to push back on scope that does not move it.

## Write cost as a range with reasons, not a single date

A single number on a design doc is a promise, and the PM will plan around it. A range with the reason for its width is information they can actually use.

"Three to five weeks. Three if the existing refund code can be extended; five if we have to rebuild how renewals are stored, which we will know by the end of week one."

That sentence does three things a bare "four weeks" does not. It tells the PM where the uncertainty is. It tells them when the uncertainty goes away. And it gives them a natural checkpoint to ask about, which is far better than discovering the slip at the deadline.

If there is a cheaper option that does most of the job, the cost section is where it goes. "A manual admin tool that support uses would take one week and remove most of the tickets, but not all." Decision-makers make better calls when they can see the price of each level of ambition.

## The alternatives section should show the trade, not prove you were right

Engineers often write the alternatives section as a formality: two straw options with obvious flaws, then the chosen one. Reviewers can tell, and it makes the whole doc read like a sales pitch.

A useful alternatives section names what each option gives up, in terms the PM cares about. For each serious alternative I write one line on what it would be better at and one line on why I still recommend against it:

- **Extend the current refund flow.** Fastest to ship. Leaves the renewal data model as it is, which blocks the proration work already on the roadmap.
- **Rebuild renewals as separate orders.** Slower, and needs a data migration. Makes partial refunds, proration, and reporting much simpler afterwards. This is the recommendation.
- **Hand it to the payment provider's hosted billing portal.** Least code. Moves the refund experience out of the store owner's admin, which product has said is a hard requirement.

The third line is the important one. It shows that a product constraint, not an engineering preference, ruled the option out. That is how a PM learns the engineer understood the business, and it is the kind of judgment people are looking for when they decide who to trust with bigger work.

## Put the engineering detail below the fold, and keep it honest

Below the first page, the doc is a normal engineering document: data model changes, API contracts, migration plan, rollout and rollback, testing approach, monitoring. I keep a few habits here:

- **Diagrams only where words fail.** One sequence diagram for the tricky flow is worth more than five boxes-and-arrows pictures of things everyone already knows.
- **Migration and rollback get their own section.** "How do we undo this if it goes wrong in production?" is the question reviewers ask most, and the one docs answer least.
- **Open questions are listed, not hidden.** A short list of "things we don't know yet, and when we'll find out" is a sign of a careful engineer, not a weak plan.
- **The doc links to what it depends on.** Existing services, earlier decisions, the ticket. If the codebase has a structure like the one I described in [structuring a Laravel SaaS codebase](/article/structuring-laravel-saas-codebase-first-three-engineers/), the doc points to the module boundaries it touches.

## Review it with the PM in the room, not by comment thread

A design doc sent for asynchronous approval tends to get approved and not read. For anything that will take more than a couple of weeks, I book a short call, share the first page, and ask the PM to tell me back what we are building and what we are not.

If they can repeat the scope cuts and the main risk in their own words, the doc worked. If they cannot, I change the doc, not their understanding. Then the engineering review happens separately with the engineers, where the detail below the fold gets argued over properly.

This splits two conversations that go badly when mixed: "is this the right thing to build?" and "is this the right way to build it?"

## When a full design doc is the wrong tool

Not every change needs one, and writing them for small work teaches the team to skim them.

- **The change is small and reversible.** A bug fix, a new admin setting, a one-week feature with no data migration. A clear ticket description and a good pull request are enough.
- **Nobody needs to approve a trade.** If there are no real alternatives, no scope cuts, and no meaningful risk, there is no decision to request.
- **The problem is not understood yet.** If you do not know what you are building, a design doc is premature. Write a one-page problem brief, or build a throwaway spike, and come back with a doc once there is something to decide.
- **The team is two people at one desk.** Talking is faster. Write down the decision afterwards in a few lines so the reason survives.

The opposite failure exists too. Skipping the doc on large, expensive, or hard-to-reverse work (a data migration, a new payment integration, a change to how a public plugin API behaves) is how teams end up with the multi-currency conversation three weeks too late. My rough rule: if undoing it would take more than a week, or if a PM would be upset to learn about a scope cut afterwards, it gets a doc.

## What I check before a design doc goes out

1. **Could someone outside engineering explain the problem after reading the first paragraph?** If it needs our internal vocabulary, rewrite it.
2. **Is the recommendation one or two sentences, near the top?** Not buried after the alternatives.
3. **Is the cost a range with the reason for its width?** And does it say when the range narrows?
4. **Are the scope cuts written as a list the PM will actually see?** Anything a stakeholder would be surprised to lose goes here.
5. **Are the top risks ranked, each with a mitigation or an early test?** Two to four, not twelve.
6. **Does each alternative name what it would be better at?** If every alternative looks obviously bad, the section is not finished.
7. **Is there a rollback plan for anything touching data or payments?**
8. **Does the doc end with the decision needed and a date?** A doc without an ask tends to sit unread.

My verdict: a technical design doc a product manager can read is not a dumbed-down design doc. It is the same thinking, ordered by who needs what. Put the problem, the recommendation, the cost, the cuts, and the risks on the first page in plain words, and put the engineering detail underneath for the people who will review it line by line. Engineers who write this way get fewer surprises, faster approvals, and, over time, the bigger projects, because the people deciding what gets built can see that they understand why it matters.
