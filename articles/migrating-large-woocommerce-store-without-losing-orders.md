---
title: "Migrating a large WooCommerce store without losing orders"
slug: migrating-large-woocommerce-store-without-losing-orders
date: 2026-11-24
category: WooCommerce
excerpt: "Store migrations rarely lose the catalog. They lose the orders and payments that land while the old and new servers both look live. Here is the cutover plan and reconciliation I use so every order ends up in one place."
readTime: 9 min
tags: [woocommerce, migration, hosting, hpos, payments, ecommerce, store-owners]
---

# Migrating a large WooCommerce store without losing orders

> **In short**
> - **The problem:** when a busy WooCommerce store moves to a new server, orders and payments placed during the switch can land on the old copy and silently disappear. The store owner finds out days later, from customers asking where their parcel is.
> - **What I do about it:** I treat the move as a short, planned cutover with a write freeze, keep the old server listening for payment notifications, and prove the result with counts and a payment reconciliation instead of "the homepage loads."
> - **Who this is for:** WooCommerce store owners and agencies moving a store with steady daily orders to a new host, a new stack, or new order storage.

The migration looks finished. The new server is fast, the homepage loads, the test order went through. Three days later a customer emails: they paid, they got a receipt from the payment provider, and the store has no record of them.

What happened is almost always the same. For a few hours, two copies of the store were live. Some visitors still resolved the domain to the old server, placed orders there, and those orders were never copied across. Or the payment provider sent its "payment completed" notification to the old server, which marked an order paid that no longer mattered.

Copying a WooCommerce store is easy. Moving one that takes orders every few minutes, without losing any, is a cutover problem. That is what this article is about.

## Orders are lost in the gap between the last copy and the switch

A migration has one dangerous window: from the moment you take the final database copy until every customer, crawler and payment provider is talking only to the new server.

Anything written to the old database in that window is at risk:

- **New orders** from visitors whose DNS (the internet's address book) still points at the old server.
- **Payment status changes** from gateway webhooks, the server-to-server messages Stripe, PayPal and others send when a payment succeeds, fails or is refunded.
- **Background jobs** such as subscription renewals, stock syncs and scheduled emails, which keep running on the old server unless someone stops them.
- **Admin edits** from staff who did not know the move was happening.

The catalog, pages and media rarely cause trouble, because they change slowly. Orders, customers, stock levels and payment state change constantly, and those are the tables that matter.

## Never let two servers take orders at the same time

The tempting plan is "copy everything, switch DNS, then copy the new orders across later." It fails for a mechanical reason.

WooCommerce order IDs come from an auto-incrementing counter. With HPOS (High-Performance Order Storage, WooCommerce's dedicated order tables), IDs are still reserved through a placeholder row in the posts table. If both servers accept orders after the copy, both hand out the same next IDs. Now there are two different orders numbered 48211, with different customers, and merging them means renumbering one, which breaks the order number already printed on a customer's receipt and stored at the payment gateway.

So my rule is simple: at any moment exactly one database is allowed to accept writes. The migration is the act of moving that permission, once, deliberately.

## Freeze writes for a short window instead of racing them

For most stores I plan a short, announced write freeze rather than a clever live sync. Ten to thirty minutes in a quiet hour is usually enough for a database export and import, and it is much easier to reason about than a replication setup.

The sequence on the old server:

1. **Lower the DNS TTL a day or two ahead.** TTL is how long resolvers cache the domain's address. A low value means the switch propagates quickly instead of over many hours.
2. **Close checkout, not the whole site.** A banner and a disabled "Place order" button keep browsing and SEO intact. Full maintenance mode works too, but costs more traffic.
3. **Stop background work.** Disable the system cron that triggers WordPress, set `DISABLE_WP_CRON` to `true`, and check that Action Scheduler (WooCommerce's job queue) has nothing running before the export.
4. **Take the final export** and note the highest order ID and the latest order date.

```sql
-- Record these before export; compare after import.
SELECT status, COUNT(*) FROM wp_wc_orders GROUP BY status;
SELECT MAX(id), MAX(date_created_gmt) FROM wp_wc_orders;

-- If the store still uses legacy order storage:
SELECT post_status, COUNT(*) FROM wp_posts
WHERE post_type = 'shop_order' GROUP BY post_status;
```

Then import on the new server, run the same queries, and only reopen checkout once the numbers match. The old server stays frozen. It never takes another order.

Background jobs deserve a second look on the new server too. Pending Action Scheduler jobs come across with the database, which is what you want for renewals, but a job that was halfway through on the old server may run again. I wrote about making those jobs safe to repeat in [Action Scheduler patterns for WooCommerce plugins](/article/action-scheduler-patterns-woocommerce-plugins/).

## Payment gateways keep talking to the old server

This is the part teams forget. Customers follow DNS; payment notifications often do too, but on their own schedule, with their own caching and retries. A payment started before the freeze can complete after it, and its webhook may arrive at whichever server the gateway resolves.

What I do:

- **Keep the old server running for a few days**, with checkout closed but webhook endpoints logging every request they receive.
- **Check the gateway dashboards** for configured webhook and IPN (instant payment notification) URLs. Most point at the domain and need nothing, but some stores have a hard-coded IP, a staging URL, or an old subdomain set up years ago.
- **Reconcile against the gateway, not against WooCommerce.** For the freeze window and the days after, list every successful charge in the gateway dashboard and confirm each one maps to a paid order on the new server. The gateway is the source of truth for money.

When I owned the Paysera WooCommerce plugin end to end, reconciliation tooling was part of that job for a reason: the payment provider and the store disagree more often than anyone expects, and the merchant only trusts the store's numbers if someone checks them against the money.

## Change one thing at a time: host, storage, or platform

"Migration" covers three different moves, and doing them together multiplies the risk:

- **A host or stack move:** same WooCommerce, new server, maybe new PHP version, cache layer or CDN.
- **A storage move:** switching orders from the legacy posts tables to HPOS.
- **A platform move:** bringing orders in from another platform, or out of WooCommerce entirely.

If a store needs both a new host and HPOS, I do them as separate projects. Move the host first and let it settle; then switch storage. WooCommerce ships WP-CLI commands for the storage step, so it can be checked rather than hoped for:

```bash
wp wc hpos status              # current authoritative store and sync state
wp wc hpos count_unmigrated    # orders still pending sync
wp wc hpos sync                # sync between posts and HPOS tables
wp wc hpos verify_data         # compare migrated orders with the originals
wp wc hpos compatibility-info  # plugins marked incompatible or uncertain
```

`verify_data` has a `--re-migrate` flag that overwrites orders failing verification. I only use it after reading a few of those failures with `wp wc hpos diff <order_id>` and understanding why they differ. Plugin compatibility is the other half of that step; I covered the data-access side in [HPOS-ready WooCommerce plugins](/article/hpos-ready-woocommerce-plugins-data-access/).

## Prove it with numbers, not with a homepage

A migration is done when the numbers agree, not when the site looks right. My acceptance check after cutover:

- **Order counts by status** match the pre-export snapshot, plus any orders placed since reopening.
- **The highest order ID** on the new server is above the old maximum, so new orders cannot collide with archived ones.
- **A real low-value order** goes through end to end with a live payment method, triggers its emails, and the webhook updates its status. Then refund it.
- **Gateway reconciliation** for the window shows no charge without a matching paid order.
- **Old-server webhook logs** are empty, or every entry has been handled on the new server.
- **Customer accounts** can log in, and saved payment methods still work for subscription renewals.

For staging rehearsals, the usual guardrails apply: no real emails, gateways in test mode. I wrote about why those rehearsals can still mislead in [production debugging for WordPress plugins](/article/production-debugging-wordpress-plugins-staging-lies/).

## Trade-offs: when a freeze is the wrong tool

A write freeze is the simplest safe option, but it is not free, and it is not always right.

- **Stores that cannot close checkout at all.** If every minute of closed checkout is real lost revenue, a replication-based move (the new database follows the old one live, then you promote it) shortens the window to seconds. It also needs someone who has run database replication before, and a rehearsal. I would only take that on when the downtime cost clearly outweighs the extra risk.
- **Small stores.** A store with a handful of orders a day does not need this ceremony. A host's migration tool, a quiet evening and a manual check of the last few orders is proportionate.
- **Long DNS caches you cannot control.** Some corporate networks and resolvers ignore low TTLs. Keeping the old server frozen and logging, rather than switched off, is what protects you there.
- **"We'll fix the orders afterwards."** Merging orders from two live databases is possible, but slow, error-prone, and visible to customers through changed order numbers. I treat it as incident recovery, not a plan.

## What I check on a project like this

1. Exactly one database accepts writes at any moment, and everyone on the team knows which.
2. DNS TTL was lowered at least a day before the cutover.
3. Checkout is closed, cron is off, and Action Scheduler is idle before the final export.
4. Order counts by status and the highest order ID are recorded before export and compared after import.
5. Webhook and IPN URLs are checked in every gateway dashboard, and the old server logs incoming notifications for several days.
6. Gateway transactions for the cutover window are reconciled one by one against paid orders.
7. Host, storage (HPOS) and platform changes happen as separate steps, each verified.
8. A live low-value order and refund pass end to end before the move is called finished.

Moving a WooCommerce store is not a file-copy problem. It is a question of where the truth lives at each minute of the switch. Decide that in advance, freeze writes instead of racing them, keep listening on the old server, and check the result against the payment provider. Do that and the only thing customers notice is a faster store.
