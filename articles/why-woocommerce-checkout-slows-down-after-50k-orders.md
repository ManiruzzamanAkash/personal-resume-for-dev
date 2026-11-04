---
title: Why your WooCommerce checkout slows down after 50K orders
slug: why-woocommerce-checkout-slows-down-after-50k-orders
date: 2026-11-04
category: WooCommerce
excerpt: "A WooCommerce checkout that was fast at launch often crawls once the store has years of orders. The cause is rarely traffic. It is data that grew, work that runs inside the checkout request, and tables nobody cleans."
readTime: 10 min
tags: [woocommerce, checkout, performance, hpos, action-scheduler, mysql, ecommerce]
---

# Why your WooCommerce checkout slows down after 50K orders

> **In short**
> - **The problem:** a checkout that took a second or two at launch now takes five to ten, and some customers give up before the "Thank you" page loads. Every abandoned payment is a lost order you already paid to acquire.
> - **What I do about it:** measure what actually runs during one checkout request, then fix the three usual causes: order data stored in the wrong shape, tables that only grow, and plugins doing slow work while the customer waits.
> - **Who this is for:** WooCommerce store owners and agencies running stores with tens of thousands of orders, especially ones that have been live for several years.

The pattern looks the same on almost every store where it happens. Nothing changed. No new theme, no traffic spike. But over a few months the "Place order" button started spinning longer, support tickets mention double charges because customers clicked twice, and the hosting company's answer is a bigger plan.

The bigger plan helps for a few weeks, then the problem comes back. That is the tell. When a checkout gets slower in proportion to how much history the store has, not how many people are shopping right now, the cause is data growth. More CPU does not fix a query that reads a table ten times larger than it was last year.

"50K orders" is not a magic line. Some stores feel this at 20K, some never feel it at 200K. What matters is the shape of the data and the work attached to each order. Here is where I look, in the order I look.

## Checkout is a write-heavy request, so it suffers first

Most of a WooCommerce site is reads: product pages, category pages, the cart. Those can be cached at the page level, and usually are. Checkout cannot. Placing an order creates a new order record, writes its line items and metadata, reduces stock, records coupon usage, updates the customer, and schedules follow-up jobs. Then the payment gateway runs, and the order is updated again.

That means checkout is the one request that touches the biggest, fastest-growing tables on every single call, with no page cache in front of it. Whatever is slow in your database shows up there first. If the storefront feels fine and checkout is slow, that is not a contradiction. It is exactly what data growth looks like.

## Orders stored as posts get slower with every order you take

For most of WooCommerce's history, orders were stored as WordPress posts, with every order detail (billing email, totals, payment method, and dozens more) saved as a separate row in `wp_postmeta`. That table is shared with every product, page, and plugin setting on the site. A store with years of orders ends up with a postmeta table measured in millions of rows, where order data is mixed in with everything else and most lookups go through a column that is not indexed for value searches.

High-Performance Order Storage (HPOS) fixes the shape. It moves orders into dedicated tables with proper columns and indexes. WooCommerce has enabled it by default for new installations since version 8.2 (October 2023), but **stores that existed before that are often still on the old post storage**, because switching is a manual step under WooCommerce → Settings → Advanced → Features.

Two things I check here:

- **Is the store on HPOS at all?** If not, that migration is usually the single biggest structural improvement available. It is also the riskiest one, because every plugin that reads orders directly from postmeta will break or silently return nothing. I wrote about the code side in [HPOS-ready WooCommerce plugins](/article/hpos-ready-woocommerce-plugins-data-access/).
- **Is compatibility mode still on?** Compatibility mode keeps the old posts tables in sync with the new HPOS tables so you can switch back. That is the right setting during a migration. Left on permanently, it means every order is written twice, inside the checkout request. Once every plugin on the store has been confirmed HPOS-compatible and the store has run cleanly for a while, turning sync off removes that duplicate work.

## Tables that only grow quietly tax every request

WooCommerce and its plugins create several tables that grow with every order and are rarely cleaned. None of them is a problem at launch. All of them are a problem after a few years.

### Action Scheduler history

Action Scheduler is the background job queue WooCommerce and many plugins use: sending emails, syncing analytics, retrying webhooks, processing subscriptions. Each order can schedule several jobs, and each job leaves a row plus log entries behind.

By default, completed actions are purged after 30 days (adjustable with the `action_scheduler_retention_period` filter). The trouble is failed and canceled actions, and plugins that schedule far more jobs than they need. The failure I see most often is a plugin that schedules a job per order per event and never cleans up its failures, so the actions table and its log table end up much larger than the orders table itself. Checkout then writes into that oversized table on every order.

What I look at: the count of actions by status and hook in WooCommerce → Status → Scheduled Actions, and which hooks dominate the failed list. A hook that fails thousands of times is a bug to fix, not a log to delete. More on queue design in [Action Scheduler patterns for WooCommerce plugins](/article/action-scheduler-patterns-woocommerce-plugins/).

### Sessions, transients, and autoloaded options

WooCommerce keeps cart sessions in their own table and cleans up expired ones on a schedule. If WP-Cron is not running reliably (common on low-traffic stores or hosts that disable it without adding a real cron job), that cleanup does not happen and the table keeps growing.

The other usual suspect is `wp_options`. WordPress loads every "autoloaded" option into memory on every request, checkout included. Plugins that store large blobs, or expired transients that were never cleared, can turn that single query into megabytes of data loaded before WooCommerce even starts. This is not order-related, but stores with many years of plugins installed and removed almost always have it.

### Coupon usage records

Coupons with per-customer usage limits work by recording who used them. On a long-running coupon (a permanent welcome code, say), that record grows with every use, and validating it at checkout means reading it back. Usually this is small. On a store that has run one public coupon for years, it is worth checking.

## Plugins doing slow work while the customer waits

The second big cause is not data at all. It is code hooked into the checkout that does slow things synchronously, so the customer waits for them.

Typical examples:

- A CRM or email-marketing plugin that calls an external API when the order is created, and waits for the response.
- An ERP, accounting, or fulfillment sync that runs on the "order processed" hook instead of in a background job.
- A "first order" or loyalty discount that checks the customer's history by querying all their past orders, which gets slower as the store gets older.
- A sequential order number plugin that finds the next number by scanning existing orders.
- Fraud checks, address validation, or tax lookups with no timeout, so a slow third party becomes a slow checkout.

Each one adds a few hundred milliseconds on a good day. On a bad day, when one external service is slow, the whole checkout hangs on it. The fix is the same for all of them: anything that is not needed to take the payment and confirm the order moves into a background job. The customer should wait for the order to exist, not for your CRM to acknowledge it.

Checkout and payment code is where much of my work has been (the Paysera WooCommerce gateway, Dokan's checkout and vendor-payout modules, SureCart's payment integrations), and the rule I apply there is simple: the request that takes the money does the minimum, and everything else is queued with retries. Third-party code that breaks that rule is the first thing I look for on a slow store.

## Measure one checkout before changing anything

All of the above are hypotheses until you measure. The order I work in:

1. **Reproduce on a copy of production data.** A staging site with 200 test orders will never show this problem. You need a recent copy of the real database, with personal data scrubbed if it leaves production.
2. **Profile one checkout request.** Query Monitor works for a quick look; an APM tool such as New Relic or Tideways is better because it shows time spent in external HTTP calls as well as queries. The question is simple: where do the seconds go?
3. **Sort the slow queries by table.** If they cluster on `wp_postmeta`, the answer is HPOS. If they cluster on the Action Scheduler tables, it is queue hygiene. If the time is in HTTP calls, it is a plugin doing synchronous work.
4. **Check table sizes.** Rows and data size per table, compared with order count, shows which tables have grown out of proportion.

I covered reading query plans in [MySQL indexes, EXPLAIN, and transactions](/article/mysql-indexes-explain-transactions-i-trust-before-blaming-php/). For checkout, you rarely need to go that deep. The profile usually points at one or two offenders.

## When not to do this

Not every slow checkout is a data-growth problem, and some of these fixes have real costs.

- **If checkout is slow on a new store, look elsewhere.** A fresh store with few orders and a slow checkout has a hosting, theme, or payment-gateway problem. This article is about stores that got slower over time.
- **Do not migrate to HPOS the week before a sale.** The migration itself is safe when done properly, but plugin incompatibilities surface only when real orders flow. Do it in a quiet period, with compatibility mode on and a rollback plan.
- **Do not bulk-delete old orders to "speed things up."** Orders are financial and tax records. Most businesses are legally required to keep them for years. Archive or move them if you must, but deleting them is a business decision, not a performance tweak.
- **Do not blindly delete Action Scheduler rows.** Pending actions are real work: subscription renewals, scheduled emails, webhook retries. Purging the table wholesale can cancel renewals. Clean completed and failed history; leave pending alone.
- **Sometimes the bigger server is the right call.** If the profile shows the database is well shaped and simply busy, more resources or a managed database is cheaper than engineering time. The point is to know which case you are in before paying for it.

## What I check on a store like this

1. Whether the store is on HPOS, and whether compatibility mode (sync to posts) is still on after the migration is done.
2. Row counts and data size for orders, postmeta, Action Scheduler actions and logs, and the sessions table, compared with total order count.
3. Failed and canceled scheduled actions grouped by hook, and which plugin owns the noisiest ones.
4. Total size of autoloaded options in `wp_options`, and the largest individual entries.
5. Whether WP-Cron actually runs, ideally from a real server cron job rather than visitor traffic.
6. Every plugin hooked into order creation and payment completion, and which of them make external HTTP calls synchronously.
7. A profile of one real checkout on a copy of production data, with time split between PHP, queries, and external calls.
8. Timeouts on every third-party call that can run during checkout.

A WooCommerce checkout that slows down as the store ages is not a mystery and usually not a hosting problem. It is the cost of years of order data stored in a shape that was never meant for it, tables that only grow, and plugins that make customers wait for work that could happen later. Measure one checkout, find which of the three it is, and fix that. Most stores need one structural change and a bit of cleanup, not a rebuild.
