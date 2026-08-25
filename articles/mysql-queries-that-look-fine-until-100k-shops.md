---
title: The MySQL queries that look fine until 100K shops open the plugin
slug: mysql-queries-that-look-fine-until-100k-shops
date: 2026-08-25
category: Architecture
excerpt: A plugin can pass code review and still melt a store. The query that costs 2ms on your laptop is a different animal on a WooCommerce database that has been alive for six years.
readTime: 11 min
tags: [wordpress, mysql, plugins, performance, woocommerce]
---

I’ve written about Gutenberg migrations and about SOLID in plugins. This is a different failure mode: **the PHP looks responsible, the schema looks “normal WordPress,” and the site still dies at 2pm on a sale day.**

The code is not lying. Your local database is.

## What “fine” actually meant

On a fresh `wp_posts` with a few hundred rows, almost every query is instant. `WP_Query` with a meta clause. `get_option()` in a loop. `COUNT(*)` for an admin badge. A `LIKE '%sku%'` because the report “just needs to find it.”

Then the plugin ships. Merchants import 40,000 products. Orders pile up for years. `wp_postmeta` becomes the largest table in the database, and nobody on the merchant’s team thinks of it as *your* table. It’s just WordPress.

Your query did not get slower. The data shape you never tested became the real product.

I’ve watched this at plugin scale — SureCart, Dokan-era WooCommerce, payment plugins sitting on stores that never get a DBA. You don’t get a nice APM screenshot from 100K site owners. You get “the checkout hangs” and a one-star review that mentions PHP.

## Meta queries are not a schema

`WP_Meta_Query` is a convenience API. It is not a data model.

A typical “find orders by gateway transaction id” starts as:

```php
new WP_Query([
    'post_type'      => 'shop_order',
    'posts_per_page' => 1,
    'meta_key'       => '_transaction_id',
    'meta_value'     => $txn,
]);
```

That reads clean. On a store with years of orders it is often a join onto a huge `wp_postmeta` plus a non-selective key. MySQL does the honest thing: it looks at statistics, shrugs, and scans more than you wanted.

The fix is not “add an index on `meta_key`.” `meta_key` is already low-cardinality in the way that hurts. Everybody stores `_order_total`, `_customer_user`, `_paid_date`. An index on `meta_key` alone is a phone book sorted by first name.

What actually helps:

- A **custom table** when that lookup is part of your product contract (transaction id → order id is a lookup, not a post).
- Or a **compound index** you own, on a table you own, with a column whose cardinality matches the question you ask.
- If you must stay on post meta, query the **selective** value first and keep the key list tiny. Don’t OR together six meta clauses “for flexibility.”

I treat any `meta_query` that runs on a storefront or webhook as a smell until proven otherwise. Admin-only, paginated, cached: maybe. Checkout path: no.

## Autoload is a silent tax

`add_option( $key, $value, '', 'yes' )` felt harmless in 2018. Autoloaded options ride into every front request via `wp_load_alloptions()`.

One plugin storing a JSON blob of “settings plus last sync log plus the last 500 SKUs we saw” will not show up in your unit tests. It shows up as a 4MB `alloptions` cache and a shop that feels drunk on Redis even when Redis is healthy.

Rules I actually use:

- Autoload **only** what you need on most requests (feature flags, tiny credentials pointers, version).
- Never autoload logs, report dumps, or “we might need this map.”
- If the value can grow, it is not an option. It is a table, or object cache with a key you can delete.
- When you change autoload from yes to no, **purge and re-warm**. WordPress will not magically shrink `alloptions` because you meant well.

`wp_options` is not your document store. Treating it like one is how a well-reviewed plugin becomes the reason a host throttles the site.

## `COUNT(*)` is not a badge

Dashboard widgets love a number. “12,481 abandoned carts.” `SELECT COUNT(*) FROM ...` looks cheap. On InnoDB it is not a free metadata read. On a filtered count (`WHERE status = 'pending' AND created > ...`) it can be a full index walk you run on every `wp-admin` load.

If the number is for humans, it does not need to be exact at 09:00:01.

I store a counter you update when the event happens, or I cache the count for five minutes, or I show “about 12k” from a nightly rollup. Merchants do not make decisions on the difference between 12,481 and 12,490. They do notice when `wp-admin` takes eight seconds.

Same story for `SQL_CALC_FOUND_ROWS` / `'posts_per_page' => 20` with WordPress computing found posts on a meta-joined query. If you don’t paginate honestly, don’t ask MySQL to count the universe.

## Indexes that lie

“We added an index” is the most expensive sentence in a plugin changelog if the index does not match the `WHERE` + `ORDER BY`.

Lies I keep seeing:

- Index on `(meta_key)` for a query that filters `meta_key` **and** `meta_value` **and** then sorts by `post_date`.
- Index on `(status)` when 95% of rows are `publish` or `completed` — the optimizer may ignore it because it does not reduce work.
- Index on a column you wrap in a function: `WHERE DATE(created_at) = '2026-08-24'` cannot use a normal btree the way you think. Filter on a range instead: `created_at >= ... AND created_at < ...`.
- A prefix index that is too short for SKUs / emails, so you still scan.

An index is a different query plan, not a blessing. I want `EXPLAIN` on a **copy of production-shaped data**, not on lorem posts. If you cannot get a dump, synthesize: 50k products, 200k meta rows, 20k orders. Cheap compared to a support week.

## Serialized PHP in a `LONGTEXT` is not searchable

Storing `maybe_serialize( $array )` in post meta or options is normal WordPress. Searching inside it with `LIKE '%\"currency\";s:3:\"EUR\"%'` is not.

It cannot use an index. It breaks when the serialize shape changes. It fights charset/collation in ways that waste afternoons.

If you need to filter on a field, **promote it to a column** (or a row in a table you own). Leave the blob for the blob. SureCart-style product work taught me this the long way: money, status, external ids, and schedule belong in queryable columns. The rest can sit in JSON if you must — but then you query JSON with MySQL JSON functions *or you don’t query it*.

Don’t mix “document” and “index” in the same cell and hope.

## N+1 is still how plugins die

`foreach ( $order_ids as $id ) { get_post_meta( $id, '_foo', true ); }` is readable. It is also a linear number of round trips.

Object cache hides this in staging (everything’s hot) and betrays you when the cache is cold after a deploy, a flush, or a host that restarted Redis.

Prime in one query. `update_postmeta_cache( $ids )` exists. Custom tables get a `WHERE id IN (...)`. If you are looping because the WooCommerce CRUD looks pretty, measure it. Pretty is not a query budget.

## What I do before a “performance” release

Not a ceremony. A short, mean list:

1. Take the three queries on the checkout / webhook / product-list path and run `EXPLAIN` on a fat database.
2. Confirm nothing on those paths is a `meta_query` I would not defend in a postmortem.
3. Check autoloaded options size (`autoload = 'yes'`) after a real merchant config, not defaults.
4. Hit admin screens twice: cold cache and warm cache. If cold is catastrophic, you don’t have a cache strategy. You have a lucky staging server.
5. Log query count on a single product add-to-cart. If the number surprises you, it will surprise merchants.

If step 1 is “we don’t have a fat database,” that *is* the finding. Build one before you call the release ready.

## Redis is not an apology for the schema

People reach for object cache to paper over a bad query. Redis is excellent at “this exact key, this exact invalidation.” It is terrible at “we scan meta because we never modeled the lookup.”

When the cache stampede hits — 40 PHP workers miss at once, all rebuild the same expensive count — you didn’t scale. You moved the outage to Redis and the database together.

Cache *results you can name*. Fix *lookups you can index*. Different jobs.

## Closing

WordPress gives you post meta, options, and `WP_Query` so you can ship a v1. That is a gift. It is not a data architecture for a plugin that lives on shops with years of orders.

If a lookup is part of your product — transaction ids, subscription status, cart tokens, license keys — give it a table or a column you control. Leave `wp_postmeta` for things you load by id, not things you search.

The query that looks fine on your laptop is not a query. It’s a hypothesis. Prove it on ugly data before 100K shops do it for you.
