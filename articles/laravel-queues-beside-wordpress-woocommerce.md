---
title: "Laravel queues beside WordPress: keep WooCommerce plugins out of long jobs"
slug: laravel-queues-beside-wordpress-woocommerce
date: 2026-09-15
category: Engineering
excerpt: "When a WooCommerce plugin should not own webhooks, reconciliation, or report exports, I put that work on a Laravel queue service and keep WordPress thin — REST callbacks and Action Scheduler only as a bridge."
readTime: 11 min
tags: [laravel, queues, wordpress, woocommerce, php, architecture, jobs]
---

# Laravel queues beside WordPress: keep WooCommerce plugins out of long jobs

I have watched too many WooCommerce plugins try to be the entire backend.

Checkout fires. The plugin reaches for a remote payment API, writes five rows of meta, kicks off a CSV export, and “just one more” webhook fan-out — all inside the same PHP request that was supposed to return a thank-you page. On a quiet staging site it looks fine. On a shop with concurrent checkouts, a slow PSP, and a hosting PHP timeout of thirty seconds, it becomes a support queue that never empties.

The fix is not “add more Action Scheduler.” Action Scheduler is excellent for work that still belongs *inside* WordPress. It is a poor substitute for a product backend that needs retries with backoff, dedicated workers, failed-job dashboards, and idempotent consumers that outlive a single store’s PHP process.

When I design systems where WordPress/WooCommerce is the storefront and a Laravel API owns async work, the rule is simple: **the plugin stays thin**. It authenticates, records intent, and hands off. Laravel owns the queue.

## When WordPress should not run the job

I pull work out of the request (and often out of WP entirely) when any of these are true:

1. **External I/O can take seconds** — payment status sync, bank reconciliation, ERP pushes, multi-leg webhooks.
2. **The work must survive PHP death** — report exports for ten thousand orders, nightly inventory reconciliation, backfills after a gateway outage.
3. **Idempotency and retry policy matter more than “try again on cron”** — duplicate charges and double-shipped labels are business failures, not log noise.
4. **Multiple stores or services share the same backend** — one Laravel service serving several WooCommerce installs, or a store plus a mobile app that must see the same job state.
5. **You need observability** — Horizon, failed job tables, structured metrics — that WP-Cron will never give you honestly.

WordPress still owns the merchant UI, HPOS orders, and the checkout UX. Laravel owns the long road after “order placed.”

I have lived this split on payment and product backends beside WooCommerce shops — including gateway work where the store plugin must never block checkout on a remote status poll. The pattern transfers: thin plugin, fat queue.

## The bridge: REST + a short Action Scheduler hop

I do not make the WooCommerce plugin call `Redis::lpush` directly. The plugin speaks HTTP to Laravel (or drops a signed event), and optionally uses Action Scheduler only as a *local* buffer when the HTTP call itself must not run in checkout.

Typical flow:

1. Checkout or admin action creates a durable **intent** in WP (order meta, custom table, or a small outbox row).
2. Plugin schedules a tiny Action Scheduler job: `dispatch_to_laravel( $intent_id )`.
3. That job POSTs a signed payload to Laravel: `POST /api/v1/jobs/payment-status-sync` with `{ order_id, store_id, correlation_id }`.
4. Laravel validates the signature, enqueues a job, returns `202 Accepted` with a job id.
5. Workers process the job. Laravel later callbacks WP REST (or writes status the plugin polls) when the merchant UI needs an update.

Why the Action Scheduler hop? Because checkout must return. If Laravel is briefly down, AS retries the *dispatch*, not the entire reconciliation pipeline. The heavy work still lives in Laravel.

Thin plugin sketch:

```php
add_action( 'woocommerce_order_status_processing', function ( $order_id ) {
    as_enqueue_async_action(
        'my_plugin_dispatch_status_sync',
        [ 'order_id' => (int) $order_id ],
        'my_plugin'
    );
} );

add_action( 'my_plugin_dispatch_status_sync', function ( $args ) {
    $order_id = (int) $args['order_id'];
    $order    = wc_get_order( $order_id );
    if ( ! $order ) {
        return;
    }

    $payload = [
        'store_id'       => get_option( 'my_plugin_store_id' ),
        'order_id'       => $order_id,
        'correlation_id' => $order->get_meta( '_my_plugin_correlation_id' ) ?: wp_generate_uuid4(),
        'status'         => $order->get_status(),
    ];

    $response = wp_remote_post(
        trailingslashit( MY_PLUGIN_API_URL ) . 'jobs/payment-status-sync',
        [
            'timeout' => 8,
            'headers' => [
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . MY_PLUGIN_API_TOKEN,
                'X-Signature'   => my_plugin_sign( $payload ),
            ],
            'body'    => wp_json_encode( $payload ),
        ]
    );

    if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) >= 500 ) {
        throw new RuntimeException( 'Laravel dispatch failed; Action Scheduler will retry.' );
    }
} );
```

Notice what the plugin does *not* do: poll the PSP, build CSV rows, or fan out partner webhooks. It records intent and throws on transient failure so AS can retry the bridge.

## Laravel side: job shape and queue drivers

On Laravel I keep jobs boring and named after business outcomes:

```php
namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncPaymentStatus implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 8;
    public int $uniqueFor = 300;

    public function __construct(
        public string $storeId,
        public int $orderId,
        public string $correlationId,
    ) {
        $this->onQueue('payments');
    }

    public function uniqueId(): string
    {
        return "{$this->storeId}:{$this->orderId}:payment-status";
    }

    public function backoff(): array
    {
        return [10, 30, 60, 120, 300, 600];
    }

    public function handle(PaymentGateway $gateway, StoreCallback $callback): void
    {
        $result = $gateway->fetchStatus($this->storeId, $this->orderId);

        $callback->postOrderNote(
            $this->storeId,
            $this->orderId,
            $result->toMerchantNote(),
            $this->correlationId
        );
    }
}
```

### Driver tradeoffs I actually use

| Driver | When I pick it | Cost |
| --- | --- | --- |
| **database** | Early products, one server, low volume | Contended `jobs` table; ok until it is not |
| **Redis** | Default for product backends | Needs Redis ops; excellent with Horizon |
| **SQS / cloud queues** | Multi-region or bursty traffic | Harder local DX; watch visibility timeout |
| **sync** | Never in production | Fine for feature tests only |

**Horizon vs database queue:** Horizon is not a vanity dashboard. Once you have multiple queues (`payments`, `exports`, `webhooks`), different retry budgets, and a need to see wait time vs throughput, Redis + Horizon pays for itself. Database queues are honest for MVPs and for shops that refuse another dependency — but failed-job UX and worker autoscaling stay weaker. I start database only when volume is low and the team already knows MySQL cold.

Separate queues by failure domain. A stuck 50MB report export should not starve payment status sync. `payments` gets more workers and shorter timeouts; `exports` gets fewer workers, longer `timeout`, and a memory limit you measure instead of guess.

## Idempotency is the real product requirement

Retries without idempotency are how you charge twice.

I treat every job as possibly running more than once:

- **Stable correlation ids** from WordPress travel with the job and land in Laravel’s outbox / processed-events table.
- **`ShouldBeUnique`** (or a uniqueness lock keyed by store + order + job type) collapses duplicate dispatches from double AS runs or merchant “retry sync” clicks.
- **Gateway calls use idempotency keys** the PSP understands whenever the API supports them.
- **Callbacks to WordPress are upserts**, not blind inserts: order notes and meta updates key off `correlation_id`.

Minimal processed-event guard:

```php
public function handle(ProcessedEventStore $store, PaymentGateway $gateway): void
{
    if ($store->alreadyHandled($this->correlationId, 'payment-status-sync')) {
        return;
    }

    $result = $gateway->fetchStatus($this->storeId, $this->orderId);

    $store->markHandled($this->correlationId, 'payment-status-sync', [
        'order_id' => $this->orderId,
        'status'   => $result->status,
    ]);
}
```

Mark handled in the same DB transaction as the side effect when you can. If the side effect is an external HTTP call, use an outbox: write “pending callback,” commit, send, then mark sent — and have a sweeper for stuck pendings.

## Failed jobs, retries, and what “done” means

Laravel’s `$tries`, `backoff()`, and `failed()` method are part of the product contract, not framework trivia.

What I configure deliberately:

- **Retry for transient errors only** — HTTP 429/502, connection resets, lock wait timeouts.
- **Fail fast for poison messages** — invalid signature, unknown store, permanently deleted order. Put them on the failed table with a reason code the support team can read.
- **Alert on failed queue depth**, not only on exception volume. A quiet failed-job pile is worse than a loud spike.
- **Requeue is a privileged action.** Blind “retry all” after a bugfix can stampede a PSP. Prefer filtered retries by job class and time window.

```php
public function failed(\Throwable $e): void
{
    Log::error('payment_status_sync.failed', [
        'store_id'       => $this->storeId,
        'order_id'       => $this->orderId,
        'correlation_id' => $this->correlationId,
        'error'          => $e->getMessage(),
    ]);

    app(StoreCallback::class)->flagNeedsManualReview(
        $this->storeId,
        $this->orderId,
        $this->correlationId
    );
}
```

WordPress learns about permanent failure through a callback or a status the plugin already knows how to render. The merchant should see “sync needs attention,” not a white screen from a plugin that tried to be a worker.

## Keeping WordPress thin on purpose

The temptation is to grow the plugin until Laravel is “just a helper.” Resist that. Boundaries I enforce:

- **No long loops in WP.** Chunking a 20k order export belongs in Laravel (or, if it must stay WP-only, in carefully designed AS batches — but that is a different article).
- **Secrets for PSPs and ERPs live with the queue service** when that service owns the integration. The plugin holds a store-scoped API token to *your* backend, not a bouquet of third-party keys if you can avoid it.
- **Merchant-facing state is mirrored**, not computed twice. Laravel is source of truth for job lifecycle; WP stores the last known status for UI.
- **Action Scheduler is a bridge and a local retry**, not a second product queue. If you need Horizon-like visibility, you already outgrew WP-Cron aesthetics.

This is the same instinct as keeping checkout free of bulk work: respect the process model you are in. WordPress request workers are scarce and shared. Laravel queue workers are dedicated and scalable.

## A concrete map: four workloads

How I usually split ownership:

| Workload | WordPress | Laravel |
| --- | --- | --- |
| Payment status sync after redirect/webhook | Verify order, stash correlation id, dispatch | Poll/reconcile PSP, callback WP |
| Partner webhook fan-out | Emit domain event once | Fan-out with per-partner retries |
| Report / CSV export | Button + “queued” notice | Generate file, store, notify |
| Nightly reconciliation | Optional AS tick to “start run” | Diff, repair, summary email |

If a feature cannot be described in that table without putting heavy I/O under “WordPress,” the design is not done.

## What I measure after it ships

Architecture without metrics is hope. On the Laravel side I watch:

- Queue wait time per queue name
- Job success rate and retry histogram
- Failed job age (hours sitting unacked)
- Callback latency back to WordPress
- Duplicate suppression hits (`ShouldBeUnique` / processed-event short-circuits)

On the WordPress side I watch:

- Action Scheduler pending depth for the dispatch hook only
- HTTP error rate to Laravel
- Orders stuck in “syncing” longer than SLO

When wait time climbs, I scale workers or split queues. When duplicates climb, I fix the bridge (double AS enqueue, missing correlation id). When WP pending depth climbs, Laravel is down or auth is broken — fix the bridge before touching job business logic.

## Closing

WooCommerce plugins are extraordinary at commerce UX and store data. They are mediocre general-purpose job runners for product backends that must be durable, observable, and shared.

Put long work on Laravel queues. Keep the plugin as a signed, boring bridge: record intent, hand off, show status. Choose Redis + Horizon when you have multiple queues and real traffic; use the database driver only while volume is small and you accept its limits. Obsess over idempotency and failed-job handling — that is where money and trust leak.

The shops that stay calm during PSP blips are rarely the ones with the cleverest checkout hook. They are the ones that refused to run the long job in the request that sold the product.
