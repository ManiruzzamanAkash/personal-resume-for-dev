---
title: Production debugging for WordPress plugins: what staging never teaches you
slug: production-debugging-wordpress-plugins-staging-lies
date: 2026-09-10
category: Engineering
excerpt: Staging green and production on fire is a pattern, not bad luck. Here is how I actually debug WordPress and WooCommerce plugins when the failure only exists on a real store.
readTime: 14 min
tags: [wordpress, debugging, woocommerce, production, php]
---

# Production debugging for WordPress plugins: what staging never teaches you

Staging green and production on fire is a pattern, not bad luck. I have lost count of how many times a merchant message landed like this: “Your plugin broke checkout,” while my staging site — same PHP version, same plugin zip, same “representative” catalog — sat there smiling with a green checkout flow.

The failure was real. Staging was also real. They just were not the same system.

This is the article I wish I had written earlier in my WordPress and WooCommerce career: how I actually debug plugins when the bug only exists on a live store, what tools help, which ones lie, and how to design plugins so the next incident is shorter than the last one.

## Why staging lies

Staging is not “production with the volume turned down.” It is a different animal wearing the same skin.

### Data volume changes query plans

A catalog with 200 products and a year of orders on a real store with 80,000 SKUs and six years of `shop_order` rows are not two points on a continuum. They produce different MySQL plans, different object-cache hit rates, and different admin-ajax timeouts. The query that costs 3ms locally can become a full scan the moment `wp_postmeta` is large enough for the optimizer to stop trusting your index assumptions.

I wrote about this shape of failure in the MySQL-at-scale piece. Production debugging starts one layer earlier: assuming the plan will differ, and proving it under real cardinality instead of arguing from a laptop dump.

### Plugin combinations you never cloned

Staging often runs “our stack.” Production runs “our stack plus three abandoned page builders, a custom shipping plugin from 2019, a security suite that rewrites REST responses, and a CDN that caches `admin-ajax.php` because someone toggled the wrong rule.”

The interaction is the product. A race between your webhook handler and another plugin’s `woocommerce_order_status_changed` callback will not appear on a clean staging site. It appears when both fire under real traffic and share a lock you did not know existed.

### Object cache, cron, and “it works after I refresh”

Redis object cache is wonderful until a stale key becomes the story. Staging without a persistent object cache will never show you the “save product, frontend still shows old price for ninety seconds” class of bug. Conversely, staging *with* Redis but without the same key prefixes, eviction policy, or multi-site topology will invent bugs that production does not have.

WP-Cron on staging is usually “someone loaded a page.” On production it is a mix of real traffic, a system cron hitting `wp-cron.php`, Action Scheduler runners, and host-level job limits. If your plugin schedules a follow-up that must run within two minutes of payment, staging’s lazy cron will teach you the wrong lesson about reliability.

### Real traffic, CDN, and PHP drift

Production has concurrent checkouts, bot noise, and users who double-click Pay. Staging has you, carefully, once.

CDNs strip cookies, cache HTML you thought was dynamic, and occasionally serve a stale Cart fragment to the wrong person. PHP opcache on the host may still be running yesterday’s plugin file after a deploy that only updated the filesystem. Version drift — PHP 8.1 on staging, 8.2 on production with a slightly different `DateTime` edge case — is less common than it used to be, but it still ends careers’ worth of “but it works here” tickets.

When I debug for agencies and client-rescue work — including the kind of messy live-store triage we do around [SquartUp](https://squartup.com) when a merchant’s stack is on fire — the first question is never “what changed in the plugin?” It is “what is different about the *environment* that staging silently omitted?”

## A systematic triage loop

I do not start by reading the whole plugin. I start by shrinking the problem until it can lie to me less.

### 1. Reproduce safely

Never debug by poking production checkout with real cards if you can avoid it. Prefer:

- A staging clone that includes a **recent** database dump (sanitized), not a year-old seed.
- Feature flags or a capability-gated “debug mode” that only your user can hit.
- A canary path: one product, one gateway, one customer role.

If you cannot reproduce at all, that is data. Note the conditions: time of day, cache warm vs cold, logged-in vs guest, HPOS vs posts table, which payment method.

### 2. Isolate the layer

Ask, in order:

1. Is the request reaching PHP? (access logs, CDN status codes)
2. Is WordPress bootstrapping? (fatal before `plugins_loaded` vs after)
3. Is your plugin loading the code path you think? (temporary structured log with request id)
4. Is the failure in DB, cache, HTTP outbound, or HTML/JS?

Most “plugin bugs” I am asked to own turn out to be layer 1 or 4 dressed up as layer 3.

### 3. Reduce surface

Disable non-essential plugins *on a clone*, not on the live homepage, until the failure flips. Binary search is boring and effective. When the failure disappears after disabling plugin X, do not celebrate — re-enable X and disable *your* hooks with a tiny mu-plugin to confirm causality either way.

```php
<?php
/**
 * Temporary: mute our plugin hooks on a clone to prove causality.
 * Delete after the incident.
 */
add_action( 'plugins_loaded', function () {
    if ( ! defined( 'MY_PLUGIN_MUTE' ) || ! MY_PLUGIN_MUTE ) {
        return;
    }
    remove_all_actions( 'woocommerce_checkout_order_processed' );
    // …list only the hooks under suspicion
}, 999 );
```

### 4. Capture one honest timeline

Write a five-line timeline: request in → hooks fired → external calls → DB writes → response out. Attach timestamps and a correlation id. Without a timeline you will argue with symptoms forever.

## Tools that help vs tools that lie

### Query Monitor — truth with caveats

Query Monitor is still the first tool I enable on a clone. It shows duplicate queries, slow callers, and HTTP API calls. It lies when:

- The bug is cache-dependent and you are logged in as admin (different cache partitions).
- The bug is concurrency-related (QM is a single-request lens).
- Someone disabled it for non-admins and you forgot.

Use it to generate hypotheses, not verdicts.

### APM (New Relic and friends)

APM is excellent for “which transaction is slow in aggregate?” and terrible for “why did this one webhook duplicate an order?” It averages away the rare race. Pair APM with logs that carry an order id and a payment intent id.

### Error logs and `WP_DEBUG_LOG`

`WP_DEBUG_LOG` on production is a double-edged sword. You need fatals. You do not need to log every `E_NOTICE` into a multi-gigabyte file that fills the disk at 2am. Prefer:

- Host error log for fatals and segfaults.
- Your own structured logger for business events.
- Rate limits on noisy paths.

```bash
# Tail only fatals related to your plugin namespace on a typical host layout
tail -f /var/log/php/error.log | grep -E 'Fatal|YourPlugin\\\\'
```

### Action Scheduler

If your plugin (or WooCommerce) queues work, the admin UI for failed/pending actions is often the real debugger. “Checkout succeeded but email never sent” is frequently a failed action with a stack trace, not a mailer mystery. Check concurrency settings and timeouts — a job that works on staging’s empty queue will starve on a store with thousands of pending actions.

### Redis object cache symptoms

Classic tells:

- Fix appears after `wp cache flush`, returns after traffic.
- Different HTML for two anonymous users on the same URL.
- Options that “won’t save” because an alloptions cache is stale.

When you see those, stop reading PHP conditionals and inspect cache keys and groups.

## WooCommerce-specific traps

### HPOS vs posts

High-Performance Order Storage changes where order data lives and which APIs are authoritative. A plugin that still reads order meta only from `wp_postmeta` will look fine on stores that never enabled HPOS and fail mysteriously on those that did. Always test both. When debugging, ask which datastore the store uses before you invent a ghost bug in your gateway code.

### Cart sessions and cookies

Guest carts live in sessions. Sessions live in the database or a custom handler. CDN + missing `Set-Cookie` + page cache = “cart empties when I go to checkout.” Staging without a page cache will never teach you this. Reproduce with a cold anonymous browser and the CDN in front.

### Webhooks and payment races

Payment gateways taught me more about production debugging than any textbook. At Paysera scale — tens of thousands of merchants — you learn that the bank callback, the browser return URL, and the merchant’s custom `thankyou` hook do not arrive in a polite order. Idempotency is not a nice-to-have; it is the difference between one order and three.

A practical pattern:

```php
function handle_payment_callback( array $payload ): void {
    $order_id = absint( $payload['order_id'] ?? 0 );
    $event_id = sanitize_text_field( $payload['event_id'] ?? '' );

    $order = wc_get_order( $order_id );
    if ( ! $order ) {
        return;
    }

    $lock_key = 'pay_cb_' . $order_id . '_' . $event_id;
    if ( get_transient( $lock_key ) ) {
        return; // already processed this event
    }
    set_transient( $lock_key, 1, HOUR_IN_SECONDS );

    if ( $order->is_paid() ) {
        return; // browser return won the race; callback is a no-op
    }

    $order->payment_complete( $payload['transaction_id'] ?? '' );
    $order->add_order_note( 'Payment confirmed via callback; event ' . $event_id );
}
```

Transients are not a distributed lock. On multi-node hosts you want a real lock (Redis `SET NX`, or a DB row with a unique key). The point is the mindset: assume double delivery.

## Write plugins that are easier to debug

Production debugging is cheaper when the plugin was built for it.

### Structured logging with request and order ids

```php
function plugin_log( string $message, array $context = [] ): void {
    if ( ! defined( 'YOUR_PLUGIN_LOG' ) || ! YOUR_PLUGIN_LOG ) {
        return;
    }
    $line = wp_json_encode( array_merge( [
        'ts'      => gmdate( 'c' ),
        'msg'     => $message,
        'req'     => $_SERVER['HTTP_X_REQUEST_ID'] ?? wp_generate_uuid4(),
    ], $context ) );
    error_log( $line );
}
```

Log decisions (“skipped webhook: already paid”), not only exceptions. Future you will thank present you.

### Feature flags and kill switches

Ship a site option or constant that disables the riskiest hook without uninstalling the plugin. When a store is on fire at Black Friday, “turn off the new discount engine” is a better first move than “deploy a hotfix you wrote in a panic.”

### Idempotency and explicit state machines

Prefer explicit order meta like `_payment_sync_state = pending|complete|failed` over inferring state from a pile of notes and emails. Make illegal transitions loud.

### Avoid silent `@` and swallowed exceptions

I still find `try { … } catch ( \Throwable $e ) {}` in payment code. That is how production failures become “nothing happened.” Catch, log with context, rethrow or surface a controlled admin notice.

## Pitfalls checklist

Before you blame the plugin — or ship a “fix” — run this list:

- [ ] Same PHP minor version and opcache reset after deploy?
- [ ] Object cache flushed *and* CDN purged for the failing URL?
- [ ] HPOS enabled? Custom order tables vs posts?
- [ ] Action Scheduler failed/pending counts climbing?
- [ ] Another plugin hooked the same WooCommerce action at priority 10?
- [ ] Webhook delivered twice? Browser return vs IPN order?
- [ ] Page cache serving authenticated or cart HTML?
- [ ] Cron actually running under system cron, not only WP-Cron?
- [ ] Disk full from debug.log?
- [ ] Multisite: correct site/blog id in CLI and cron?

If three boxes are unchecked, you are not debugging the plugin yet. You are debugging the host.

## A short story from the trenches

A merchant once reported that “refunds create duplicate credit notes.” Staging could not reproduce. Production logs showed two HTTP callbacks three hundred milliseconds apart, both passing our “order not yet refunded” check, both writing notes. The fix was not a cleverer refund calculator. It was a unique constraint on `(order_id, gateway_refund_id)` and an early return when the insert collided.

Staging never taught that lesson because staging never received double webhooks. Production always will, eventually.

## Takeaways

1. **Staging is a hypothesis generator, not a proof.** Treat green staging as “this class of bugs is unlikely,” not “ship it.”
2. **Triage by layer.** Network → bootstrap → your code → DB/cache/HTTP. Do not start in the middle.
3. **Prefer tools that preserve rare events.** Logs with ids beat averages when the bug is a race.
4. **WooCommerce will surprise you with datastore, session, and webhook shape.** Test HPOS, guest carts behind a CDN, and double callbacks on purpose.
5. **Design for the 2am you.** Feature flags, structured logs, idempotent handlers, and kill switches are production features, not polish.
6. **Reduce surface on a clone first.** Binary-search plugins and mute hooks before you rewrite business logic.

Production debugging is not a talent for staring at stack traces until they confess. It is a discipline for noticing when your test environment stopped being a model of reality — and for building plugins that still behave when reality refuses to be polite.

If your store only fails when real customers show up, the bug is not mysterious. Staging just never met them.
