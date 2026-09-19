---
title: "Idempotent WooCommerce payment webhooks: survive retries without double work"
slug: idempotent-woocommerce-payment-webhooks
date: 2026-09-19
category: Engineering
excerpt: "Retries, out-of-order delivery, and gateway double-posts will hit every payment plugin. Here is how I design WooCommerce webhook handlers so the same event never double-charges, double-fulfills, or corrupts order meta."
readTime: 14 min
tags: [woocommerce, wordpress, payments, webhooks, idempotency, php, gateways]
---

# Idempotent WooCommerce payment webhooks: survive retries without double work

Every serious payment gateway retries webhooks. That is not a bug in their infrastructure — it is the contract. Networks drop packets. Your PHP-FPM worker dies mid-request. A plugin throws after you already marked the order paid. The gateway does not know whether you finished; it only knows it did not get a clean `2xx` in time. So it sends the same event again. Sometimes twice. Sometimes hours later. Sometimes *before* an earlier event that your server never acknowledged.

If your handler is not idempotent, retries become double charges in the merchant’s mind, double stock decrements, double confirmation emails, and corrupted order meta that support cannot explain. I have spent years on WooCommerce payment integrations — including gateway work at Paysera and later payment-adjacent work around SureCart / Brainstorm Force products — and the pattern that keeps showing up is the same: **treat every webhook as a possibly-duplicate hint, never as a one-shot command.**

This article is the design I use so retries, out-of-order delivery, and gateway double-posts do not double-work an order.

## What “idempotent” means for a payment webhook

Idempotency here is not a fancy math word. It means:

> Processing event `E` against order `O` once, twice, or ten times leaves `O` in the same final state, with the same side effects applied exactly once.

Side effects include:

- Transitioning order status (`pending` → `processing` / `completed`)
- Recording transaction / charge IDs on the order
- Reducing stock
- Firing “payment complete” emails and subscriptions hooks
- Calling downstream fulfillment APIs
- Writing audit rows your support team will read at 2am

WooCommerce’s default mental model — “run the hook, update the order, save” — is **not** idempotent under concurrent or repeated delivery. You have to add the discipline yourself.

## The failure modes I design against

Before code, I write down the scenarios. If a design does not survive these, it is not done.

1. **Same delivery-id twice** — gateway retries the identical HTTP POST.
2. **Same business event, different delivery-id** — some providers mint a new delivery envelope for the same `event_id` / `payment_id` + status.
3. **Out-of-order events** — `payment.failed` arrives after `payment.succeeded` because the success webhook was delayed; or a refund webhook races a capture webhook.
4. **Partial failure mid-handler** — you updated status, then crashed before saving the “processed” marker; retry must not re-fire emails.
5. **Double-post from the gateway** — rare but real: two nearly identical success payloads for one checkout session.
6. **Merchant-initiated action racing the webhook** — admin marks order paid while the webhook is still in flight.

Every one of these has bitten a store I worked on. Signature checks alone do not fix them. Signatures prove *who* sent the body. Idempotency proves *you already did the work*.

## Layer 1: verify the signature before you touch the order

Never parse business logic from an unverified body. For HMAC-style gateways the shape looks like this:

```php
final class WebhookSignature
{
    public static function assertValid(string $rawBody, string $headerSignature, string $secret): void
    {
        $expected = hash_hmac('sha256', $rawBody, $secret);

        if (! hash_equals($expected, $headerSignature)) {
            throw new InvalidSignature('Webhook signature mismatch.');
        }
    }
}

// In the REST callback:
$raw = file_get_contents('php://input');
WebhookSignature::assertValid(
    $raw,
    sanitize_text_field(wp_unslash($_SERVER['HTTP_X_GATEWAY_SIGNATURE'] ?? '')),
    $this->settings->get_webhook_secret()
);

$payload = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
```

Notes I insist on in review:

- Use the **raw body** for HMAC, not a re-encoded `$_POST` array.
- Prefer `hash_equals` so timing does not leak.
- Fail closed with `401` / `403` and **do not** create orders or log PII from forged bodies.
- Rotate secrets with a dual-read window; never break in-flight retries during rotation.

Signature verification is necessary and insufficient. It is the front door lock. Idempotency is what stops you from vacuuming the house twice when the same guest knocks twice.

## Layer 2: dedupe on a stable business key

I store at least two identifiers on the order (or in a dedicated ledger table):

| Key | Purpose |
| --- | --- |
| `delivery_id` / `webhook_id` | Exact HTTP delivery dedupe |
| `event_id` or `payment_id + event_type + status` | Business-event dedupe when delivery ids change on retry |

```php
final class WebhookDedupe
{
    public function alreadyProcessed(WC_Order $order, string $eventKey): bool
    {
        $processed = $order->get_meta('_payment_webhook_events', true);
        if (! is_array($processed)) {
            $processed = [];
        }

        return in_array($eventKey, $processed, true);
    }

    public function markProcessed(WC_Order $order, string $eventKey): void
    {
        $processed = $order->get_meta('_payment_webhook_events', true);
        if (! is_array($processed)) {
            $processed = [];
        }

        $processed[] = $eventKey;
        // Keep the list bounded — last N events is enough for support forensics.
        $order->update_meta_data('_payment_webhook_events', array_slice($processed, -50));
        $order->update_meta_data('_payment_webhook_last_event', $eventKey);
        $order->update_meta_data('_payment_webhook_last_at', gmdate('c'));
    }
}
```

For high-volume stores I prefer a **custom table** keyed by `(gateway, event_key)` with a unique index, because order meta is a poor lock under concurrency. The idea is identical: insert-or-ignore before side effects; if the insert loses, return `200` and stop.

```sql
CREATE TABLE wp_wc_payment_webhook_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  gateway VARCHAR(64) NOT NULL,
  event_key VARCHAR(191) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  received_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gateway_event (gateway, event_key),
  KEY idx_order (order_id)
);
```

```php
public function claim(string $gateway, string $eventKey, int $orderId): bool
{
    global $wpdb;

    $result = $wpdb->query(
        $wpdb->prepare(
            "INSERT IGNORE INTO {$wpdb->prefix}wc_payment_webhook_ledger
             (gateway, event_key, order_id, received_at)
             VALUES (%s, %s, %d, %s)",
            $gateway,
            $eventKey,
            $orderId,
            gmdate('Y-m-d H:i:s')
        )
    );

    // 1 = we won the claim; 0 = someone else already processed this event.
    return (int) $result === 1;
}
```

Returning `200` on duplicates matters. If you return `500` because “already processed,” some gateways will retry forever.

## Layer 3: a status machine, not free-form `update_status`

Most double-fulfill bugs are illegal transitions: applying `processing` on an order that is already `refunded`, or applying `failed` after `completed`. I map gateway statuses through an explicit allow-list.

```php
final class OrderStatusMachine
{
    /** @var array<string, list<string>> */
    private const ALLOWED = [
        'pending'    => ['processing', 'on-hold', 'failed', 'cancelled'],
        'on-hold'    => ['processing', 'failed', 'cancelled'],
        'processing' => ['completed', 'refunded', 'cancelled'],
        'completed'  => ['refunded'],
        'failed'     => ['pending', 'processing'], // rare: customer retries same order
        'cancelled'  => [],
        'refunded'   => [],
    ];

    public function canTransition(string $from, string $to): bool
    {
        $from = $this->normalize($from);
        $to   = $this->normalize($to);

        if ($from === $to) {
            return true; // no-op is always safe
        }

        return in_array($to, self::ALLOWED[$from] ?? [], true);
    }

    public function apply(WC_Order $order, string $to, string $note): bool
    {
        $from = $order->get_status();

        if (! $this->canTransition($from, $to)) {
            $order->add_order_note(
                sprintf(
                    'Ignored illegal webhook transition %s → %s (%s)',
                    $from,
                    $to,
                    $note
                )
            );
            return false;
        }

        if ($from === $to) {
            return true;
        }

        $order->update_status($to, $note, true);
        return true;
    }

    private function normalize(string $status): string
    {
        return str_starts_with($status, 'wc-') ? substr($status, 3) : $status;
    }
}
```

When a late `failed` event arrives after `processing`, I **log and acknowledge** — I do not yank the order back to failed and re-open stock. Reconciliation jobs (or a human) own that conflict. Webhooks stay advisory relative to money-moving truth.

That lesson is straight from gateway work at Paysera: the webhook is a hint; the payment provider’s API is the source of truth when states disagree.

## Layer 4: lock, then decide, then side-effect once

Concurrency is the quiet killer. Two PHP workers can both pass a “not processed yet” meta check before either saves. I take a lock keyed by payment id or order id.

```php
final class PaymentWebhookHandler
{
    public function __construct(
        private WebhookDedupe $dedupe,
        private OrderStatusMachine $machine,
        private GatewayClient $client,
        private WebhookLogger $logger,
    ) {}

    public function handle(array $payload): WP_REST_Response
    {
        $eventKey   = $this->eventKey($payload);
        $paymentId  = (string) $payload['payment_id'];
        $orderId    = (int) $payload['metadata']['order_id'];
        $lockKey    = 'wc_pay_hook_' . md5($paymentId);

        if (! $this->acquireLock($lockKey, 30)) {
            // Soft fail: ask the gateway to retry shortly without duplicating work.
            return new WP_REST_Response(['ok' => false, 'reason' => 'locked'], 409);
        }

        try {
            $order = wc_get_order($orderId);
            if (! $order instanceof WC_Order) {
                $this->logger->warning('order_missing', compact('orderId', 'eventKey'));
                return new WP_REST_Response(['ok' => false], 404);
            }

            if ($this->dedupe->alreadyProcessed($order, $eventKey)) {
                $this->logger->info('duplicate_ignored', compact('orderId', 'eventKey'));
                return new WP_REST_Response(['ok' => true, 'duplicate' => true], 200);
            }

            // Re-fetch authoritative payment state — do not trust the webhook alone.
            $fresh = $this->client->getPayment($paymentId);

            $target = $this->mapStatus($fresh->status);
            $applied = $this->machine->apply(
                $order,
                $target,
                sprintf('Webhook %s / payment %s', $eventKey, $paymentId)
            );

            if ($applied && $target === 'processing') {
                $this->fulfillOnce($order, $fresh);
            }

            $order->update_meta_data('_transaction_id', $fresh->transaction_id);
            $this->dedupe->markProcessed($order, $eventKey);
            $order->save();

            $this->logger->info('processed', [
                'orderId'  => $orderId,
                'eventKey' => $eventKey,
                'status'   => $target,
            ]);

            return new WP_REST_Response(['ok' => true], 200);
        } finally {
            $this->releaseLock($lockKey);
        }
    }

    private function fulfillOnce(WC_Order $order, object $fresh): void
    {
        if ($order->get_meta('_payment_fulfillment_done') === 'yes') {
            return;
        }

        // Stock, emails, subscription activation — all gated by this flag.
        $order->payment_complete($fresh->transaction_id);
        $order->update_meta_data('_payment_fulfillment_done', 'yes');
    }

    private function eventKey(array $payload): string
    {
        return implode(':', [
            (string) ($payload['event_id'] ?? $payload['id']),
            (string) $payload['type'],
            (string) $payload['payment_id'],
        ]);
    }

    private function acquireLock(string $key, int $ttl): bool
    {
        // Object cache add is atomic when a persistent cache is present.
        if (wp_using_ext_object_cache()) {
            return (bool) wp_cache_add($key, 1, 'payment_webhooks', $ttl);
        }

        // Fallback: options table as a mutex (good enough for many shared hosts).
        if (get_transient($key)) {
            return false;
        }
        set_transient($key, 1, $ttl);
        return true;
    }

    private function releaseLock(string $key): void
    {
        if (wp_using_ext_object_cache()) {
            wp_cache_delete($key, 'payment_webhooks');
            return;
        }
        delete_transient($key);
    }
}
```

A few judgment calls baked into that handler:

- **`payment_complete()` only once.** WooCommerce’s helper fires emails and stock reductions. Wrapping it with `_payment_fulfillment_done` is how I stop duplicate receipts when a crash happens after status change but before the dedupe marker is saved.
- **Re-fetch from the gateway API.** At Paysera we learned the hard way that a webhook payload can be stale relative to a later capture or refund. The webhook wakes you up; the API tells you the truth.
- **`409` on lock contention** is intentional for gateways that retry on non-2xx. If your provider treats any non-2xx as poison, return `200` with a “deferred” body and schedule Action Scheduler to finish — same idea as keeping long work off the request thread.

## Layer 5: partial failure and replay

Handlers fail in the middle. Plan for it.

### Write the claim early, or write compensation

Two schools:

1. **Claim-first** — insert the ledger row *before* side effects. If you crash after claim but before fulfill, a reconciliation job must notice “claimed but not fulfilled” and finish the work.
2. **Fulfill-first with compensating dedupe** — do the work, then mark processed. Retries may re-enter briefly; every side effect must be individually idempotent (`payment_complete` guard, unique external fulfillment ids, etc.).

I prefer claim-first plus a small repair job for money paths, because silent double-fulfillment is worse than a delayed single fulfillment.

```php
// Action Scheduler repair: find claims older than N minutes without fulfillment flag.
public function repairStuckClaims(): void
{
    $stuck = $this->ledger->findUnfulfilledClaims(olderThanMinutes: 5);

    foreach ($stuck as $row) {
        $order = wc_get_order((int) $row->order_id);
        if (! $order) {
            continue;
        }

        $fresh = $this->client->getPayment($row->payment_id);
        $this->machine->apply($order, $this->mapStatus($fresh->status), 'Repair job');
        $this->fulfillOnce($order, $fresh);
        $order->save();
    }
}
```

### Make outbound calls idempotent too

If you notify a warehouse or subscription service, send an **Idempotency-Key** header derived from `event_key`. Your own retries then become safe even when the remote succeeded and your HTTP client timed out.

## Layer 6: logging you can defend in a chargeback

When a merchant asks “why was this charged twice?” you need a timeline, not a vibe.

I log structured events (to `wc_get_logger()` or a dedicated table):

- `signature_ok` / `signature_fail`
- `duplicate_ignored` with `event_key`
- `lock_busy`
- `transition_applied` with from/to
- `transition_ignored` with reason
- `fulfillment_skipped` / `fulfillment_done`
- `api_refetch_status` with provider status

```php
final class WebhookLogger
{
    public function info(string $code, array $context = []): void
    {
        wc_get_logger()->info(
            $code . ' ' . wp_json_encode($context),
            ['source' => 'payment-webhooks']
        );
    }

    public function warning(string $code, array $context = []): void
    {
        wc_get_logger()->warning(
            $code . ' ' . wp_json_encode($context),
            ['source' => 'payment-webhooks']
        );
    }
}
```

Also write a short **order note** for merchant-visible transitions, and keep the verbose JSON in the log for engineers. Do not put full card payloads or secrets in either place.

## Putting the REST route together

```php
add_action('rest_api_init', function () {
    register_rest_route('my-gateway/v1', '/webhook', [
        'methods'             => 'POST',
        'permission_callback' => '__return_true', // auth is the signature
        'callback'            => [my_gateway()->webhook_handler(), 'handleRequest'],
    ]);
});
```

Inside `handleRequest`: read raw body → verify signature → decode → run `PaymentWebhookHandler::handle`. Keep the permission callback open only if signature verification is mandatory and tested; otherwise you have invented a public order-mutation endpoint.

## A practical checklist before you ship

- [ ] Signature verified on raw body; failures return 4xx without side effects
- [ ] Stable `event_key` deduped via unique ledger or bounded order meta
- [ ] Lock around read-decide-write for the same `payment_id`
- [ ] Status transitions allow-listed; illegal ones acknowledged, not applied
- [ ] `payment_complete` / stock / email gated by a fulfillment flag
- [ ] Provider API re-fetch when the money state matters
- [ ] Duplicates return `200` so gateways stop retrying
- [ ] Repair job for claim-without-fulfillment
- [ ] Structured logs + order notes for support
- [ ] Integration test: deliver the same signed payload twice; assert one email, one stock move, one status change

## What I refuse to do anymore

I refuse to “just call `$order->payment_complete()` in the webhook and move on.” That line is fine as a **side effect inside** an idempotent shell. Alone, it is how stores earn refund tickets.

I also refuse to treat webhook ordering as FIFO. Networks do not owe you FIFO. Your status machine owes the store safety under chaos.

Payment plugins are judged by the incidents that never happen. Idempotent webhooks are how you buy that quiet. If you are extending WooCommerce for a gateway — whether you are wiring a classic redirect flow like the Paysera-era plugins I maintained, or a modern merchant stack adjacent to SureCart-style checkout — make retries boring. Boring is the goal.

