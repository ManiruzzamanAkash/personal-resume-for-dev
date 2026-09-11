---
title: Action Scheduler patterns that keep WooCommerce plugins from timing out
slug: action-scheduler-patterns-woocommerce-plugins
date: 2026-09-11
category: Engineering
excerpt: Checkout cannot wait for your bulk sync. Here is how I design Action Scheduler jobs in WordPress and WooCommerce plugins so work finishes without hanging the request that started it.
readTime: 13 min
tags: [wordpress, woocommerce, action-scheduler, php, architecture]
---

# Action Scheduler patterns that keep WooCommerce plugins from timing out

Checkout cannot wait for your bulk sync. Neither can a product save, a webhook handler, or an admin screen that a store owner is staring at while wondering whether your plugin froze their site.

I have shipped WordPress and WooCommerce plugins that touch payments, catalogs, and merchant dashboards used at serious scale. The pattern that keeps coming back is simple to say and easy to get wrong: **do the smallest reliable unit of work in the request, then hand the rest to Action Scheduler with a design that survives retries, partial failure, and host cron quirks.**

This is not a “here is the API” tutorial. It is the judgment I use when a feature wants to run for thirty seconds inside `admin-post.php` and I refuse to let it.

## Why the request is the wrong place

PHP request lifetime is a hard budget. Shared hosts kill long scripts. Object cache and MySQL connections time out. Users double-click. Payment gateways retry webhooks. Merchants refresh the admin page.

If your plugin does any of the following inside the originating request, you are borrowing time you do not own:

- Syncing hundreds of products to an external API
- Rebuilding a report across years of orders
- Regenerating derived data for every variation after a catalog import
- Sending a fan-out of emails or webhooks after a bulk status change
- Migrating meta rows after an upgrade

WooCommerce already solved a large part of this for core and for plugins that opt in: **[Action Scheduler](https://actionscheduler.org/)**. It is a job queue backed by custom tables, with runners that process claims under concurrency limits. When I design a WooCommerce plugin feature that might take more than a second or two, my default question is not “can I optimize the loop?” It is “what is the smallest job I can schedule, and what does a retry look like?”

## The mental model I actually use

I treat Action Scheduler like a distributed system that happens to live in WordPress tables.

### 1. The request commits intent, not completion

The HTTP request (or REST call, or webhook) should:

1. Validate input and auth
2. Persist enough durable state that a job can resume without the request context
3. Schedule one or more actions with clear arguments
4. Return a response that tells the user what is *in progress*, not what is *done*

If the request dies after step 2 but before step 3, you need a recovery path (admin “retry sync” button, or a watchdog cron that finds stuck “pending” records). If it dies after step 3, Action Scheduler owns the rest.

### 2. Jobs are idempotent or they are landmines

Retries happen. Hosts reboot mid-runner. Two runners can race if claim windows go weird. Your job must tolerate:

- Running twice with the same arguments
- Running after a partial previous attempt
- Running when the underlying entity was deleted

I encode this as: **every job has a business key**, and the first thing it does is load state by that key and decide whether work remains.

### 3. Batch size is a product decision, not a constant

`100` items per job feels neat until you meet a store whose `wp_postmeta` makes each item cost 80ms of hydration. Batch size should be derived from measured work units, with a hard wall-clock budget (I usually aim for 10–20 seconds of work per claimed action on typical WooCommerce hosts, less on very constrained shared hosting).

## Pattern: enqueue a chain, not a monster

The anti-pattern is one action that loops until finished:

```php
as_enqueue_async_action( 'my_plugin_sync_all', [ 'shop_id' => $shop_id ] );

// Handler then does:
foreach ( $all_product_ids as $id ) {
    $this->sync_product( $id ); // can be thousands
}
```

That job will timeout, leave no useful checkpoint, and retry from the top — or worse, half-apply side effects and then retry everything.

The pattern I prefer:

```php
as_enqueue_async_action(
    'my_plugin_sync_batch',
    [
        'shop_id' => $shop_id,
        'cursor'  => 0,
        'run_id'  => $run_id,
    ],
    'my-plugin-sync'
);

add_action( 'my_plugin_sync_batch', function ( $shop_id, $cursor, $run_id ) {
    $run = My_Sync_Run::load( $run_id );
    if ( ! $run || $run->is_cancelled() ) {
        return;
    }

    $ids = $run->next_ids( $cursor, 50 );
    if ( empty( $ids ) ) {
        $run->mark_complete();
        return;
    }

    foreach ( $ids as $id ) {
        $run->sync_one( $id ); // idempotent per product
    }

    $next = $cursor + count( $ids );
    $run->save_cursor( $next );

    as_enqueue_async_action(
        'my_plugin_sync_batch',
        [
            'shop_id' => $shop_id,
            'cursor'  => $next,
            'run_id'  => $run_id,
        ],
        'my-plugin-sync'
    );
}, 10, 3 );
```

A few details matter more than the loop:

- **`run_id`** ties the chain to a durable row (`status`, `cursor`, `error_count`, `started_at`). Admin UI can show progress without scraping Action Scheduler logs.
- **Group** (`my-plugin-sync`) lets you cancel a whole family of pending actions when the merchant hits Stop.
- **Cursor** belongs on the run record *and* in the action args so a stale claimed job cannot invent a cursor the run already moved past — your handler should trust the DB run state as source of truth when they disagree.

## Pattern: unique actions for “at most one of these pending”

Action Scheduler supports unique hooks for some enqueue helpers. Even when you use async actions, you often want “only one reconciliation job pending for this shop.”

I implement uniqueness at the domain layer:

1. Before enqueue, query for pending/in-progress actions with the same hook + group + identifying arg (or check your own `runs` table).
2. If one exists, return that run’s status to the UI instead of stacking duplicates.
3. If the previous run is failed and stuck, offer an explicit restart that cancels pending siblings first.

Duplicated sync jobs are how you get rate-limited by payment APIs and how you write conflicting meta updates.

## Pattern: separate “must happen soon” from “can wait”

Not every job deserves the same urgency.

- **Near-real-time:** payment capture follow-up, fraud signal, stock reservation cleanup — use `as_enqueue_async_action` or a short delay (`as_schedule_single_action( time() + 5, ... )`).
- **Bulk / overnight:** catalog rebuilds, analytics rollups — schedule with a delay into a quieter window, or throttle concurrency with groups and lower runner pressure.
- **Recurring health checks:** `as_schedule_recurring_action` for “find orphaned runs older than N minutes and re-queue or alert.”

I also respect Action Scheduler’s concurrency. Flooding the queue with 5,000 tiny actions at once can starve WooCommerce core jobs (emails, webhooks). Prefer chaining batches or scheduling a modest fan-out with jittered start times.

## Pattern: failures need a taxonomy

A failed job is not one thing. I classify failures in the run record:

| Class | Example | Policy |
| --- | --- | --- |
| Transient | HTTP 429 / 503 from remote API | Retry with backoff; do not mark run failed yet |
| Permanent for item | Product ID deleted | Skip item; continue batch; log skip |
| Permanent for run | Invalid credentials | Fail run; cancel pending siblings; surface admin notice |
| Programmer error | Unexpected null | Fail loudly; do not infinite-retry poison messages |

Action Scheduler will retry failed actions based on its own rules, but **your domain policy should decide when to stop**. Blind retries of permanent auth failures burn runner capacity and create support tickets that look like “your plugin keeps hammering our API.”

A practical shape:

```php
try {
    $this->remote->push( $payload );
} catch ( My_RateLimit_Exception $e ) {
    // Re-queue this same batch later; do not advance cursor.
    as_schedule_single_action(
        time() + $e->retry_after_seconds(),
        'my_plugin_sync_batch',
        [ 'shop_id' => $shop_id, 'cursor' => $cursor, 'run_id' => $run_id ],
        'my-plugin-sync'
    );
    return;
} catch ( My_Auth_Exception $e ) {
    $run->mark_failed( 'auth', $e->getMessage() );
    $this->cancel_group( 'my-plugin-sync' );
    return;
}
```

## Pattern: observability without drowning logs

Production debugging taught me that “add more `error_log`” does not scale. For Action Scheduler work I want:

1. **Run-level progress** in a custom table or option namespace you control (`processed`, `total`, `last_error`, `updated_at`).
2. **Correlation IDs** passed through action args and included in any remote API logging.
3. **Admin UI** that shows “Syncing 1,240 / 8,900 — last error: timeout talking to X” without asking the merchant to install a log viewer.
4. **Selective Action Scheduler log retention** — the default logs are useful in staging and can become huge in production. Know what your host’s table growth looks like after a week of heavy jobs.

When a merchant says “it stopped,” I look at the run row first, then Action Scheduler’s claimed/failed actions for that group, then remote API status. The queue is rarely the first place I look for *business* truth.

## Pattern: upgrades and migrations are jobs too

Plugin upgrades that rewrite meta for every product inside `register_activation_hook` or an admin notice callback are a classic timeout source. I treat migrations like syncs:

1. On upgrade, create a migration run with version `from → to`.
2. Schedule the first batch.
3. Gate new code paths with a “migration complete” flag when safe; or make readers tolerate both old and new shapes (dual-read) until the job finishes.
4. Never block `plugins_loaded` on migration completion.

This is especially important on WooCommerce stores with High-Performance Order Storage (HPOS) transitions or custom tables you introduce mid-life. The migration must be restartable.

## Pitfalls I keep seeing in plugin code reviews

### Scheduling from inside a job without a stop condition

A job that always enqueues “one more” without checking cancellation or completion will fill the actions table until the host cries. Always check run status before re-enqueue.

### Storing huge payloads in action arguments

Action args are serialized into the database. Put a `run_id` and a cursor in the args; put the product list, API tokens, and large payloads in your own tables (tokens in a secrets-safe place, never in action args if you can avoid it).

### Ignoring WP-Cron vs system cron

Action Scheduler can run via WP-Cron or via a dedicated loopback / system cron hitting the runner. On low-traffic admin-only sites, async actions may sit until someone loads a page. For payment-adjacent follow-ups I document that merchants need a real cron hitting `wp-cron.php`, and I design timeouts assuming delay.

### Competing with checkout-critical queues

If your bulk import group saturates runners during a flash sale, you can delay order emails and webhooks. Use lower priority where available, smaller batches, and avoid scheduling storms at `woocommerce_thankyou`.

### Treating “async” as “another thread with request globals”

There is no current user, no `$_POST`, and no guarantee the same plugin versions are warm in opcache the way they were during the click. Pass IDs, reload entities inside the job, and re-check capabilities if the job performs privileged work on behalf of a user who triggered it (store the user id on the run and verify they still may act).

## A checklist I use before shipping a job-backed feature

1. What is the durable source of truth for progress?
2. What is the idempotency key per item and per run?
3. What is the batch size budget on a slow host?
4. How does the merchant cancel, pause, and resume?
5. How do transient vs permanent failures differ in code?
6. What admin-visible status exists without reading PHP logs?
7. How many actions can this feature enqueue in a worst-case store (100k products)?
8. Does this compete with WooCommerce core actions under load?
9. What happens if Action Scheduler tables are huge or runners are disabled?
10. Can support reproduce a stuck run from the run id alone?

If I cannot answer those, the feature is not ready — even if the happy path demo looks smooth on a 30-product staging site.

## How this connects to the rest of the stack

Action Scheduler does not replace good query design. A batch that hydrates products with unbounded `WP_Query` meta still melts MySQL; it just melts it in the background where the merchant notices later as “the site is slow every few minutes.” Pair job design with selective queries, object-cache-aware reads, and the same skepticism about `postmeta` I write about elsewhere.

It also does not replace product honesty in the UI. If a sync will take twenty minutes on a large catalog, say so. Show a progress bar backed by the run row. Do not pretend the green toast means “done” when it means “queued.”

## Takeaways

- Move long work out of the request; commit intent and durable run state first.
- Chain small idempotent batches with a cursor and a `run_id`, not one giant loop.
- Deduplicate pending work per business key so retries do not stampede.
- Classify failures; cancel groups on permanent errors; backoff on transient ones.
- Give merchants progress and cancel; give yourself correlation ids and a run table.
- Treat migrations and upgrades as the same class of problem as syncs.
- Respect runner capacity — your jobs share the queue with WooCommerce core.

Background work is where plugin quality shows up after the demo. The stores that trust a plugin are the ones where the queue stays boring: predictable batches, clear status, and no mysterious timeouts at checkout because something tried to finish the internet inside a single PHP request.
