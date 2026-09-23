---
title: "Eloquent query patterns I trust before traffic doubles"
slug: eloquent-query-patterns-before-traffic-doubles
date: 2026-09-23
category: Engineering
excerpt: "Laravel apps rarely die from one slow query — they die from N+1 storms, over-selected columns, and Resource-driven query fans. Here is how I shape Eloquent so the app still breathes when traffic doubles."
readTime: 13 min
tags: [laravel, eloquent, orm, performance, n-plus-one, api-resources, mysql, php]
---

# Eloquent query patterns I trust before traffic doubles

I do not wait for a Black Friday spike to discover that an Eloquent call graph is lying to me. Most Laravel apps I inherit look fine at 50 concurrent users: pages render, APIs respond under 200ms, Telescope is quiet enough that nobody opens it. Then traffic doubles — a campaign, a partner integration, a new mobile client — and the same controllers start doing **hundreds of queries per request**. The SQL is “simple.” The *shape* is not.

Eloquent is not the villain. Unexamined `with()`, lazy accessors, and API Resources that walk relations as if they were free — those are. This is the set of query patterns I insist on before I call a Laravel service production-ready for growth. Not a tips dump. Opinions I will defend in a PR review.

## What “trust” means for an Eloquent path

Before I optimize indexes or buy a bigger RDS instance, I ask four questions about every hot path:

1. **How many queries does this request run on a cold cache?** If I cannot answer, I do not ship the feature.
2. **Which relations are loaded deliberately vs accidentally?** Accidental loads are future N+1s.
3. **Am I selecting columns I will never read?** Wide rows multiply I/O and memory under concurrency.
4. **Would a feature test fail if someone reintroduced an N+1?** If the only safety is “we checked Telescope once,” it will regress.

If those answers are fuzzy, traffic doubling is not a scaling problem — it is a deferred debugging problem.

## Detect N+1 before users do

I treat N+1 as a **process smell**, not a one-off bug. In local and staging I keep Laravel’s lazy-loading prevention on for HTTP kernels I care about:

```php
// AppServiceProvider::boot()
Model::preventLazyLoading(! app()->isProduction());
```

That alone catches the classic loop:

```php
$orders = Order::query()->latest()->limit(50)->get();

foreach ($orders as $order) {
    // Boom under preventLazyLoading — or 50 extra queries in prod.
    echo $order->customer->email;
}
```

In production I do **not** leave `preventLazyLoading` throwing (it can turn a soft regression into a hard outage). I use it in non-prod, and I pair it with query logging on a canary or Telescope / Pulse samples in staging. When I need a surgical check in a test or a console script:

```php
DB::listen(function ($query) {
    logger()->debug($query->sql, [
        'bindings' => $query->bindings,
        'time_ms'  => $query->time,
    ]);
});
```

The goal is not pretty logs. The goal is a **count**. A list endpoint that runs 3–5 queries is usually honest. One that runs 80 with the same `select * from customers where id = ?` pattern is not ready to double.

## `with()` is not optional decoration — constrain it

Eager loading without constraints is how people “fix” N+1 and accidentally load half the database:

```php
// Looks responsible. Pulls every column of every item for every order.
$orders = Order::query()
    ->with(['customer', 'items', 'items.product'])
    ->latest()
    ->paginate(25);
```

What I want instead: **named, constrained eager loads** that match the view or Resource:

```php
$orders = Order::query()
    ->select(['id', 'customer_id', 'status', 'total_cents', 'placed_at'])
    ->with([
        'customer:id,name,email',
        'items' => function ($q) {
            $q->select(['id', 'order_id', 'product_id', 'qty', 'unit_cents'])
              ->orderBy('id');
        },
        'items.product:id,sku,name',
    ])
    ->latest('placed_at')
    ->paginate(25);
```

Notes I leave in review comments when someone pushes the unconstrained version:

- **Parent keys must stay in the select** (`customer_id`, `order_id`, `product_id`) or Eloquent cannot stitch relations.
- **Constrained `with` closures** are where I push `where`, `orderBy`, and column lists — not in the Blade after the fact.
- **Pagination belongs on the root query**, not on a relation you later flatten in PHP.

When a screen only needs a count, I do not load the relation at all:

```php
$orders = Order::query()
    ->withCount('items')
    ->latest('placed_at')
    ->paginate(25);
```

`withCount` is an eager pattern people skip because it feels “advanced.” It is not. It is how you stop hydrating collections you will only `->count()` in a template.

## Select columns like memory matters — because it does

`select *` is fine for a single `findOrFail` in an admin tool. It is reckless on list endpoints. Under double traffic you pay for:

- Larger result sets over the wire from MySQL
- Larger PHP arrays / model attribute bags
- Worse buffer pool locality when many workers run the same fat query

I default list queries to an explicit column list, and I keep a small private scope when the same projection repeats:

```php
public function scopeForIndex(Builder $query): Builder
{
    return $query->select([
        'id',
        'customer_id',
        'status',
        'total_cents',
        'placed_at',
    ]);
}

// usage
Order::query()->forIndex()->with('customer:id,name')->paginate(25);
```

I am careful with JSON columns and text blobs. If `payload` or `notes` is only needed on the detail page, it does not ride along on the index query “for convenience.”

## `loadMissing` for branches — not as a substitute for planning

Sometimes a code path only needs a relation when a flag is set, or after authorization. Blind `load()` can double-fetch; lazy access can N+1. `loadMissing` is the honest middle:

```php
$order = Order::query()
    ->with('customer:id,name,email')
    ->findOrFail($id);

if ($request->boolean('include_items')) {
    $order->loadMissing([
        'items:id,order_id,product_id,qty,unit_cents',
        'items.product:id,sku,name',
    ]);
}
```

I use `loadMissing` in **service methods and Resources** where the caller may have already eager-loaded. I do **not** use it as an excuse to leave controllers relation-blind and sprinkle loads through helpers. Planning the graph once at the edge (controller / action) still beats discovering it in four nested services.

## Chunk vs cursor: batch work without lying to yourself

When I process tens of thousands of rows (exports, reconciliations, backfills), `get()` is how you OOM a worker. The choice between `chunkById` and `cursor` is about **mutation and memory**, not taste.

```php
// Safe default for updates/deletes: keyset chunking.
Order::query()
    ->where('status', 'pending')
    ->orderBy('id')
    ->chunkById(500, function ($orders) {
        foreach ($orders as $order) {
            // mutate / dispatch / write
        }
    });
```

```php
// Read-mostly streams: one model at a time, lower peak memory.
foreach (Order::query()->where('status', 'paid')->orderBy('id')->cursor() as $order) {
    // read and write elsewhere — avoid updating the scanned table in a way
    // that fights the open cursor on some engines/isolation levels
}
```

My rules:

- Prefer **`chunkById`** when the callback updates the same table or when you need predictable batches for progress logging.
- Prefer **`cursor` / lazy** when you are reading a stable snapshot into another system and peak memory matters more than batch boundaries.
- Always **order by a unique key** (`id`) for chunking. `chunk()` on a non-deterministic order is how you skip or duplicate rows while “migrating.”

This is adjacent to traffic doubling because the jobs that “only run at night” suddenly run during the day when volume grows. The query pattern has to survive concurrent writers.

## API Resources are where query storms hide

The most common Laravel N+1 I see in 2025–2026 codebases is not a Blade loop. It is an **API Resource** that touches relations the controller never loaded:

```php
class OrderResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'       => $this->id,
            'status'   => $this->status,
            'customer' => [
                'email' => $this->customer->email, // lazy
            ],
            'items'    => $this->items->map(fn ($item) => [
                'sku'  => $item->product->sku,     // lazy × N
                'qty'  => $item->qty,
            ]),
        ];
    }
}
```

`OrderResource::collection($orders)` after a bare `Order::paginate()` looks clean in the controller and sets production on fire.

Patterns I trust:

1. **Load in the controller (or a dedicated query object) to match the Resource.** The Resource assumes relations exist; it does not discover them.
2. **Use `whenLoaded` so missing relations fail closed in the payload, not open in the DB:**

```php
return [
    'id'       => $this->id,
    'status'   => $this->status,
    'customer' => $this->whenLoaded('customer', fn () => [
        'id'    => $this->customer->id,
        'email' => $this->customer->email,
    ]),
    'items'    => OrderItemResource::collection(
        $this->whenLoaded('items')
    ),
];
```

3. **Conditional includes via query params** (`?include=customer,items`) resolve to an allow-list of `with()` keys — never to arbitrary relation names from the client.
4. **Avoid accessors that query.** An `getTotalPaidAttribute()` that runs a fresh aggregate per model is an N+1 wearing a suit. Prefer `withSum` / subselects on the root query.

When traffic doubles, JSON endpoints usually grow first. Resources are the choke point. I review them like SQL.

## Index-aware queries from the application side

I am not a DBA, but I write Eloquent as if indexes exist — because if they do not, my where clauses are fiction. From the app side that means:

- **Filter on selective columns first** (`status`, `customer_id`, `placed_at` ranges) and keep the predicate aligned with composite indexes the migration actually created.
- **Avoid wrapping columns in functions** in `where` (`whereRaw('DATE(placed_at) = ?')`) when a range works (`whereBetween('placed_at', [...])`).
- **Do not `orderBy` a low-cardinality column alone** on huge tables without a supporting index or a tighter `where`.
- **Prefer `whereKey` / `whereIn` on primary keys** after you have already narrowed IDs, instead of re-filtering fat predicates in PHP.

Example of an index-friendly list vs a friendly-looking trap:

```php
// Trap: leading wildcard + order on non-indexed expression territory
Order::query()
    ->where('notes', 'like', '%refund%')
    ->orderByDesc('updated_at')
    ->limit(50)
    ->get();

// Better app-side shape: structured field + bounded time window
Order::query()
    ->where('status', 'refunded')
    ->where('placed_at', '>=', now()->subDays(30))
    ->orderByDesc('placed_at')
    ->limit(50)
    ->get();
```

When I need full-text or fuzzy search, I push that to a dedicated search store or a real `FULLTEXT` / Scout index — I do not pretend `LIKE %...%` will survive double traffic.

I also keep **foreign keys and filter columns indexed in migrations** next to the feature that introduces the query. Shipping the endpoint without the index is how “works in staging” becomes “locks in production.”

## Tests that catch N+1 — the part teams skip

Telescope is not a test. I want a regression that fails CI when someone removes a `with()`:

```php
public function test_order_index_does_not_n_plus_one(): void
{
    $customers = Customer::factory()->count(5)->create();
    foreach ($customers as $customer) {
        Order::factory()->count(3)->for($customer)->create()
            ->each(fn (Order $order) => OrderItem::factory()->count(2)->for($order)->create());
    }

    DB::flushQueryLog();
    DB::enableQueryLog();

    $this->getJson('/api/orders')
        ->assertOk();

    $queries = collect(DB::getQueryLog());
    $selects = $queries->where(fn ($q) => str_starts_with(strtolower($q['query']), 'select'));

    // Honest budget for this endpoint — tune to your Resource graph.
    $this->assertLessThanOrEqual(
        8,
        $selects->count(),
        'Order index query count rose — check eager loads / Resources.'
    );
}
```

A few opinions on making that test useful:

- **Seed enough rows** that an N+1 would multiply (5+ parents). Two rows hide nothing.
- **Assert an upper bound**, not an exact count, unless the endpoint is tiny — schema noise and framework queries vary by Laravel version.
- **Pair with `Model::preventLazyLoading()` in the test environment** so lazy access fails loudly even if your count assertion is generous.
- **Test the Resource collection path**, not only the happy HTML page. That is where storms live.

I have deleted more “performance” PRs that lacked a query-count test than I have merged. Without the test, the next feature reintroduces the load in a different Resource method and nobody notices until latency graphs move.

## A short review checklist

Before I merge a Laravel PR that touches list endpoints, exports, or API Resources:

1. **Query budget known** — measured locally with log or Debugbar; not vibes.
2. **Eager loads constrained** — columns + nested relations match the Resource/view.
3. **No relation I/O inside accessors** used on collections.
4. **`whenLoaded` / allow-listed includes** on API Resources.
5. **Chunk/cursor for bulk paths** — no `Model::all()` on unbounded tables.
6. **Where clauses match indexes** the migration ships.
7. **A feature test fails if N+1 returns** — count assertion or lazy-loading prevention.

## Why this matters before traffic doubles

Scaling hardware is easy to request and slow to help when each request already fans out into dozens of identical lookups. Eloquent will happily generate that fan-out with elegant syntax. My job as a senior engineer on a Laravel codebase is to make the **default path boring**: few queries, narrow selects, explicit graphs, and tests that keep it that way.

I ship Laravel APIs and admin surfaces where the database is shared with other services and “just add Redis” is not a substitute for fixing the request shape. When the next endpoint is about to land, I do not start from `Model::with('everything')->get()`. I start from the Resource contract, write the `with()` to match, bound the query count in a test, and only then argue about indexes and instance size.

Traffic will double eventually. The query patterns I trust are the ones that still look calm in the slow query log when it does.
