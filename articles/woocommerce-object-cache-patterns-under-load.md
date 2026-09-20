---
title: "Object cache patterns that keep WooCommerce plugins honest under load"
slug: woocommerce-object-cache-patterns-under-load
date: 2026-09-20
category: Engineering
excerpt: "Redis and Memcached do not make a WooCommerce plugin fast by magic. Here is how I design cache keys, groups, invalidation, and stampede protection so plugins stay correct when traffic spikes."
readTime: 12 min
tags: [woocommerce, wordpress, object-cache, redis, performance, php, plugins]
---

# Object cache patterns that keep WooCommerce plugins honest under load

When a WooCommerce shop starts hurting under load, the first instinct I see in pull requests is "add Redis." That is not a strategy. An object cache is a sharp tool: used well, it cuts database round-trips and keeps checkout snappy; used poorly, it serves stale cart totals, hides stock that already sold, and creates mysterious "works after I flush cache" support tickets.

I have spent years shipping WooCommerce plugins and payment-adjacent work — including gateway integrations at Paysera and later payment product context around SureCart / Brainstorm Force — where the difference between a calm Black Friday and a pager storm was almost never "did we install Redis?" It was **how we keyed, grouped, invalidated, and protected** the cache under concurrent readers and writers.

This article is the pattern set I use so object caching keeps plugins *honest* when traffic climbs — not just faster for a demo store with three products.

## What "honest under load" means

Honest means:

> After any write that changes business truth (stock, price rules, cart contents, order meta your UI depends on), subsequent reads either see the new truth or deliberately wait — they never silently invent a previous world for a paying customer.

Fast-but-wrong is worse than slow-but-correct at checkout. Merchants forgive a half-second spinner. They do not forgive selling inventory they do not have, or charging a coupon that expired two minutes ago because your fragment still said it was valid.

WordPress's object cache API (`wp_cache_get` / `wp_cache_set` / `wp_cache_delete`) is the right abstraction. Redis or Memcached is the backend. Your plugin owns the *contract*: keys, groups, TTLs, and invalidation triggers.

## The failure modes I design against

Before I write a `wp_cache_set`, I write down the scenarios. If the design does not survive these, it is not done.

1. **Stale read after write** — admin updates a product price; storefront still shows the old price for N minutes because nothing deleted the key.
2. **Cross-tenant bleed** — a multisite or multi-vendor key omits blog/vendor ID and serves Shop A's shipping rates to Shop B.
3. **Cart / session pollution** — caching something that embeds `WC()->cart` or customer-specific fees under a shared key.
4. **Stampede** — a hot key expires; fifty PHP-FPM workers miss at once and all hit MySQL with the same expensive query.
5. **Partial invalidation** — you delete `product_123` but leave `product_123_variations` and a "related products" fragment that still embeds old data.
6. **Cache as source of truth** — writing only to Redis and hoping MySQL catches up later. Under process death, you lose money-shaped state.
7. **Group flush as a lifestyle** — calling `wp_cache_flush()` or flushing a whole group on every save because fine-grained deletes felt hard.

Every one of these has shown up in real shops. Persistent object cache plugins do not fix them. They only make the wrong answer arrive faster.

## Layer 1: name keys like they will outlive you

I treat cache keys as a public API inside the plugin. They get a prefix, a version segment, and every dimension that changes meaning.

```php
final class CacheKey
{
    private const PREFIX = 'myplugin_v2';

    public static function productPricing(int $productId, string $currency): string
    {
        return sprintf(
            '%s:pricing:%d:%s:blog:%d',
            self::PREFIX,
            $productId,
            strtoupper($currency),
            get_current_blog_id()
        );
    }

    public static function shippingMatrix(int $zoneId, string $country): string
    {
        return sprintf(
            '%s:ship:%d:%s:blog:%d',
            self::PREFIX,
            $zoneId,
            strtoupper($country),
            get_current_blog_id()
        );
    }
}
```

Rules I insist on in review:

- **Include blog ID** on multisite, even if "we only run one site today."
- **Include currency / locale / customer role** when the payload depends on them.
- **Bump a version segment** (`v2`) when the value shape changes so old serialized blobs cannot unserialize into half-broken objects.
- Prefer stable integers and enums over free-text in the key; sanitize anything that came from a request.

Never put PII in the key. Email addresses and tokens belong in hashed form if they must appear at all — and usually they should not.

## Layer 2: groups for bulk invalidation, not for laziness

WordPress cache groups let drop-in backends (Redis especially) invalidate related keys together. Use them for *families* of data that share a lifecycle:

```php
const GROUP_PRODUCT = 'myplugin_product';
const GROUP_CART_FRAG = 'myplugin_cart_frag'; // short TTL, customer-scoped keys
const GROUP_REPORTS = 'myplugin_reports';
```

Then:

```php
wp_cache_set($key, $payload, GROUP_PRODUCT, HOUR_IN_SECONDS);
```

When product `123` saves, I delete the specific keys I know about *and* any derived keys registered against that product. I do **not** flush `GROUP_PRODUCT` on every save unless the group is tiny and the shop is small. Group flush is a blunt instrument; under load it recreates the stampede you installed Redis to avoid.

For cart-adjacent fragments I keep a separate group with short TTLs and keys that include the customer / session id. Shared groups and private data do not mix.

## Layer 3: read-through with a single writer on miss

The naive pattern:

```php
$value = wp_cache_get($key, $group);
if (false === $value) {
    $value = $this->expensiveQuery($productId);
    wp_cache_set($key, $value, $group, 300);
}
```

…works until the key expires during a traffic spike. Then every concurrent request runs `expensiveQuery`. On a big catalog query that is how you take MySQL down with kindness.

I prefer a lock / early-return stampede guard:

```php
final class ReadThrough
{
    public static function get(
        string $key,
        string $group,
        int $ttl,
        callable $producer
    ) {
        $cached = wp_cache_get($key, $group);
        if (false !== $cached) {
            return $cached;
        }

        $lockKey = $key . ':lock';
        $gotLock = wp_cache_add($lockKey, 1, $group, 15);

        if (! $gotLock) {
            // Another worker is building. Brief wait, then serve stale or miss.
            usleep(80_000);
            $cached = wp_cache_get($key, $group);
            if (false !== $cached) {
                return $cached;
            }
            // Fall through: better a duplicate query than an empty shelf UI.
        }

        try {
            $value = $producer();
            wp_cache_set($key, $value, $group, $ttl);
            return $value;
        } finally {
            wp_cache_delete($lockKey, $group);
        }
    }
}
```

Notes:

- `wp_cache_add` is atomic on proper persistent backends — it only succeeds if the lock key was absent.
- Soft-TTL / stale-while-revalidate is even better when you can store `{ value, fresh_until }` and serve slightly stale data while one worker refreshes. Not every payload tolerates that (stock counts often should not).
- If the producer throws, delete the lock in `finally` so you do not brick the key for 15 seconds.

## Layer 4: invalidate on the write path, not on a cron hope

Cron-based "rebuild the cache every five minutes" is how you ship yesterday's prices into today's checkout. The write path owns invalidation.

```php
add_action('woocommerce_update_product', static function (int $productId): void {
    $currencies = ['USD', 'EUR']; // whatever your plugin actually supports
    foreach ($currencies as $currency) {
        wp_cache_delete(
            CacheKey::productPricing($productId, $currency),
            GROUP_PRODUCT
        );
    }
    // Derived fragments that embed pricing:
    wp_cache_delete('product_card_' . $productId, GROUP_PRODUCT);
}, 20);
```

I also hook the quieter writers people forget:

- variation saves (`woocommerce_update_product_variation`)
- term / attribute changes that affect filtering facets
- settings screens that change fee rules globally (those often need a version bump, not a thousand deletes)
- order status transitions when your UI caches "purchasable" derived state

If a write can change what the customer sees, name the keys it dirties in the same PR as the write.

## What I refuse to cache

Some things look expensive and still should not live in the object cache as shared entries:

- **Open carts and session objects** — WooCommerce already has a session handler; do not invent a second one in Redis with a generic key.
- **Nonces and capability decisions** — cache the *data* you authorize against, not "user 7 can do X" for long TTLs.
- **Unserialized closures or anonymous classes** — they will break across deploys.
- **Entire `WP_Query` result objects** when you only need IDs — store ID lists, hydrate deliberately.
- **Payment gateway responses that authorize money** — treat those like webhook side effects: persist to the order, then optionally cache a read model. The order row is the source of truth (see also idempotent webhook handling).

When teams ask me to "just cache the cart fragment HTML," I ask whether the key includes session id, currency, applied coupons, and shipping choice. If any dimension is missing, we are building a support queue.

## Measuring before and after

I do not trust feelings. For a hot path I log:

- cache hit / miss / lock-wait counts (a simple `WC()->logger()` channel is enough)
- producer duration on miss
- MySQL slow query log correlation when a key family is flushed

A healthy pattern under load is high hit rate on read-mostly keys (product cards, shipping matrices that change hourly) and deliberate misses on write-heavy, customer-specific paths. If everything is a miss, Redis is a vanity dependency. If everything is a hit and merchants report wrong prices, you are over-caching mutable truth.

On larger builds — the kind of storefront systems we design at [SquartUp](https://squartup.com) for multi-location and high-traffic WooCommerce shops — I also watch stampede markers: spikes of identical producer timings right after a deploy or a big import. That almost always means a version bump or a group flush without a warm-up plan.

## Deploy and warm-up without a cold stampede

Deploys change PHP class shapes. Old cached objects can unserialize into broken state. My checklist:

1. Bump the key version prefix when value shapes change.
2. Prefer storing arrays / DTOs over rich entity graphs.
3. After a big catalog import, warm the top-N product keys from a CLI command *before* opening traffic, or accept a controlled single-flight rebuild.
4. Never call `wp_cache_flush()` in a web request as "cleanup." Use WP-CLI on staging first; on production, flush only the groups you own.

```bash
wp cache flush --quiet   # last resort, maintenance window
# Prefer targeted deletes from a one-off WP-CLI command that knows your keys.
```

## A compact checklist I use in plugin review

- [ ] Every key includes blog id (and vendor / currency / locale when relevant).
- [ ] TTL matches volatility — stock-ish data short or uncached; pure config longer.
- [ ] Write hooks delete every derived key, not only the primary one.
- [ ] Miss path has stampede protection for queries heavier than a primary-key lookup.
- [ ] No shared key holds customer-specific HTML or fees.
- [ ] Cache is a read accelerator; MySQL (or HPOS tables) remains source of truth for money and stock.
- [ ] Logging exists so "Redis is fine" is a graph, not a vibe.

## Closing

Object cache is not a WooCommerce performance personality. It is a contract between your write paths and your read paths. Redis will happily store the wrong answer at microsecond latency. The patterns that keep plugins honest under load are boring on purpose: explicit keys, tight groups, write-through invalidation, single-flight rebuilds, and a clear refusal to cache what must stay personal or transactional.

If you are adding `wp_cache_set` to a checkout-adjacent path this week, start from the failure modes — stale price, cross-tenant bleed, stampede — and only then pick a TTL. That order of thinking has saved me more Friday nights than any cache backend ever did.
