---
title: "Redis caching in Laravel: stampedes, invalidation, and the keys I trust"
slug: redis-caching-laravel-stampedes-invalidation-i-trust
date: 2026-10-11
category: Engineering
excerpt: "Adding Cache::remember everywhere feels like a performance win until a key expires under load and fifty workers rebuild it at once. Here is how I design Redis cache keys, invalidation, locks, and fallbacks in Laravel so caching stays a feature, not a source of mystery bugs."
readTime: 11 min
tags: [laravel, redis, caching, performance, php, backend, architecture]
---

# Redis caching in Laravel: stampedes, invalidation, and the keys I trust

Every Laravel codebase I have joined has the same moment in its history. A page got slow, someone wrapped a query in `Cache::remember`, the page got fast, and everyone moved on. Six months later there are two hundred `remember` calls, nobody knows which keys exist, a customer sees yesterday's price, and the "fix" is `php artisan cache:clear` in production on a Friday.

Caching is not hard to add. It is hard to keep honest. In this post I want to walk through the rules I now follow when I put Redis in front of a Laravel app: how I name keys, how I decide what to cache at all, how I invalidate, how I stop cache stampedes, and how I make sure the app still works when Redis has a bad day.

None of this is exotic. It is the boring discipline that separates "we have a cache" from "we trust our cache".

## First question: should this be cached at all?

Before I write a single cache call, I ask three questions.

1. **Is the slow part actually the thing I am about to cache?** I run the request with Telescope, Debugbar, or plain query logging first. Half the time the real problem is an N+1 or a missing index, and caching would only hide it until the cache is cold.
2. **How wrong can this data be, and for how long?** A list of countries can be stale for a week. An account balance cannot be stale for a second. If I cannot answer this in one sentence, I am not ready to cache it.
3. **Who changes this data, and do I control every write path?** If writes come from an admin panel, an API, a queue job, and a nightly import, invalidation has to cover all four. If I cannot list the write paths, I prefer a short TTL over clever invalidation.

My rough default lanes look like this:

- **Reference data** (plans, settings, feature flags, menus): long TTL plus explicit invalidation on write.
- **Expensive aggregates** (dashboard counts, reports): medium TTL, rebuilt in the background, never computed inside a web request under load.
- **Per-user hot reads** (profile, permissions): short TTL, keyed by user and a version number.
- **Money, stock, anything transactional**: not cached. Read from the database, make the query fast instead.

That last one saves more incidents than any clever pattern below.

## Configure Redis like you mean it

Laravel makes it easy to point cache, sessions, and queues at the same Redis connection. I avoid that. When the cache fills up and Redis starts evicting, I do not want it evicting queued jobs or sessions.

In `config/database.php` I keep separate logical databases, or better, separate instances in production:

```php
'redis' => [
    'client' => env('REDIS_CLIENT', 'phpredis'),

    'options' => [
        'prefix' => env('REDIS_PREFIX', 'app_'.env('APP_ENV').'_'),
    ],

    'default' => [
        'host' => env('REDIS_HOST', '127.0.0.1'),
        'port' => env('REDIS_PORT', '6379'),
        'database' => env('REDIS_DB', '0'),
    ],

    'cache' => [
        'host' => env('REDIS_CACHE_HOST', env('REDIS_HOST', '127.0.0.1')),
        'port' => env('REDIS_PORT', '6379'),
        'database' => env('REDIS_CACHE_DB', '1'),
    ],
],
```

Then the cache store uses the `cache` connection and queues use `default`. On the cache instance I set `maxmemory` and `maxmemory-policy allkeys-lru`. On the queue instance I set `noeviction`, because a silently dropped job is far worse than a loud memory error.

I also use `phpredis` over Predis on anything with real traffic. It is a compiled extension, it is faster, and it supports serializers and compression that matter once values get big.

## Key naming is an API

Cache keys outlive the developer who wrote them. I treat them like a public API with a schema.

My format is:

```
{domain}:{entity}:{id}:{variant}:v{version}
```

For example:

```
billing:plan:all:v3
catalog:product:4821:summary:v1
user:42:permissions:v7
report:team:19:monthly:2026-10:v1
```

A few rules make this work:

- **No string concatenation scattered through controllers.** Keys are built in one place.
- **A version segment per key family.** When I change the shape of the cached value, I bump the version instead of hoping old values expire before deploy.
- **Never put raw user input in a key** without normalizing it. Search terms with spaces, casing, and Unicode create thousands of near-duplicate keys.

I usually wrap this in a tiny class per domain:

```php
final class CatalogCacheKeys
{
    private const VERSION = 1;

    public static function productSummary(int $productId): string
    {
        return sprintf('catalog:product:%d:summary:v%d', $productId, self::VERSION);
    }

    public static function categoryListing(int $categoryId, int $page): string
    {
        return sprintf('catalog:category:%d:page:%d:v%d', $categoryId, $page, self::VERSION);
    }
}
```

It looks almost too simple. That is the point. When a bug report says "product 4821 shows the old name", I can grep one file and know exactly which key to inspect with `redis-cli GET`.

## Wrap reads in a repository, not in controllers

The worst caching code I see lives inline in controllers and Blade view composers. Every caller decides its own TTL and key, and invalidation becomes archaeology.

I keep cache access behind a small read service:

```php
final class ProductSummaryReader
{
    public function __construct(private CacheRepository $cache) {}

    public function forProduct(int $productId): ProductSummary
    {
        return $this->cache->remember(
            CatalogCacheKeys::productSummary($productId),
            now()->addHours(6),
            fn () => ProductSummary::fromModel(
                Product::query()
                    ->with(['category:id,name', 'primaryImage'])
                    ->findOrFail($productId)
            )
        );
    }

    public function forget(int $productId): void
    {
        $this->cache->forget(CatalogCacheKeys::productSummary($productId));
    }
}
```

Two details matter here.

First, I cache a **plain data object**, not an Eloquent model. Serialized models drag relations, casts, and hidden state into Redis, and they break in confusing ways when the model class changes between deploys. A small readonly DTO is cheaper to store and safe to unserialize.

Second, the read and the invalidation live in the same class. Anyone who changes how the value is built sees the `forget` method right below it.

## Invalidation: pick one strategy per key family

There are only a few honest ways to invalidate, and mixing them on the same data is how stale bugs happen.

### 1. Delete on write

The simplest. When a product is updated, forget its summary key. I hook this into the domain action rather than a model observer when I can:

```php
final class UpdateProduct
{
    public function __construct(private ProductSummaryReader $summaries) {}

    public function handle(Product $product, array $data): Product
    {
        DB::transaction(function () use ($product, $data) {
            $product->update($data);
        });

        // Only after the commit succeeded.
        $this->summaries->forget($product->id);

        return $product;
    }
}
```

Note the ordering. If you forget the key inside the transaction, another request can rebuild the cache from the old, uncommitted row, and the stale value sticks until TTL. Laravel's `DB::afterCommit()` or `ShouldDispatchAfterCommit` on events solves the same problem when invalidation happens in listeners.

Observers are fine for small apps, but they miss mass updates (`Product::where(...)->update()`), raw queries, and imports. If those paths exist, an observer gives you false confidence.

### 2. Version counters

For families of keys that are hard to enumerate, like "every cached page of every listing for this team", I do not delete keys at all. I keep a version number and include it in the key:

```php
public function teamVersion(int $teamId): int
{
    return (int) Cache::rememberForever("team:{$teamId}:version", fn () => 1);
}

public function bumpTeam(int $teamId): void
{
    Cache::increment("team:{$teamId}:version");
}

$key = "team:{$teamId}:listing:page:{$page}:tv".$this->teamVersion($teamId);
```

Bumping the version makes every old key unreachable instantly. They expire on their own TTL or get evicted by LRU. This is the pattern I reach for most in multi-tenant apps, because "clear everything for this tenant" becomes a single atomic increment.

### 3. Cache tags, carefully

Laravel's cache tags work on Redis and look perfect on paper. In practice I use them sparingly. Tagged entries keep extra bookkeeping sets in Redis, those sets can grow large, and flushing a busy tag touches a lot of keys at once. For small, bounded families tags are fine. For anything that grows with users or tenants, I prefer version counters.

### 4. TTL only

Sometimes the honest answer is "this can be five minutes stale, and I will not write invalidation code for it". That is a valid decision as long as it is written down next to the key. Short TTLs are also my safety net on top of the other strategies: even explicitly invalidated keys get a TTL, so a missed write path heals itself.

## Cache stampedes: the bug that only shows up under load

Here is the scenario. A dashboard aggregate takes four seconds to compute. It is cached for ten minutes. At minute ten the key expires, and in the next four seconds two hundred requests arrive. Every one of them sees a miss, every one runs the four-second query, and the database falls over exactly when traffic is highest.

`Cache::remember` does nothing to prevent this. I use three tools, often together.

### Locks around the rebuild

Laravel's atomic locks on Redis let only one worker rebuild while others wait briefly or serve something older:

```php
public function teamStats(int $teamId): TeamStats
{
    $key = "report:team:{$teamId}:stats:v2";

    if ($cached = Cache::get($key)) {
        return $cached;
    }

    return Cache::lock("lock:{$key}", 10)->block(5, function () use ($key, $teamId) {
        // Someone may have rebuilt it while we waited.
        return Cache::get($key) ?? tap(
            TeamStats::compute($teamId),
            fn ($stats) => Cache::put($key, $stats, now()->addMinutes(10))
        );
    });
}
```

The re-check inside the lock is the important line. Without it, every waiting worker still recomputes after the first one finishes.

### Stale-while-revalidate with flexible

Recent Laravel versions ship `Cache::flexible()`, which serves a stale value during a grace window and refreshes it in the background after the response:

```php
$stats = Cache::flexible("report:team:{$teamId}:stats:v2", [600, 900], function () use ($teamId) {
    return TeamStats::compute($teamId);
});
```

For the first 600 seconds the value is fresh. Between 600 and 900 seconds users get the stale value instantly while a deferred function recomputes it. After 900 it behaves like a normal miss. For dashboards this is usually exactly the trade I want: nobody waits, and nobody gets data older than fifteen minutes.

### Jittered TTLs

If you warm a thousand keys at deploy time with the same TTL, they all expire in the same second. I add a little randomness:

```php
$ttl = now()->addMinutes(60)->addSeconds(random_int(0, 300));
```

It is one line and it flattens the expiry cliff completely.

### Precompute the truly expensive things

When a value takes more than a second or two, I stop computing it on request at all. A scheduled job or a queued job triggered by writes builds it and puts it in the cache. The web request only ever reads. If the key is missing, the page shows a "calculating" state instead of hammering MySQL. This moved one reporting screen I worked on from timeouts during peak hours to boring, consistent response times, without touching the query itself.

## When Redis is down, the app should still work

A cache is an optimization. If losing it takes the whole site down, it is a dependency, and it needs to be treated like one.

I check two things:

- **Reads degrade to the database.** I wrap hot cache reads so that a connection exception logs a warning and falls through to the real query, instead of throwing a 500. Users get slower pages, not error pages.
- **Timeouts are short.** The phpredis `read_timeout` and connect timeout should be well under a second for the cache connection. A Redis that hangs for thirty seconds is worse than one that refuses connections.

```php
public function safeRemember(string $key, $ttl, Closure $callback): mixed
{
    try {
        return Cache::remember($key, $ttl, $callback);
    } catch (\RedisException|\Predis\Connection\ConnectionException $e) {
        report($e);
        return $callback();
    }
}
```

I would not wrap every call like this. I wrap the handful on the critical path, like the homepage, login, and checkout reads, and let less important ones fail loudly so I notice.

## Observability: know what is in there

You cannot trust a cache you cannot see. A few habits help:

- **Track hit and miss rates** per key family. A simple counter in a decorator, pushed to whatever metrics you use, tells you quickly when a version bump or deploy has made a family permanently cold.
- **Watch memory and evictions.** `INFO stats` and `INFO memory` on the cache instance. A sudden jump in `evicted_keys` means your TTLs or value sizes changed.
- **Look for big keys.** `redis-cli --bigkeys` once in a while finds the cached collection someone stored with every relation attached.
- **Never use `KEYS *` in production.** It blocks Redis. Use `SCAN` with a pattern when you must explore.

And one rule for the team: `cache:clear` in production is an incident, not a fix. If someone needed it, there is a missing invalidation path, and that deserves a ticket.

## Testing cache behavior

Most cache bugs are invalidation bugs, and they are easy to test if the cache logic lives in services rather than controllers. My tests usually look like this:

```php
it('forgets the product summary after an update', function () {
    $product = Product::factory()->create(['name' => 'Old']);
    $reader = app(ProductSummaryReader::class);

    expect($reader->forProduct($product->id)->name)->toBe('Old');

    app(UpdateProduct::class)->handle($product, ['name' => 'New']);

    expect($reader->forProduct($product->id)->name)->toBe('New');
});
```

The test uses the array cache driver, which is fine for logic. For lock and stampede behavior I run a small set of integration tests against a real Redis in CI, because the array driver's locks do not reflect real concurrency.

## My checklist before merging any caching change

When I review a pull request that adds caching, these are the questions I ask:

1. Was the underlying query profiled and fixed first, if it could be?
2. Is the key built in one central place, with a version segment?
3. Is the cached value a plain DTO or array, not a model?
4. Which invalidation strategy does this family use, and does it cover every write path?
5. Does invalidation happen after the transaction commits?
6. Is there a TTL, even if invalidation is explicit?
7. Could this key stampede, and if so, is there a lock, `flexible`, or precompute?
8. What happens on this page if Redis is unreachable?

If a change passes those eight, I stop worrying about it. If it fails two or three, it usually means the cache is hiding a problem instead of solving one.

## Final verdict

Redis is one of the best tools in a Laravel engineer's kit, and `Cache::remember` is one of the most dangerous lines in the framework precisely because it is so easy. The fix is not to cache less. It is to cache on purpose: decide how stale each piece of data may be, give every key a name and a version, pick one invalidation strategy per family, protect expensive rebuilds from stampedes, and make sure the app survives without the cache.

Do that, and caching goes back to being what it should be: a quiet multiplier on a system that was already correct.
