---
title: "Estimating engineering work honestly: ranges, risks and what I tell clients"
slug: estimating-engineering-work-honestly-ranges-and-risks
date: 2026-11-17
category: Career
excerpt: "A single-number estimate is a promise made before anyone knows the work. Here is how I give ranges, name the risks that drive them, and narrow the estimate as the project teaches us more, so founders can plan without being surprised."
readTime: 10 min
tags: [estimation, project-planning, engineering-leadership, senior-engineer, communication, founders, agency]
---

# Estimating engineering work honestly: ranges, risks and what I tell clients

> **In short**
> - **The problem:** a founder asks "how long will this take?", gets one number, and builds a launch date, a budget and a marketing plan on it. When the number slips, trust goes with it, even though the slip was predictable on day one.
> - **What I do about it:** I give a range, name the two or three risks that make the range wide, and commit to narrowing it at specific points. The estimate becomes something we manage together, not a guess I defend.
> - **Who this is for:** founders and product owners planning a build, agencies quoting fixed-price work, and engineers who are tired of being held to numbers they made up in a meeting.

The conversation usually goes like this. A founder describes a feature: subscriptions with a free trial, a customer portal, a couple of payment gateways. They ask how long it will take. The engineer, wanting to be helpful, says "about six weeks." Six weeks goes into a slide. The slide goes to investors.

Week four, the team learns that one gateway handles trial-to-paid transitions differently from the other, that the existing user table cannot represent a paused subscription, and that the portal needs to work inside a theme nobody has looked at yet. None of this was hidden. Nobody asked. The project lands at ten weeks, and the founder feels misled.

The engineer was not lying and was not bad at their job. They answered a question about an uncertain thing with a certain-sounding number. That is the mistake I try hardest not to make, and the one I see most often in teams I join.

## A single number hides the part the client most needs to know

When I give one number, I am quietly answering a different question: "what is the most likely outcome if nothing surprising happens?" Software projects are mostly made of surprising things. The client hears "it will be done in six weeks." I meant "six weeks if the gateway docs are accurate, the data model holds, and nobody changes the scope."

The useful information is the spread and what causes it. A founder can plan around "five to nine weeks, and the main unknown is how gateway B handles trials." They can decide to cut gateway B from launch, or to fund a two-day spike to find out, or to tell investors the later date. They cannot do any of that with "six weeks."

So my rule is simple: **I never give an estimate without a range and a reason for the range.**

## Early estimates are wide because the work is still unknown

There is a well-known idea in software estimation called the *cone of uncertainty*, popularized by Steve McConnell. Early in a project, before requirements are settled, estimates can reasonably be off by a factor of four in either direction. As decisions get made (what exactly is in scope, which design, which edge cases matter), the cone narrows. It only narrows because the team actually removes uncertainty, not because time passes.

I do not quote the factor-of-four number to clients; it sounds alarming and it is a rough model, not a law. But I use the shape. At the first conversation I give a wide range and say plainly that it is wide because we have not decided enough yet. After a short discovery phase I give a narrower one. After the first real slice of the feature works end to end, narrower again.

What I avoid is pretending the cone does not exist by putting a narrow number at the wide end. A precise number on day one is not confidence. It is just a guess with fewer digits of honesty.

## I estimate in three numbers, then say which risk moves it

For each meaningful chunk of work I write down three numbers: an optimistic case (things go well), a likely case, and a pessimistic case (the realistic bad version, not a disaster). This is the classic three-point approach. Some teams combine them with the PERT formula, `(optimistic + 4 × likely + pessimistic) / 6`, to get a weighted figure. I find the formula less useful than the conversation it forces.

The value is in the gap between likely and pessimistic. When that gap is large, I ask why, and the answer is almost always one of a short list:

- **Third-party behavior we have not tested.** Payment gateways, shipping APIs, an ERP export. The docs say one thing; production says another.
- **Data we have not seen.** "Migrate the existing orders" is two days or two weeks depending on how clean the data is.
- **Undecided scope.** "A customer portal" can mean a list of invoices or a full self-service account area.
- **Code we have not read.** Changing a legacy plugin or theme is slower than writing new code, and how much slower depends on what is in there.
- **Dependencies on other people.** Design sign-off, API keys, a client's IT team opening a firewall.

A rough worksheet for the subscription example might look like this:

```text
Chunk                        Optimistic  Likely  Pessimistic  Main risk
Data model + migrations      3d          5d      9d           existing user table shape
Gateway A (known)            3d          4d      6d           -
Gateway B (new to us)        3d          6d      12d          trial-to-paid behavior
Customer portal              5d          8d      14d          scope not defined
Emails + notifications       2d          3d      5d           -
Testing + hardening          4d          6d      9d           depends on above
```

The table is not the deliverable. The last column is. It tells the client exactly where to spend a little money to buy certainty.

## Risks go in writing, with what would shrink them

Once the risks are named, I write them down next to the estimate, in plain language, with one action that would reduce each one:

- *Gateway B trial behavior is unknown.* A two-day spike in their sandbox will tell us whether it matches gateway A.
- *Portal scope is open.* A one-page list of what a customer can do in the portal at launch, signed off by the product owner.
- *Existing user data may not fit.* Read-only access to a production copy for one day.

This turns a vague "it depends" into a short list of decisions the client controls. Founders are usually fine with uncertainty. What they hate is uncertainty they found out about late. Writing it down early moves the bad news to the cheapest possible moment.

It also protects the team. When gateway B does turn out to be awkward, nobody is surprised and nobody is blamed. We pointed at it in week one.

## Narrow the range at agreed checkpoints, not when someone asks

An estimate that never gets updated is just an old guess. I agree up front on when I will re-estimate: after discovery, after the riskiest spike, and after the first end-to-end slice works. At each checkpoint I send the new range and what changed.

The order of work matters here. I schedule the riskiest pieces first, deliberately. If gateway B is the biggest unknown, it goes in week one, not week five. That way the range narrows fast, and if the news is bad, the client has the most time to react. Teams that do the easy parts first feel productive for a month and then discover the hard part when there is no slack left.

This is the same habit I relied on owning the Paysera WooCommerce gateway plugin from spec to maintenance through the PSD2 and SCA rollout: the uncertain part of payments work is almost always the external flow (redirects, authentication, edge cases in how a bank responds), so that is what gets proven first.

## Padding is not honesty, and neither is optimism

Two common habits look like estimation but are not.

**Silent padding.** The engineer thinks four weeks, says eight, and hopes nobody asks. It feels safe, but it destroys the information. The client cannot tell which parts are uncertain, cannot make trade-offs, and eventually learns to discount every estimate by half, which pushes engineers to pad more. If there is buffer, I show it as buffer and say what it is for.

**Optimism under pressure.** Someone senior says "that should only take a week, right?" and the number bends to fit. I would rather have an awkward minute in a meeting than an awkward month later. My usual response is "I can see a version that fits in a week; here is what it leaves out," which keeps the conversation about scope, where it belongs.

## When not to estimate this carefully

Not every question deserves a three-point table with a risk register.

- **Small, familiar work.** A change I have made many times before, in code I know, gets a quick answer like "half a day, maybe a day." The process should cost less than the uncertainty it removes.
- **Pure exploration.** If the honest answer is "we do not know if this is possible," I do not estimate the build. I estimate a time-boxed investigation: "give me three days and I will come back with whether it works and a real estimate."
- **Teams that ship continuously.** On a product team with a steady flow of small changes, forecasting from past throughput is often more accurate than estimating each ticket. Detailed estimates matter most at the boundaries: new projects, fixed-price quotes, launch dates with outside commitments.
- **Fixed-price contracts with no change process.** A range does not help if the contract treats the low end as a promise. In that case the honest move is to fix the scope tightly, price the pessimistic case, and agree in writing how changes are handled. I covered the milestone side of this when writing about [hiring a freelance WordPress plugin developer](/article/hiring-a-freelance-wordpress-plugin-developer/).

The trade-off is real: ranges and risk lists take time and can read as hedging to someone who wants a number. I keep the client-facing version short. One range, three risks, the next checkpoint. The worksheet stays with the team.

## How I phrase it to a client

The words matter as much as the numbers. A typical message from me looks like this:

```text
Rough range: 5 to 9 weeks for the subscription launch.

What makes it wide:
1. Gateway B's trial handling is new to us. A 2-day sandbox spike settles it.
2. Portal scope is open. A one-page "what customers can do at launch" list settles it.
3. Existing user data may need reshaping. One day with a read-only copy settles it.

I'll send an updated range after the spike (end of week 1) and again when
the first subscription can be created and renewed end to end.
```

It fits in a chat message. It gives the founder something to plan with, three concrete decisions, and two dates when the picture will get clearer. If I need to write more than this, the work probably needs a short [technical design doc](/article/technical-design-doc-a-product-manager-can-read/) rather than a longer estimate.

## What I check on a project like this

1. Every estimate I send has a range and a stated reason for its width.
2. Each chunk of work has optimistic, likely and pessimistic numbers, and the large gaps are explained.
3. The top risks are written in plain language, each with one action that would reduce it.
4. The riskiest work is scheduled first, so the range narrows early.
5. Re-estimate checkpoints are agreed before work starts, with dates.
6. Any buffer is visible and labeled, not hidden inside the numbers.
7. Scope changes trigger a re-estimate in writing, not a quiet absorption.
8. Unknown-feasibility work gets a time-boxed spike, not a build estimate.

An estimate is a tool for making decisions, not a test the engineer passes or fails. The most senior thing I can do when someone asks "how long?" is tell them what I know, what I do not, and how we will find out, quickly and in writing. Clients forgive a range that turns out wide. They rarely forgive a confident number that was never true.
