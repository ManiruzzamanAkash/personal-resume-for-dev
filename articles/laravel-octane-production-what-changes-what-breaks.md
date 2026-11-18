---
title: "Laravel Octane in production: what changes and what breaks"
slug: laravel-octane-production-what-changes-what-breaks
date: 2026-11-18
category: Laravel
excerpt: "Octane makes Laravel faster by keeping the app in memory between requests, which also means state from one user can leak into the next. Here is what changes in production, what tends to break, and how I roll it out safely."
readTime: 11 min
tags: [laravel, octane, performance, php, frankenphp, swoole, saas]
---

# Laravel Octane in production: what changes and what breaks

> **In short**
> - **The problem:** Laravel Octane makes an app faster by keeping it loaded in memory instead of starting fresh on every request. That speed comes with a catch: data from one visitor can stay in memory and show up for the next, and small memory leaks pile up until workers crash. Those bugs reach customers, not just logs.
> - **What I do about it:** I audit the code for state that outlives a request, fix it with the right container bindings, add a test that proves two users don't bleed into each other, and set up deploys and worker limits before switching traffic over.
> - **Who this is for:** Laravel teams considering Octane for an API or SaaS, and tech leads who have turned it on and are now seeing strange, hard-to-reproduce bugs.

The failure I see most often after a team turns on Octane is not a crash. It is a support ticket that nobody can reproduce: a user sees the wrong language, the wrong currency, or another account's name in the header for one page load. Refresh, and it's gone.

The second failure is slower. Memory on the app server creeps up through the day. Nobody changed anything. Eventually a worker is killed, a few requests fail, and the graph starts climbing again.

Both have the same cause. Octane changes one assumption that most PHP code, and many packages, were written around. Once you know which assumption, the fixes are mostly mechanical.

## Octane changes one assumption: the app no longer dies after each request

Classic PHP with PHP-FPM is "shared nothing." Every request boots the framework, loads config, registers service providers, handles the request, and then throws everything away. Whatever a request left behind in memory is gone before the next one arrives. That is wasteful, and it is also forgiving.

Octane runs your app on a long-lived application server instead. The current options are FrankenPHP, Swoole, Open Swoole and RoadRunner. Each worker process boots Laravel once, keeps it in memory, and feeds it request after request. The `register` and `boot` methods of your service providers run once per worker, not once per request.

Octane resets the framework's own state between requests. It does not know about the state your application or your packages create. Anything that lives in a singleton, a static property, or a long-lived object now survives into the next request, which may belong to a different user.

## The speed comes from skipping the boot, not from faster code

Octane removes the cost of bootstrapping the framework on every request. If your requests are short and the boot is a large share of their time, as with a JSON API that does a couple of indexed queries, the gain can be large.

If a request spends most of its time waiting on a slow query, an external API or a heavy report, Octane changes very little. The query is just as slow. I've written before about where that time usually goes in [Redis caching for Laravel](/article/redis-caching-laravel-stampedes-invalidation-i-trust/). Fix those first. Octane is a multiplier on an app that is already reasonably efficient, not a repair for one that isn't.

## Singletons that hold the request are the first thing to break

The classic Octane bug is a singleton that captures something request-specific when it is built. Because the singleton is built once per worker, it keeps that first request forever.

```php
// AppServiceProvider::register()
$this->app->singleton(PriceFormatter::class, function ($app) {
    // Bug under Octane: this request (and its user, locale and
    // currency) is captured once and reused for every later request.
    return new PriceFormatter($app['request']);
});
```

The Laravel documentation names three things you should not inject into the constructor of a long-lived object: the application container, the HTTP request, and the configuration repository. Each can go stale. The fixes, in the order I prefer them:

1. **Pass the data at call time.** If the formatter needs a currency, give it a currency: `$formatter->format($amount, $user->currency)`. The object stays stateless and works the same under any server.
2. **Use `scoped` instead of `singleton`.** A scoped binding is built at most once per request or queued job, then flushed when Octane starts the next one. This is the right tool for a "current tenant" or "current account" service.
3. **Inject a resolver, not the value.** `new Service(fn () => $app['request'])` gives the object a closure that always returns the current request. It works, but it hides a dependency, so I treat it as a last resort.

```php
// Built once per request or job, never shared across users.
$this->app->scoped(CurrentTenant::class, function ($app) {
    return CurrentTenant::fromRequest($app['request']);
});
```

That second example matters for any SaaS. In my article on [Laravel multi-tenancy](/article/laravel-multi-tenancy-single-database-schema-or-database-per-tenant/), the whole design hangs on one service that knows the current tenant. Register that service as a plain singleton under Octane and you have built the cross-tenant data leak the design was meant to prevent. Under PHP-FPM, the same code is fine, which is exactly why it slips through review.

Controllers and route closures are safe: type-hinting `Request` in a controller method gives you the current request. The global `request()` and `app()` helpers also always return the current instances.

## Static properties and package state leak between users

Singletons are the bug you can grep for. Static state is harder to spot. A class that caches lookups in a static array is a small optimization under PHP-FPM and a memory leak under Octane, because the array is never thrown away:

```php
class ExchangeRates
{
    private static array $seen = [];

    public static function remember(string $key, float $rate): void
    {
        // Grows on every request, for the life of the worker.
        self::$seen[$key] = $rate;
    }
}
```

The same goes for static "current user" holders, memoized values on long-lived objects, and properties set on a singleton during one request and read in the next. If the data is per user, it leaks between users. If it only grows, it leaks memory.

Packages are where this hides. Many were written before Octane existed and assume the process dies after every request. Before switching, I check each package that registers singletons or keeps static state, look for Octane notes in its documentation or issues, and add any binding that must be rebuilt to the `flush` list in `config/octane.php`. Octane re-resolves bindings in that list on every request.

## Connections and memory now last as long as the worker

Two kinds of resources change behavior when the process stops dying.

**Database and Redis connections stay open.** In the default `config/octane.php`, the `DisconnectFromDatabases` listener is commented out, so a worker keeps its connections between requests. That is part of the speed gain. It also means your connection count is roughly workers per server multiplied by servers, held all the time rather than in short bursts. Check that the database's connection limit and idle timeouts are sized for that before you add more workers. Don't leave a transaction or a `SET` session variable open at the end of a request either, because the next request inherits the connection.

**Memory is now your problem.** Octane's guard against slow leaks is to restart each worker gracefully after it has handled 500 requests by default, adjustable with `--max-requests`. That cap is a safety net, not a fix. I lower it while a team is still finding leaks, watch memory per worker over a day of real traffic, and only raise it once the graph is flat.

Long requests behave differently too. Octane has its own `max_execution_time` setting in `config/octane.php`, 30 seconds by default, so a long export that ran fine under your old PHP-FPM settings may now be cut off. Long work belongs on a queue anyway, which I cover in [Laravel Horizon production patterns](/article/laravel-horizon-production-patterns-i-trust/).

## Deploys must reload workers, or the old code keeps serving

Under PHP-FPM, a new release is picked up on the next request (give or take OPcache). Under Octane, workers hold the old code in memory until they restart. A deploy that only swaps files will appear to succeed while customers keep running the previous version.

Every deploy needs to run `php artisan octane:reload`, which restarts the workers gracefully so they load the new code. If you deploy with atomic symlinked releases, as in [zero-downtime Laravel deploys on a small VPS](/article/zero-downtime-laravel-deploys-small-vps-atomic-releases/), the reload belongs right after the symlink switch, and the process supervisor should point at the `current` path rather than a specific release directory.

Locally, `octane:start --watch` restarts the server when files change. It needs Node and the Chokidar package installed in the project. It is a development convenience only, never something to run in production.

## Swoole-only features are lock-in you should choose deliberately

Some of Octane's most attractive features work only on Swoole or Open Swoole: `Octane::concurrently()` for running tasks in parallel, ticks and intervals, the Octane cache driver, and Swoole tables shared across workers. They are fast. They also tie your app to one server, and the cache and table data is lost whenever the server restarts, which includes every deploy.

I start with none of them. If a team needs to run work in parallel, a queue is usually clearer and survives restarts. If they need a shared cache, Redis already does that and outlives a deploy. I would only adopt a Swoole-only feature for a measured, specific need, and I'd write down that it rules out switching to FrankenPHP or RoadRunner later.

## Prove isolation with a test before you trust it

The bugs above are invisible to a normal test suite, because each test usually makes one request. A cheap check that catches the common case is a feature test that sends two requests as two different users in the same test. Within one test, Laravel reuses the same application instance across requests, so singletons and static state survive between them, much like they would in an Octane worker.

```php
public function test_second_user_never_sees_first_users_state(): void
{
    [$alice, $bob] = User::factory()->count(2)->sequence(
        ['locale' => 'en', 'currency' => 'USD'],
        ['locale' => 'de', 'currency' => 'EUR'],
    )->create();

    $this->actingAs($alice)->get('/dashboard')->assertSee('USD');

    $this->actingAs($bob)->get('/dashboard')
        ->assertSee('EUR')
        ->assertDontSee('USD');
}
```

It is not a perfect copy of a worker; Octane does some per-request resetting that a test does not. It is still the fastest way I know to catch a singleton that captured the first user. I write one of these for each screen that shows user-, tenant- or locale-specific data, then load test on staging under the real server and watch memory per worker.

## Trade-offs, and when not to use Octane

- **Don't adopt it for a slow app.** If requests are slow because of queries or external calls, Octane hides nothing and adds risk. Profile first.
- **Don't adopt it with a team that can't audit state.** The bugs are subtle and only appear under load. If nobody owns reviewing singletons and statics, PHP-FPM is the safer default.
- **Be careful with a large, old package set.** The more packages that predate Octane, the more state you have to audit or flush. On some apps the audit costs more than the speed is worth.
- **Expect more operational work.** Worker counts, memory per worker, connection limits and reload-on-deploy are now your responsibility. A plain PHP-FPM setup has fewer of these.
- **It is reversible, so keep it that way.** Code written to be Octane-safe (stateless services, scoped bindings, data passed at call time) also works under PHP-FPM. If you avoid Swoole-only features, you can switch back with a config change.

## What I check on a project like this

1. Is there a measured reason for Octane: a profile showing framework boot is a large share of request time?
2. Has every `singleton` binding been reviewed for a captured request, container or config repository?
3. Are per-request services such as the current tenant, user or locale registered as `scoped`?
4. Has the code, and each package that keeps state, been checked for static properties that hold per-user data or only grow?
5. Is there a two-user isolation test for each screen that shows user- or tenant-specific data?
6. Is `--max-requests` set deliberately, with memory per worker graphed over a full day of traffic?
7. Are database and Redis connection limits sized for workers per server multiplied by servers?
8. Does every deploy run `octane:reload`, with the supervisor pointed at the `current` release path?

My default is to leave Laravel on PHP-FPM until a profile shows that framework boot is a meaningful share of request time, and then to treat Octane as a migration rather than a switch. The work is mostly an audit: find state that outlives a request, move it to call-time arguments or scoped bindings, prove isolation with tests, and make deploys and memory limits boring. Done that way, Octane is a large, low-drama speed gain for API-heavy apps. Done as a one-line config change, it trades a performance problem for a data-isolation problem, and the second one is far harder to explain to a customer.
