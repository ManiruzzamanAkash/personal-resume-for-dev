---
title: "MySQL indexes, EXPLAIN, and transactions I trust before blaming PHP"
slug: mysql-indexes-explain-transactions-i-trust-before-blaming-php
date: 2026-09-28
category: Engineering
excerpt: "When a Laravel or PHP app feels slow, I stop staring at controllers and open EXPLAIN. Here are the index shapes, transaction habits, and migration rules I trust before I blame the framework."
readTime: 14 min
tags: [mysql, indexes, explain, transactions, sql, laravel, php, performance, migrations, innodb]
---

# MySQL indexes, EXPLAIN, and transactions I trust before blaming PHP

I have spent too many on-call evenings watching people rewrite a controller while MySQL quietly scanned a million rows. The PHP looked innocent. The ORM looked tidy. The dashboard said “average query time 12ms” because the average was dominated by tiny lookups — and one report endpoint was doing a full table dance every time someone opened it.

This is not another Eloquent tips post. I already wrote about query shapes on the ORM side. This is the **engine** side: how I read `EXPLAIN`, how I design indexes that match real predicates, how I bound transactions so locks do not cascade into timeouts, and how I ship schema changes without taking the store offline. If you ship Laravel, Symfony, or plain PDO against InnoDB, this is the checklist I want in your head before you blame PHP-FPM.

## What I refuse to guess about

Before I touch application code for a “slow page,” I want four facts from the database:

1. **Which statement is hot?** Not which controller — which SQL text, with approximate frequency and latency.
2. **What does `EXPLAIN` (or `EXPLAIN ANALYZE` on MySQL 8.0.18+) say?** Access type, key used, estimated rows, and `Extra`.
3. **Is the predicate selective with a useful index, or are we filtering after a scan?**
4. **Are we holding locks longer than the business rule needs?** Long transactions turn “occasional conflict” into “queue of waiting workers.”

If those answers are missing, optimizing PHP is theater. You might shave a few milliseconds off serialization while InnoDB still reads the wrong pages.

## Start with the schema the query actually sees

I keep a mental model of every hot table: primary key, unique constraints, and the two or three secondary indexes that earn their keep. Everything else is suspicion until proven.

A typical SaaS-shaped table in apps I ship looks like this:

```sql
CREATE TABLE orders (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id     BIGINT UNSIGNED NOT NULL,
  customer_id   BIGINT UNSIGNED NOT NULL,
  status        VARCHAR(32)     NOT NULL,
  total_cents   INT UNSIGNED    NOT NULL,
  placed_at     DATETIME(3)     NOT NULL,
  updated_at    DATETIME(3)     NOT NULL,
  PRIMARY KEY (id),
  KEY idx_orders_tenant_placed (tenant_id, placed_at),
  KEY idx_orders_tenant_status_placed (tenant_id, status, placed_at),
  KEY idx_orders_customer_placed (customer_id, placed_at)
) ENGINE=InnoDB;
```

Notice what is **not** there: a lonely index on `status`, or an index on `updated_at` “just in case.” Status alone is usually low-cardinality. A global `updated_at` index helps almost no tenant-scoped list. Every secondary index is a write tax and a buffer pool consumer. I add indexes for **queries I can name**, not for columns that feel important in a UI mock.

## Read EXPLAIN like a code review, not a ritual

I run the real statement with production-shaped data (or a sanitized dump), not a 200-row fixture:

```sql
EXPLAIN FORMAT=TREE
SELECT id, status, total_cents, placed_at
FROM orders
WHERE tenant_id = 42
  AND status = 'paid'
  AND placed_at >= '2026-09-01'
ORDER BY placed_at DESC
LIMIT 50;
```

On MySQL 8 I prefer `FORMAT=TREE` when available, and I still glance at the classic tabular `EXPLAIN` because muscle memory is useful in a war room. The fields I care about most:

- **`type` / access path** — `const` and `ref` are friends. `range` can be fine. `index` (full index scan) and `ALL` (table scan) need a story. “The table is small” is only a story if it stays small.
- **`key`** — which index MySQL picked. If this is `NULL` on a hot path, that is the bug until proven otherwise.
- **`rows` (estimate)** — not gospel, but if it says 800,000 and you expected 40, you have a selectivity or statistics problem.
- **`Extra`** — `Using filesort` and `Using temporary` are not always evil, but on a paginated admin list they are a smell. `Using index` means a covering index; celebrate carefully and measure writes.

I do not “optimize until `type=const`.” I optimize until the access path matches the product promise: this list should touch a narrow slice of one tenant’s recent rows.

### A bad plan that looks almost right

```sql
-- Index: (status, placed_at)  — missing tenant_id as leading column
SELECT ...
FROM orders
WHERE tenant_id = 42
  AND status = 'paid'
  AND placed_at >= '2026-09-01'
ORDER BY placed_at DESC
LIMIT 50;
```

MySQL may use `(status, placed_at)`, find every paid order since September across **all tenants**, then filter `tenant_id`. On a multi-tenant database that is how “works in staging” becomes “RDS CPU at 95%.” Leading with `tenant_id` (or whatever your tenancy key is) is not a style preference. It is how you keep one noisy customer from scanning everyone else’s history.

## Composite indexes follow the leftmost prefix — design for it

People memorize “leftmost prefix” and still build indexes backwards. My rule:

1. Equality filters that appear in almost every query first (`tenant_id`).
2. Then additional equalities (`status`).
3. Then the range or sort column (`placed_at`).

So `(tenant_id, status, placed_at)` serves:

- `WHERE tenant_id = ?`
- `WHERE tenant_id = ? AND status = ?`
- `WHERE tenant_id = ? AND status = ? AND placed_at >= ? ORDER BY placed_at`

It does **not** magically serve `WHERE status = ?` alone. If you need that, you need a different index — or, more often, you need to stop running global status scans in the app.

I also avoid the classic trap of indexing columns in the order they appear in the `CREATE TABLE` statement. Column order in the table is irrelevant. Predicate and sort order in the **query** are what matter.

## Covering indexes when the list is truly hot

When a list endpoint is in the top five by traffic, I look at whether InnoDB can satisfy it from the index alone:

```sql
-- Narrow projection + matching index → Using index (covering)
SELECT id, status, total_cents, placed_at
FROM orders
WHERE tenant_id = 42
  AND status = 'paid'
ORDER BY placed_at DESC
LIMIT 50;

-- Supporting covering-ish index (include selected non-key columns as trailing keys)
-- KEY idx_orders_tenant_status_placed_cover
--   (tenant_id, status, placed_at, total_cents, id)
```

In InnoDB, secondary indexes already carry the primary key, so `id` is often available without a table lookup. Pulling `total_cents` into the index can eliminate the row fetch on a hot path. I do this **after** EXPLAIN shows table access dominating, not as a default. Fat covering indexes slow writes and bloat disk; they are a scalpel, not a vitamin.

## N+1 is a SQL shape, not only an ORM bug

Eloquent gets blamed for N+1, and often deserves it. But the same pattern appears in hand-written PDO loops and “clever” repository methods:

```sql
-- 1 query
SELECT id, customer_id FROM orders WHERE tenant_id = 42 ORDER BY placed_at DESC LIMIT 50;

-- then 50 queries
SELECT email FROM customers WHERE id = ?;
```

From MySQL’s point of view that is fifty point lookups. Each may be indexed and “fast,” and the page still dies under concurrency because you multiplied round-trips and lock/latch chatter. The fix on the SQL side is the same honesty the ORM needs: **one statement that joins or uses `WHERE id IN (...)`**, with an index that supports the parent filter and the child primary/unique key.

What I watch in `performance_schema` or slow query logs is not only the slowest single statement. I watch **statement frequency × latency**. A 2ms query at 20,000 calls/minute is a production incident wearing a polite costume.

## Transactions: short, boring, and intentional

InnoDB’s default isolation in MySQL is **REPEATABLE READ**. That surprises people who learned databases on READ COMMITTED systems. Under REPEATABLE READ you get consistent reads within a transaction via MVCC, and you can still hit gap locks that block inserts around ranges you scanned. I do not recite textbook isolation levels in standups. I enforce habits:

- **Open a transaction only around the write set that must succeed or fail together.** Do not start `BEGIN` at the top of a controller and then call HTTP, render PDF, or push to Redis inside it.
- **Do reads that need to stay consistent with the write inside the same transaction.** Everything else can be outside.
- **Keep the lock duration shorter than a human breath.** If a step needs a third-party API, reserve or mark state first, commit, then call out, then reconcile with an idempotent follow-up.

A shape I trust for “decrement stock then create order”:

```sql
START TRANSACTION;

SELECT id, stock
FROM inventory_items
WHERE id = 1001 AND tenant_id = 42
FOR UPDATE;

-- application checks stock >= qty

UPDATE inventory_items
SET stock = stock - 3, updated_at = NOW(3)
WHERE id = 1001 AND tenant_id = 42 AND stock >= 3;

INSERT INTO orders (tenant_id, customer_id, status, total_cents, placed_at, updated_at)
VALUES (42, 7, 'paid', 4500, NOW(3), NOW(3));

COMMIT;
```

`SELECT ... FOR UPDATE` is not decoration. It serializes contending writers on that row. Without it, two checkouts read `stock = 3`, both pass the check, both write, and you invent inventory. With it, the second transaction waits — which is correct — so the **transaction must stay short** or you turn inventory into a single-threaded queue.

### Deadlocks are usually a locking-order bug

When two flows lock tables or rows in opposite order, InnoDB picks a victim and throws deadlock. My response is not “retry forever in PHP and hope.” I:

1. Make locking order **stable** across code paths (always lock parent before children; always lock lower ids first in multi-row updates).
2. Retry **idempotent** transactions a small number of times with jitter.
3. Log the deadlock graph (`SHOW ENGINE INNODB STATUS` excerpt) so the next fix is about order, not about adding `sleep()`.

Retries without idempotency are how you double-charge. Pair them with a unique business key (`idempotency_key`, payment intent id) so a replay cannot create a second order.

## Migrations I will put on a production calendar

Schema changes fail in boring ways: metadata locks waiting behind a long transaction, online DDL rebuilding more than you expected, or a migration that adds a column with a default rewrite on a huge table in an old MySQL version.

Rules I follow for app-engineer-owned migrations:

1. **Expand/contract.** Add nullable columns or new tables first. Dual-write or backfill. Switch reads. Drop old columns later. Never “rename and hope” on a hot path in one deploy.
2. **Create indexes with awareness of version and tool.** On modern MySQL, many secondary index adds are online, but they still cost I/O and can stall behind metadata locks. I prefer shipping index creation in a maintenance window or with `pt-online-schema-change` / `gh-ost` when the table is large and the team already standardizes on a tool.
3. **Never rebuild a hot table as a side effect of a casual `CHANGE COLUMN`.** Read the plan. If the migration rewrites the table, treat it like a release, not like a drive-by PR.
4. **Backfills are jobs, not migration `up()` loops.** A migration that `UPDATE`s millions of rows inside a deploy will hold you hostage. Chunked artisan/console commands with `WHERE id > ? ORDER BY id LIMIT 1000` and a progress metric are the adult version.
5. **Transaction + DDL surprises.** In MySQL, DDL often commits implicitly. Do not mix “data backfill in a transaction” fantasies with `ALTER TABLE` in the same mental model.

A Laravel migration I am comfortable reviewing looks like “add nullable column” or “add index concurrently-ish,” not “rewrite history of `orders` in `up()`.”

## Replication basics for people who are not DBAs

Most app teams I join eventually run primary + replica. You do not need to design semi-sync topology on day one, but you do need to stop lying to yourself about reads:

- **Replicas lag.** “Read your writes” after an insert on the primary and a select on a replica is a flaky test waiting to happen. Session-sticky primary reads after writes, or causal consistency tricks, beat random load-balancer luck.
- **Reporting belongs on a replica until it does not.** Heavy `GROUP BY` on the primary steals InnoDB capacity from checkout. Point analytics at a replica, and accept that dashboards may be seconds behind.
- **Schema changes still hit the primary first.** Your fancy read pool does not protect you from a blocking DDL.
- **Connections are a resource.** Opening a new MySQL connection per queued job without pooling is how you discover `max_connections` during a sale.

I keep application config explicit: which connection is `mysql` (primary/writes) and which is `mysql::read` (replica). Hidden “sometimes replica” behavior is worse than an honest primary bottleneck.

## A practical debugging loop I reuse

When latency spikes, I do not start with “maybe Redis.” I run a short loop:

1. Capture the top digests from `performance_schema.events_statements_summary_by_digest` or the slow query log.
2. `EXPLAIN` the worst offenders with realistic binds.
3. Check whether an index exists that matches the predicate order — or whether the query asks for something no index can serve (leading wildcard `LIKE`, function on column, mismatched types that prevent index use).
4. Fix the **statement or index** first; only then profile PHP.
5. If the statement is fine but waits are high, look at lock waits and long transactions — not at another microservice rewrite.

Type mismatches deserve a special mention. Comparing a string column to an integer bind (or the reverse) can silently disable index use. So can wrapping a column in `DATE(placed_at)` instead of using a range on `placed_at`. I treat those as bugs equal to missing indexes.

## What I put in code review for SQL-heavy PRs

I ask for evidence, not vibes:

- Paste of `EXPLAIN` (or `EXPLAIN ANALYZE`) for new list/filter endpoints.
- Index proposal that names the queries it serves — and the write paths that pay for it.
- Transaction boundaries called out in the PR description when money, inventory, or uniqueness is involved.
- Migration plan: online vs rewrite, backfill strategy, rollback story.

If the PR says “added index on status” with no query, I push back. If it opens a transaction around an HTTP call to a payment provider, I block merge. Framework elegance does not override lock duration.

## Closing the loop without heroics

MySQL will not save a bad access pattern, and PHP will not save a missing index. The engineers I trust treat the database as part of the product surface: indexes are API design for your data, transactions are product consistency rules, and migrations are deploy risk.

When a page feels slow, I still love a clean service class and a tidy repository. I just refuse to polish them while `EXPLAIN` shows `type=ALL` on a tenant list. Fix the plan. Keep the transaction boring. Ship the schema change like you mean it. Then blame PHP — if anything is left to blame.
