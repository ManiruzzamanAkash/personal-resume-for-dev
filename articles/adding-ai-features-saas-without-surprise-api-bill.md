---
title: "Adding AI features to a SaaS without a surprise API bill"
slug: adding-ai-features-saas-without-surprise-api-bill
date: 2026-11-14
category: AI Engineering
excerpt: "AI features are cheap in a demo and expensive at scale, because every click becomes a paid API call nobody priced. Here is the architecture I use to keep model costs measured, capped per customer, and built into the plan."
readTime: 11 min
tags: [ai, llm, saas, laravel, cost-control, prompt-caching, architecture, founders]
---

# Adding AI features to a SaaS without a surprise API bill

> **In short**
> - **The problem:** an AI feature that cost almost nothing in testing becomes one of the biggest lines on the monthly bill once real customers use it, and nobody can say which feature or which customer is spending the money.
> - **What I do about it:** route every model call through one place in the code that records its cost, give each customer and each feature a budget, avoid calls that don't need to happen, and price the feature into the plan before launch.
> - **Who this is for:** founders and engineering leads adding AI writing, summaries, search or assistants to an existing SaaS product.

The usual story goes like this. A team adds an "AI summary" button to their product. In staging it is magic, and the API invoice for the month of testing is a rounding error. The feature ships, a few large customers love it, and one of them wires it into a script that summarizes every record every night.

The next invoice is a surprise. Worse, nobody can answer the obvious questions. Which feature spent the money? Which customer? Was it real usage or a retry loop? The model provider's dashboard shows a total per API key, and the whole product shares one key.

That is not a model problem. It is an architecture problem: the cost of an AI feature was never designed, only discovered. Here is how I shape the system so it is designed.

## The bill is three numbers you can estimate before launch

Every model provider bills by tokens, roughly pieces of words, counted separately for what you send (input) and what the model writes back (output). Output tokens are priced several times higher than input tokens on current models, so a feature that writes long answers costs more than one that reads long documents and answers briefly.

That makes the monthly cost of a feature roughly:

**calls per active user × tokens per call × price per token × active users**

Each of those numbers can be estimated before launch. Run the feature on twenty realistic inputs and record the input and output tokens. Ask product how often a typical user will trigger it, and how often a heavy user will. Multiply. The heavy-user number matters more than the average, because one automated customer can outspend a thousand normal ones.

If the estimate is uncomfortable, that is the best possible time to find out: before the feature exists, when the fix is a design change rather than a pricing apology.

## Every model call goes through one gateway in your own code

The single most useful decision is boring: no controller, job or component talks to a model provider directly. Everything goes through one service in the application, which I usually call the AI gateway. It is the only code that knows API keys, and the only code that is allowed to spend money.

In a Laravel app it looks something like this:

```php
final class AiGateway
{
    public function __construct(
        private ModelClient $client,      // thin wrapper around the provider SDK
        private AiBudget $budget,
        private AiUsageLog $usage,
    ) {}

    public function complete(AiRequest $request): AiResponse
    {
        // 1. Refuse before spending, not after.
        $this->budget->assertCanSpend($request->tenantId, $request->feature);

        $response = $this->client->complete(
            model: $request->model,
            system: $request->system,
            messages: $request->messages,
            maxOutputTokens: $request->maxOutputTokens, // always set
        );

        // 2. Record what it actually cost, tagged by who and why.
        $this->usage->record(
            tenantId: $request->tenantId,
            feature: $request->feature,          // e.g. 'ticket-summary'
            model: $request->model,
            inputTokens: $response->inputTokens,
            outputTokens: $response->outputTokens,
            cachedTokens: $response->cachedTokens,
        );

        return $response;
    }
}
```

Three things in there carry the whole design. Every request names a **tenant** and a **feature**, so the usage table can answer "who spent what on which feature" with a `GROUP BY`. Every request sets a **maximum output length**, because an unbounded answer is an unbounded cost. And the budget is checked **before** the call, because a log that tells you about overspending tomorrow does not stop it today.

The provider SDK sits behind `ModelClient`, which also means switching models or providers later is a change in one class. That is a nice side effect, not the main goal. The main goal is that money only leaves through one door.

## Budgets belong to customers and features, not to the API key

Providers let you set spend limits on an account or project, and you should. But that limit is a fuse for the whole product. When it trips, every customer loses the feature at once, including the ones on your most expensive plan.

The budget that protects the business lives in the application:

- **Per tenant, per period.** A monthly allowance of tokens or credits that matches the customer's plan. I keep a running counter in Redis for the fast check and reconcile it against the usage table, so a lost counter never means free usage.
- **Per feature.** A ceiling on what any one feature can spend across all tenants in a day. If a new feature has a bug that loops, it burns its own allowance, not the product's.
- **Per request.** Limits on input size and output length, so one pasted 300-page document cannot become one very expensive call.

If the product is multi-tenant, the tenant ID is already on every request; the same boundary I described in [choosing a Laravel multi-tenancy model](/article/laravel-multi-tenancy-single-database-schema-or-database-per-tenant/) is the natural place to hang a budget. When a tenant runs out, the feature should say so clearly and offer an upgrade or a reset date. An error that looks like an outage costs you more in support than the tokens would have.

## The cheapest call is the one you don't make

Most of the savings I find in a review are not clever prompts. They are calls that never needed to happen:

- **Generating on every keystroke.** Suggestions that fire as the user types should wait for a pause, and should be cancelled when a newer request replaces them.
- **Regenerating unchanged content.** A summary of a record that hasn't changed since yesterday is yesterday's summary. Store results with a hash of the input and reuse them until the input changes.
- **Duplicate work across users.** If fifty users open the same help article and ask for "explain this page", that is one generation, cached, not fifty.
- **AI where a rule would do.** Classifying a ticket as "billing" because it contains the word "invoice" does not need a model. Use the model for the cases the rule can't decide.

Caching AI output has the same pitfalls as caching anything else: stale results and many requests regenerating the same thing at once. The patterns from [Redis caching in Laravel](/article/redis-caching-laravel-stampedes-invalidation-i-trust/), locks and explicit invalidation, apply unchanged.

## Prompt shape decides how much caching can save

Separate from caching your own results, the major providers cache the beginning of a prompt on their side and bill repeated beginnings at a steep discount. OpenAI does this automatically on supported models once the prompt is long enough (1,024 tokens on its current models), and says cached input can be discounted by up to 95 percent. Anthropic's prompt caching bills cache hits at a small fraction of the normal input price.

Both work on the same rule: only an **identical prefix** is reused. That has a direct consequence for how you build prompts:

1. Put the stable parts first: system instructions, tool definitions, product documentation, few-shot examples.
2. Put the changing parts last: the user's question, the current record, today's date.

The failure I see most often is a timestamp or a user's name in the first line of the system prompt. It looks harmless, and it makes every request's prefix unique, so nothing is ever reused. Moving one line to the end of the prompt can be the largest single cost reduction in the whole feature.

## Use a small model by default and a large model on purpose

Model tiers differ a lot in price. For many product features, such as extracting fields, tagging, short rewrites and routing a question to the right place, a small, fast model is good enough, and much cheaper per call.

I make the model a decision per feature, written down with a reason, not a global setting. The default is the smallest model that passes the feature's test set. A feature moves to a larger model when its test results show the small one failing, not because the large one felt better in a demo. That requires a test set of realistic inputs, which you need anyway to know whether a prompt change made things better or worse.

## Background work goes to queues and batch endpoints

Not every AI task needs an answer in the next two seconds. Nightly digests, bulk tagging of imported records, re-summarizing a knowledge base: these can wait.

Work that can wait should run in a queue, with its own rate limit and its own budget, so a bulk job never competes with interactive users. Where the provider offers a batch endpoint, use it. Anthropic's Batch API, for example, processes requests asynchronously at 50 percent off both input and output tokens. For a nightly job, half price for an answer that arrives later is an easy trade.

Queues also give you retries with limits. A retry policy that resends a failed request forever is one of the quieter ways to spend money on nothing. Cap attempts, back off, and log the final failure. My notes on [running Laravel Horizon in production](/article/laravel-horizon-production-patterns-i-trust/) cover the queue side.

## Agents need a step limit and a spend limit

Agent-style features, where the model calls tools, reads the results and decides what to do next, are the hardest to cost. One user request can become five model calls or fifty, and each step sends the growing conversation back as input.

Every agent loop I build has a hard maximum number of steps, a maximum spend per run, and a clear message to the user when either is reached. The agent should also see only the tools it needs, the same narrow-tools principle I use when [building an MCP server for WordPress](/article/building-mcp-server-wordpress-site-safely/): fewer tools means shorter prompts and fewer wrong turns.

## Price the feature before you launch it

The last piece is not engineering, but engineering has to support it. If AI usage is unlimited on every plan, your heaviest users set your margin. The common honest options:

- **Included allowance per plan**, with a clear meter in the account and an upgrade path.
- **Credits** that different features consume at different rates, which maps directly onto the per-feature cost you are already recording.
- **Bring your own API key** for technical customers who want unlimited usage at their own cost.

Whichever model you choose, the usage table from the gateway is what makes it possible. Without per-tenant, per-feature cost data, pricing is a guess.

## When this is more architecture than you need

Not every product needs all of this on day one:

- **An internal tool used by ten staff** needs a provider spend limit and output caps. A tenant budget system would be overbuilding.
- **A prototype testing whether customers want the feature at all** should ship with a gateway and a usage log, because they are cheap and you need the data. Budgets and pricing can wait for evidence that the feature matters.
- **A feature where every call is triggered by a paid action**, such as a per-document fee, already has its cost covered by its revenue. Watch the margin, but you don't need a quota.

The gateway and the usage log are the parts I would never skip. Retrofitting them after launch means finding every place that calls a provider, and by then you have a bill you can't explain.

## What I check before an AI feature ships

1. **Is there one gateway?** No code outside it holds an API key or calls a provider.
2. **Is every call tagged with tenant and feature,** with input, output and cached tokens recorded?
3. **Does every request set a maximum output length** and a maximum input size?
4. **Is there a per-tenant and a per-feature budget,** checked before the call, with a clear message when it runs out?
5. **Are results cached by input hash,** and do typing-driven features wait for a pause?
6. **Is the static part of the prompt first** and the changing part last?
7. **Is the model choice per feature backed by a test set,** with the smallest passing model as the default?
8. **Do background jobs and agents have retry, step and spend caps,** and use batch endpoints where latency doesn't matter?

My verdict: AI features rarely become expensive because the models are expensive. They become expensive because cost was left out of the design, so nobody can see it, cap it or charge for it. Put every call behind one gateway, record who and what it was for, budget per customer and per feature, and decide pricing before launch. Then the bill is a number you planned, not a number you discover.
