---
title: "Laravel Horizon production patterns I trust before queues go quiet"
slug: laravel-horizon-production-patterns-i-trust
date: 2026-09-26
category: Engineering
excerpt: "Horizon is not a pretty dashboard — it is how I keep Laravel queues honest under real load. Here is the supervisor math, timeout discipline, failed-job hygiene, and metrics I ship before I call a queue stack production-ready."
readTime: 14 min
tags: [laravel, horizon, queues, redis, jobs, php, devops, production]
---

# Laravel Horizon production patterns I trust before queues go quiet

I have inherited too many Laravel apps where `php artisan queue:work` is “running somewhere” on a VPS, supervised by a half-forgotten systemd unit, and the only signal of health is that nobody has complained yet. That is not a queue strategy. That is hope with a Redis connection.

Horizon is the control plane I want when jobs matter: supervisors with explicit capacity, balanced queues, metrics I can graph, and a failed-job path that does not become a junk drawer. This is not a install-Horizon-and-screenshot-the-dashboard tour. It is the production shape I insist on before I trust async work in a shipping Laravel service — the same discipline I apply when a product like LaraDashboard or a client SaaS starts sending mail, webhooks, exports, and image work off the request path.

## What Horizon is actually for

Horizon sits on Redis and turns “we have workers” into **named capacity with metrics**. The dashboard is useful. The configuration is the product.

Before I enable Horizon on an app, I want three truths written down:

1. **Which jobs are latency-sensitive** (password resets, webhook acknowledgements) vs **throughput-oriented** (CSV exports, thumbnail generation).
2. **What happens when a job fails** — retry budget, backoff, and who gets paged when the failed table grows.
3. **How many workers the box can honestly run** without starving PHP-FPM or MySQL connections.

If those answers are vague, Horizon will just make the vagueness visible. That is still progress — but I would rather decide the numbers on purpose.

## Separate queues by failure mode, not by feature name

A common mistake is one `default` queue for everything, or a queue per feature (`orders`, `users`, `reports`) with no capacity plan. I split by **how the work should compete for workers**:

| Queue | Typical jobs | Worker posture |
| --- | --- | --- |
| `high` | auth mail, payment confirmations, inbound webhook fan-out | small jobs, short timeout, always have spare workers |
| `default` | normal domain side effects | balanced, moderate timeout |
| `low` | exports, rebuilds, bulk notifications | longer timeout, fewer workers, never starve `high` |

```php
// Prefer explicit queue names at dispatch time.
SendOrderPaidMail::dispatch($order)->onQueue('high');

RebuildCatalogExport::dispatch($catalog)->onQueue('low');
```

Feature-named queues only help if each one also has a supervisor and a failure story. Otherwise you have renamed chaos.

## Supervisor math I actually write down

Horizon’s `config/horizon.php` is where capacity becomes code. I do not copy the defaults and hope. For a small VPS or a single app Redis, a starting shape looks like this:

```php
'defaults' => [
    'supervisor-1' => [
        'connection' => 'redis',
        'queue' => ['high', 'default', 'low'],
        'balance' => 'auto',
        'autoScalingStrategy' => 'time',
        'maxProcesses' => 10,
        'maxTime' => 0,
        'maxJobs' => 0,
        'memory' => 128,
        'tries' => 3,
        'timeout' => 60,
        'nice' => 0,
    ],
],

'environments' => [
    'production' => [
        'supervisor-1' => [
            'maxProcesses' => 10,
            'balanceMaxShift' => 1,
            'balanceCooldown' => 3,
        ],
    ],
],
```

A few opinions I will defend in review:

- **`balance => auto` with a real `maxProcesses`** beats fixed process counts once traffic is uneven. Auto-balancing without a ceiling is how you fork-bomb a 2GB box.
- **`timeout` must be lower than Redis `retry_after`** on the queue connection. If the worker timeout is 90s and Redis reclaims the job at 60s, you get duplicate processing under load. I set `retry_after` intentionally higher than the longest honest job timeout on that connection.
- **`memory` is a soft kill, not a wish.** A 128MB limit that every export exceeds just churns workers. Put heavy jobs on a supervisor with a higher memory budget *and* a longer timeout, or move them to a dedicated queue with fewer processes.

When the app grows, I split supervisors instead of inflating one:

```php
'production' => [
    'supervisor-webhooks' => [
        'connection' => 'redis',
        'queue' => ['high'],
        'balance' => 'simple',
        'processes' => 4,
        'tries' => 5,
        'timeout' => 30,
        'memory' => 128,
    ],
    'supervisor-bulk' => [
        'connection' => 'redis',
        'queue' => ['low'],
        'balance' => 'simple',
        'processes' => 2,
        'tries' => 2,
        'timeout' => 300,
        'memory' => 512,
    ],
],
```

Webhook workers stay short and numerous. Bulk workers stay fat and few. Mixing them in one supervisor is how a 5-minute export steals the slots your password-reset mails needed.

## Job class rules that keep Horizon honest

Horizon cannot save a job that holds a database transaction open, downloads a 200MB file in `handle()`, or silently swallows exceptions. The patterns I enforce in the job class:

```php
namespace App\Jobs;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendOrderPaidMail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [10, 60, 180];

    public int $timeout = 30;

    public function __construct(public Order $order) {}

    public function handle(): void
    {
        // Load what you need; do not assume the model graph survived serialization.
        $order = $this->order->fresh(['customer', 'items']);

        if ($order === null || $order->status !== 'paid') {
            return; // idempotent no-op beats a noisy failure
        }

        // Side effects go here — mail, HTTP, whatever — outside DB transactions.
        app(OrderMailer::class)->sendPaid($order);
    }

    public function failed(\Throwable $e): void
    {
        report($e);
        // Optional: notify ops channel, mark order meta, open a ticket.
    }
}
```

Hard rules I treat as non-negotiable:

1. **Serialize IDs, reload in `handle()`.** `SerializesModels` is convenient until a deleted row or a stale relation surprises you. Prefer constructor IDs for critical paths when the model graph is large.
2. **Declare `$tries`, `$backoff`, and `$timeout` on the job** when they differ from supervisor defaults. Future readers should not need Horizon config to know the retry story.
3. **Idempotency is part of the job.** Retries will happen. Horizon’s “Tries” column is not a design substitute.
4. **Never wrap external HTTP or SMTP inside a long DB transaction** that started in a listener. Commit first, then dispatch — or dispatch afterResponse / afterCommit deliberately.

Laravel’s `Bus::dispatch()->afterCommit()` exists for a reason:

```php
DB::transaction(function () use ($order) {
    $order->markPaid();
    SendOrderPaidMail::dispatch($order)->afterCommit();
});
```

Without `afterCommit()`, a rolled-back transaction can still enqueue mail for an order that never paid. Horizon will faithfully deliver the bug.

## Failed jobs are a product surface

I do not treat `failed_jobs` as a log file. On every production app I ask:

- Is the table (or Redis failed driver) **monitored** for growth rate, not just size?
- Can an operator **retry** safely, or will retry double-charge / double-email?
- Do we **prune** old failures, or keep them forever until the disk complains?

```php
// app/Console/Kernel.php or routes/console.php schedule
$schedule->command('queue:prune-failed --hours=168')->daily();
$schedule->command('horizon:snapshot')->everyFiveMinutes();
```

`horizon:snapshot` feeds the metrics graphs. Without it, the dashboard looks empty and people stop looking. Pruning failed jobs without reading them first is how you delete the only forensic trail of a bad deploy — so prune on a delay, and alert before prune.

For jobs that must not double-run on retry, I keep an application-level lock or a processed-event table:

```php
use Illuminate\Support\Facades\Cache;

public function handle(): void
{
    $lock = Cache::lock('job:send-order-paid:'.$this->order->id, 120);

    if (! $lock->get()) {
        return;
    }

    try {
        // ...
    } finally {
        $lock->release();
    }
}
```

Horizon retries and Redis visibility timeouts are not the same as application idempotency. I want both.

## Metrics I watch before users feel pain

The Horizon dashboard answers “are workers alive?” Metrics answer “are we about to melt?”

I watch, at minimum:

- **Wait time per queue** — if `high` wait climbs, I scale processes or fix a stuck job type, not “the whole app.”
- **Throughput vs failed rate** — a quiet failure spike after a deploy is a rollback signal.
- **Runtime percentiles** — one job class drifting from 200ms to 8s usually means an N+1 or an external API regression, not “Redis is slow.”
- **Process memory** — repeated worker restarts at the memory ceiling mean the job needs a bigger budget or less data in memory.

I also keep Redis itself honest: `maxmemory` policy, eviction that does not silently drop queue keys, and separate Redis DBs or instances when cache stampedes must not shove queue keys out. Sharing one tiny Redis between cache, sessions, and Horizon without a plan is a classic “it worked until Black Friday” setup.

## Local and staging parity without drama

Developers should not need a full Horizon UI to write a job, but staging should run the same supervisor shape as production (scaled down). My baseline:

- **Local:** `queue:work` or Horizon with one process is fine; feature tests use `Queue::fake()` and assert the job + queue name.
- **Staging:** Horizon on, real Redis, same queue names, lower `maxProcesses`.
- **CI:** assert dispatch targets and job unit behavior; do not require a live Horizon master process for every PR.

```php
public function test_paid_order_dispatches_mail_on_high_queue(): void
{
    Queue::fake();

    $order = Order::factory()->paid()->create();

    app(MarkOrderPaid::class)->handle($order);

    Queue::assertPushedOn('high', SendOrderPaidMail::class);
}
```

If the only test is “Horizon dashboard is green in production,” the next refactor will put a 10-minute export on `high` and nobody will notice until wait times scream.

## Deploy without dropping work

Horizon has a graceful story. I use it:

```bash
php artisan horizon:terminate
# deploy new code
php artisan horizon
# or let Supervisor/systemd restart the horizon process
```

`horizon:terminate` lets current jobs finish, then exits so the process manager starts a fresh master on the new code. Deploy scripts that `kill -9` workers mid-job create the mysterious “sometimes this webhook runs twice” class of bugs.

On systemd or Supervisor, the program should be `php artisan horizon`, not a pile of individual `queue:work` units you forgot to update when queue names changed. One master, config-driven supervisors — that is the point.

## Security and access

Horizon’s dashboard is an operations tool. I never leave it open on the public internet with the default gate. In `HorizonServiceProvider`:

```php
protected function gate(): void
{
    Gate::define('viewHorizon', function ($user = null) {
        return in_array(optional($user)->email, [
            'manirujjamanakash@gmail.com',
            // other ops emails
        ], true);
    });
}
```

In production I also put the UI behind the same auth/VPN posture I use for Telescope. Metrics are not secret; **job payloads often are**.

## When I do not reach for Horizon

Horizon is Redis-backed and Laravel-shaped. I skip it when:

- The app is a thin WordPress plugin that should stay on Action Scheduler (different runtime, different failure culture).
- There is one cron-like command a night and no need for a worker fleet.
- The team cannot operate Redis reliably yet — then fix Redis before you add a prettier worker UI.

For everything else that already runs Laravel queues in production, Horizon is the difference between “workers exist” and “capacity is designed.”

## Checklist I use before calling queues done

1. Queues split by latency class (`high` / `default` / `low` or equivalent).
2. Supervisor `maxProcesses` and memory fit the box next to PHP-FPM and MySQL.
3. Job `$timeout` < Redis `retry_after` on that connection.
4. Critical jobs are idempotent; `afterCommit()` used where transactions matter.
5. `horizon:snapshot` scheduled; failed jobs alerted and pruned on a delay.
6. Deploy uses `horizon:terminate` + process manager restart.
7. Dashboard gated; staging mirrors production queue names at smaller scale.
8. At least one test asserts queue name + job type for the hottest dispatch path.

Queues going quiet is not peace — it can mean workers died. Horizon’s job is to make silence measurable. The patterns above are how I keep that measurement tied to capacity I chose on purpose, not capacity I discovered during an outage.
