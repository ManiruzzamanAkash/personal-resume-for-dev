---
title: "The slow way to become an engineer whose opinion changes rooms"
slug: the-slow-way-to-become-an-engineer-whose-opinion-changes-rooms
date: 2026-04-22
category: Career
excerpt: A four-phase practice I'm using to grow from "fast hands" into "trusted judgment". No shortcuts, no productivity hacks — just the actual gradient, with the specific habits I'm running each week.
readTime: 9 min
tags: [career, engineering-practice, judgment, mentorship, ai]
---

# The slow way to become an engineer whose opinion changes rooms

In a [previous post](/article/trading-fast-hands-for-trusted-judgment/) I argued that the engineers who'll matter in 2026 aren't the ones with the highest PR throughput — they're the ones whose opinion in a meeting changes the decision.

A few people read it and asked the right follow-up: *okay, how do I actually become that?*

This is my honest answer. It's not a hack and it's not fast. It's a multi-year practice with a real gradient, and most of the people who stay silent in meetings are stuck somewhere on it. Below is the version I'm running on myself — the same path I'd walk if I were starting over today.

## Why most engineers never start

Before the practice, the meta-point: **judgment that moves rooms isn't a personality trait, an age thing, or a "naturally confident person" thing.** It's a trained capacity. And the reason most engineers never train it is that the first few times you offer an opinion that turns out wrong, it stings. So they retreat to "I'll just execute the ticket" and stay there forever.

The people whose opinions move rooms aren't smarter than the rest of us. They've just been doing one specific practice for longer: thinking out loud, being accountable to their reasoning, and updating publicly when they're wrong. That's the entire mechanism. Everything below is just structured reps of it.

## Phase 1 — Develop opinions you can defend

**Time horizon: month 1–3.**

Right now, when you read a technical decision — a framework choice, an architecture pattern, a library tradeoff — notice whether you have an actual opinion or just a vague preference. Most engineers have vague preferences they call opinions. Real opinions have *reasons*, and the reasons survive being challenged.

Pick **one technical decision a week**. Could be from your own work, an HN comment thread, a podcast, a PR you're reviewing. Open a note and write down four things:

```
1. I think X is the right call here.
2. Because A, B, C.
3. The strongest argument against my view is Y.
4. I'd change my mind if Z.
```

Line 4 is where the magic is. Engineers who say *"I'd change my mind if Z happened"* are immediately taken more seriously than engineers who hold positions absolutely. **Calibrated confidence is the rarest thing in technical conversations.** Most engineers I work with are wildly overconfident; a few are wildly underconfident; very few are accurate. The four-line template is a deliberate exercise in becoming accurate.

You don't need to publish these. You're training a muscle, not building a brand. After two months of doing this every week, you'll notice your opinions arrive faster, sharper, and with a built-in self-check.

I keep my notes in a single Markdown file called `opinions.md` and I review the old entries every couple of months. The most useful thing about that review is seeing which of my "would change my mind if Z" conditions actually came true — and noticing whether I actually changed my mind when they did.

## Phase 2 — Speak up in low-stakes places first

**Time horizon: month 2–4.**

This is where most people stall, so I'll be direct: **you have to start saying things out loud.** But not in your highest-stakes meeting first. That's how people get burned and retreat to silence.

Start with PR reviews. Instead of "LGTM" or surface-level nitpicks, leave **one substantive comment** on every meaningful PR. About an architectural choice, a naming pattern, a failure mode you're worried about, a tradeoff you'd have made differently. The register you want is *confident but inviting*:

> "I think this works as written, but I wonder if we'll regret X when we hit Y. Curious what you think."

That phrasing is the whole skill. It signals you've thought about it, you have a position, and you're open to being wrong. It's the inverse of both *aggressive contrarian* and *passive reviewer*.

Once PR comments feel natural, graduate to **Slack threads in your team channel**. Same rule: one substantive opinion per thread you're meaningfully part of. Then to **standup updates** — instead of "I'm continuing on X", try "I'm continuing on X, and I'm starting to think we should reconsider Y because Z."

Then, finally, to actual meetings. By the time you get there, you've practiced the underlying skill — *forming and expressing reasoned opinions in real time* — hundreds of times in lower-stakes contexts. The room itself is no longer the hard part.

For me personally, the move from PR comments to Slack threads took about three weeks. Slack threads to standup took longer — maybe two months — because standup felt more public. Meetings I'm still working on. The gradient is real, and trying to skip a step usually means stalling out at the next one.

## Phase 3 — Ask the question that reframes the discussion

**Time horizon: month 4–8.**

This is the upgrade from *"has opinions"* to *"moves rooms"*. It's a different skill entirely.

The engineers whose opinions change decisions usually don't win by advocating harder for their view. They win by **asking the question nobody else thought to ask** — the question that slows the room down at exactly the right moment and reframes what we're actually deciding. Things like:

- *"What problem are we actually solving here? I'm not sure I can articulate it."*
- *"What does this look like at 10x scale — does it still hold?"*
- *"What's the cost of being wrong about this, in each direction?"*
- *"Are we choosing this because it's right, or because it's familiar?"*
- *"What would have to be true for the opposite decision to be correct?"*

These questions don't require you to be the smartest person in the room. They require you to be the person who *paused the room*. That's a different mechanism than winning an argument — it's the mechanism by which judgment actually changes decisions: not by force, but by reframing.

Practice this silently first. In any technical discussion — a meeting, a Slack thread, a PR — ask yourself: *"What's the question nobody is asking right now?"* Even if you don't speak it out loud, you're training the perception. Eventually you'll trust it enough to voice it. And the first time you do, and the room actually pauses to consider it, you'll feel the shift in how you're treated. That feeling is the practice working.

I ran this silent drill for about six weeks before I voiced one. The first time I did was in a SureCart architecture review where everyone was debating implementation details for a new feature, and I asked, "What's the smallest version of this we could ship to learn whether anyone wants it?" The room genuinely paused. The decision changed shape. I wasn't smarter that day — I was the one who stepped out of the implementation conversation and back into the framing one. That was the rep that taught me the move was real.

## Phase 4 — Build a public track record people remember

**Time horizon: month 6–12, then forever.**

This is the long-compounding part of the practice.

Every time you take a position and it turns out right, people remember — but **only if you took the position publicly enough that it could have been wrong**. Private predictions don't count. Hedged predictions don't count. *"I had a feeling"* doesn't count.

So when you have a strong view — especially a contrarian one — say it, and say it clearly enough that you're accountable to it. Six months later, when you're right, nobody needs to remind anyone. The pattern accumulates silently in everyone's head, and one day you notice that your manager is bringing you into decisions earlier and your peers are checking with you before they commit.

And — this is the move that separates good from great — **when you're wrong, say so out loud**.

> "I argued against X six months ago and I was wrong. Here's what I missed: A, B, C. Here's what I'd watch for next time: D."

This single behavior, done a few times, builds more credibility than fifty correct predictions. Because everyone has met the engineer who's loud and right sometimes; almost nobody has met the engineer who tracks their own calibration in public. That person becomes the person whose opinion is trusted, because their opinion comes pre-packaged with a track record of self-correction.

This is the part of the practice I'm worst at. It's genuinely uncomfortable to walk into Slack and write *"I was wrong about X."* My instinct is to quietly update my view and move on, hoping nobody noticed I'd held the old one. I'm trying to do it more deliberately. Every time I do, the response from peers is some version of *"thanks for saying that, I respect you more for it"* — which tells me the underlying social physics actually works. The ones I dodge are the ones that quietly cap how much my opinion is trusted next time.

## The honest uncomfortable parts

A few things I want to name plainly, because the practice doesn't work if you don't:

**You will be wrong, a lot, especially early.** The people whose judgment is now trusted were wrong constantly when they started. They just didn't let being wrong stop them from offering opinions. They treated each wrong call as data: *what made me wrong, what didn't I see, what should I look for next time?*

**The engineer who waits to be sure stays silent forever.** Certainty doesn't come before opinions — it comes from years of having opinions and being checked against reality. Wait for certainty and you wait for nothing.

**You will lose some social capital along the way.** A few opinions will land badly. A couple of meetings will end with someone visibly disagreeing with you. That's not a sign to stop. That's the cost of building the muscle. The compounding is real but you have to pay the entry fee.

**This is a two-to-three year arc to genuinely arrive.** Anyone who promises faster is selling something. The change in how you're perceived starts within six months — most engineers never even start, so just being on the gradient puts you ahead — but the *settled, durable* version of "trusted judgment" takes years.

## What I'd do this week if I were you

Don't try to do all four phases at once. Pick the one you're not yet doing, and run one rep:

- **Not doing Phase 1?** Pick one technical decision happening at your work right now — even a small one. Form an actual opinion, with reasons, using the four-line template above. Just write it down for yourself. That's the rep.
- **Not doing Phase 2?** On the next PR you review, leave one substantive comment instead of just an approval. Use the *"I think this works, but I wonder if we'll regret X when we hit Y. Curious what you think."* phrasing.
- **Not doing Phase 3?** In your next meeting, silently ask yourself *"what's the question nobody is asking?"* — and if you find one, voice it.
- **Not doing Phase 4?** Pick something you were wrong about in the last six months. Write a short Slack message owning it: *"I argued against X. I was wrong. Here's what I missed."* Send it.

That's the whole thing. Pick one phase, run one rep, repeat next week. Two to three years of that and you become the engineer whose opinion changes the decisions in the room.

I'm somewhere in Phase 3 myself, with regular slip-backs to Phase 2 when something feels high-stakes. I expect I'll be working at it for the rest of my career. That's the point — the practice doesn't end when you arrive. It is the arrival.

---

If you're working on the same gradient — or you'd like a senior engineer who's deliberately practicing this on your team or project — [drop me a line](mailto:manirujjamanakash@gmail.com) or [book a 30-minute call](https://calendly.com/manirujjamanakash/new-meeting). I'm freelance-available for engineering work that values judgment as much as throughput.
