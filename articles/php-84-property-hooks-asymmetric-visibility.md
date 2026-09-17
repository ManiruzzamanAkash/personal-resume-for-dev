---
title: "PHP 8.4 object modeling: property hooks and asymmetric visibility"
slug: php-84-property-hooks-asymmetric-visibility
date: 2026-09-17
category: Engineering
excerpt: "PHP 8.4 lets me keep Order invariants without getter/setter noise: asymmetric visibility for status, set hooks for email normalization, and virtual properties for derived labels."
readTime: 14 min
tags: [php, php-84, object-modeling, property-hooks, asymmetric-visibility, laravel, woocommerce, wordpress]
---

# PHP 8.4 object modeling: property hooks and asymmetric visibility

For years I wrote the same three layers around every important field on an order-like object: a private property, a public getter, and a setter that validated, normalized, and then wrote. In WooCommerce plugins that dance shows up as `get_status()` / `update_status()`. In Laravel entities it shows up as mutators, casts, and careful `fillable` lists. The intent was always the same — **keep invariants without leaking mutable state** — but the ceremony leaked into every call site.

PHP 8.4 finally gives the language a cleaner place to put that discipline: **property hooks** and **asymmetric visibility**. I am not rewriting every plugin overnight. I am designing new domain objects — and new Laravel-side companions next to WordPress — so that “who may read” and “who may write” live on the property itself, not in a pile of methods I have to remember to call.

This is the modeling toolkit I reach for in 2026 when the domain is an order, a payment transition, or any aggregate that must stay honest under concurrent plugin code.

## Why architects care

When I review a payment or fulfillment change, I do not ask whether the code “has a setter.” I ask whether the **aggregate owns its transitions**.

Classic getter/setter APIs fail that test in two ways:

1. **Boilerplate that nobody trusts** — every field gets `getX` / `setX`, so reviewers stop reading the setters. Invalid email slips through because “there is a setter,” even when the setter only assigns.
2. **Mutable leakage** — if `$order->status` is a public string, any service, any Action Scheduler job, any REST controller can write `"paid"` without going through payment confirmation. If it is private and you only expose setters, you still teach the whole codebase to treat status as a free write.

What I want instead:

- **Readable** status for templates, admin UI, and API serializers.
- **Writable only inside the aggregate** (or a tightly controlled domain service), so `markPaid()` is the transition, not `$order->status = 'paid'`.
- **Normalization at the boundary** — emails lowercased, empty strings rejected — without a ceremonial `setEmail()` that half the codebase forgets.

Property hooks and asymmetric visibility are the language features that make that design cheap to express and hard to accidentally bypass.

## Property hooks: get and set on the property

A property hook attaches `get` and/or `set` logic **to the property name**. Call sites still look like property access. The hook runs when someone reads or writes.

There are two shapes I use constantly:

### Backed properties

A backed property still has storage. The `set` hook can validate or normalize, then write to the underlying value. The `get` hook can transform on read if you need it (I usually keep get thin).

```php
class CustomerEmail
{
    public string $email {
        set (string $value) {
            $normalized = strtolower(trim($value));
            if ($normalized === '') {
                throw new InvalidArgumentException('Email cannot be empty.');
            }
            if (! filter_var($normalized, FILTER_VALIDATE_EMAIL)) {
                throw new InvalidArgumentException('Email is not valid.');
            }
            $this->email = $normalized;
        }
    }

    public function __construct(string $email)
    {
        $this->email = $email; // runs the set hook
    }
}
```

No `setEmail()` method. Assignment is the API. Validation lives next to the field, which is where reviewers look when they ask “what are the rules for email?”

### Virtual properties

A virtual property has **no backing storage**. It is derived. Perfect for labels, display codes, and anything that would otherwise become a `getLabel()` that every template must remember.

```php
class OrderSummary
{
    public function __construct(
        public private(set) int $id,
        public private(set) string $status,
    ) {}

    public string $label {
        get => "Order #{$this->id} ({$this->status})";
    }
}
```

`$summary->label` always reflects current id and status. There is nothing to get out of sync because there is no second copy of the string.

### What I put in set hooks

In real WooCommerce and Laravel work, set hooks earn their keep when they:

- **Normalize** — trim, lowercase email, uppercase ISO currency codes.
- **Reject** — empty strings, negative money amounts, unknown enum-like statuses when the write is meant to be free-form elsewhere.
- **Coerce carefully** — string `" 12.50 "` to a money value type, if your project already owns that type.

I do **not** put side effects in set hooks: no emails, no queue jobs, no HTTP. Those belong in application services after the aggregate decides a transition succeeded. A hook that sends mail turns every accidental reassignment into a production incident.

## Asymmetric visibility: public to read, private to write

Asymmetric visibility is the feature I wish I had the first time a merchant support script “fixed” an order by writing status directly.

```php
public private(set) string $status;
```

Means:

- **Outside the class**: `$order->status` is readable.
- **Outside the class**: `$order->status = 'paid'` is a fatal error (visibility).
- **Inside the class**: assignment is allowed, so `markPaid()` can update it.

That is the difference between an aggregate and a bag of fields.

### Contrast with `readonly`

People conflate `private(set)` with `readonly`. They solve different lifetimes.

| Intent | Tool |
| --- | --- |
| Assign once in the constructor; never change again | `readonly` (or promoted `public readonly`) |
| Readable outside; changeable over the object lifetime, but only inside the class | `public private(set)` |
| Readable and writable only inside | `private` (classic) |

Order **id** is often `readonly` or `private(set)` set once. Order **status** is almost never readonly — it must move from `pending` → `processing` → `completed` (or your gateway’s dialect). Payment intent ids might be readonly after capture starts. Status is a lifetime field with a restricted writer.

```php
final class PaymentReference
{
    public function __construct(
        public readonly string $gatewayTxnId,
        public private(set) string $captureState = 'authorized',
    ) {}

    public function markCaptured(): void
    {
        $this->captureState = 'captured';
    }
}
```

Here the gateway transaction id is immutable after construction. Capture state can still move — but only through methods I own.

## Hooks are not readonly — do not mix the goals

A common mistake when learning 8.4 is to reach for `readonly` *and* a set hook, or to treat a get-only virtual property as “immutable state.”

Rules I follow:

1. **Need custom set logic + restricted writers?** Use `public private(set)` (or `protected(set)`) **and** a `set` hook. The visibility blocks outsiders; the hook normalizes/validates when insiders write.
2. **Need one assignment forever?** Use `readonly`. Skip set hooks that pretend to mutate.
3. **Need a derived value?** Use a virtual `get` hook. Do not store a parallel `$label` field that drifts.

Trying to bolt a set hook onto a readonly property fights the language. Pick the lifetime model first, then the hook.

## Lazy objects awareness (PHP 8.4)

PHP 8.4 also ships **lazy objects** via Reflection: `ReflectionClass::newLazyGhost()` and `newLazyProxy()`. I mention them next to modeling because large graphs — think an order with line items, customer, and payment attempts — often get constructed eagerly in admin or report code paths that only needed the id and status.

A **lazy ghost** is an instance whose initializer runs on first property access. A **lazy proxy** wraps a real instance created later. Both can make “build the whole order graph” cheaper until something actually touches nested state.

I do not use lazy objects as a substitute for good aggregates. I use them when:

- Hydrating lists of orders for an index table where most rows never open line items.
- Building Laravel-side DTOs next to a WooCommerce export where full expansion is rare.

They are an awareness item for 8.4 architects: **cheaper graphs until first access**, not a license to hide broken constructors. If your initializer hits the database twenty times, laziness only delays the pain.

## Support reality as of 2026

Language features only help if your runtime will still be supported when the plugin ships.

As of September 2026:

- **PHP 8.2** reaches end of life on **31 December 2026**. New production work should not target 8.2 as the ceiling.
- **PHP 8.3** is in security-only territory for many hosts — fine for “still runs,” weak as a design target for greenfield domain code.
- **Design new work toward PHP 8.4 / 8.5** when your WordPress / WooCommerce / Laravel matrix allows it. Property hooks and asymmetric visibility are exactly the kind of features that make “upgrade the platform” a modeling win, not just a security chore.

PHP **8.5** brings things like the **pipe operator** and a dedicated **URI extension**. Know they exist; plan experiments. The depth of this article stays on **8.4 object modeling**, because that is what I am putting into entities and value objects today when the host stack clears 8.4.

In WordPress plugin land, “requires PHP” in the readme is a product decision. I still ship polyfills and older-safe code for wide distribution. For internal Laravel services beside WooCommerce — queues, reconciliation, report builders — I push the runtime forward so the domain model can use 8.4 honestly.

## Full worked example: an `Order` aggregate

Here is the shape I would put next to a WooCommerce order adapter or a Laravel domain entity that mirrors payment state. It is deliberately small: status transitions, email normalization, and a virtual label.

```php
<?php

declare(strict_types=1);

final class Order
{
    public private(set) string $status = 'pending';

    public string $email {
        set (string $value) {
            $normalized = strtolower(trim($value));
            if ($normalized === '') {
                throw new InvalidArgumentException('Order email cannot be empty.');
            }
            $this->email = $normalized;
        }
    }

    public string $label {
        get => "Order #{$this->id} ({$this->status})";
    }

    public function __construct(
        public readonly int $id,
        string $email,
    ) {
        $this->email = $email;
    }

    public function markPaid(): void
    {
        if ($this->status !== 'pending' && $this->status !== 'on-hold') {
            throw new LogicException(
                "Cannot mark paid from status {$this->status}."
            );
        }

        $this->status = 'paid';
    }

    public function markFailed(string $reason): void
    {
        if ($this->status === 'paid') {
            throw new LogicException('Paid orders cannot fail without a refund flow.');
        }

        $this->status = 'failed';
        // Persist $reason via domain event / logger in the application layer —
        // not inside a property hook.
    }
}
```

### What a caller can and cannot mutate

Assume `$order = new Order(1042, 'Customer@Shop.Example');`.

**Allowed outside the class:**

```php
echo $order->id;       // 1042 — readonly, readable
echo $order->status;   // pending — asymmetric, readable
echo $order->email;    // customer@shop.example — normalized on construct
echo $order->label;    // Order #1042 (pending) — virtual get

$order->email = 'Billing@Shop.Example'; // set hook runs → billing@shop.example
$order->markPaid();
echo $order->status;   // paid
echo $order->label;    // Order #1042 (paid)
```

**Rejected outside the class:**

```php
$order->status = 'paid';     // Error: cannot set private(set) status
$order->id = 99;             // Error: readonly
$order->label = 'x';         // Error: virtual property has no set hook / not writable
$order->email = '   ';       // InvalidArgumentException from the set hook
```

That split is the whole point. Templates and API resources **read**. Application services call **`markPaid()`** after the gateway confirms capture. Support scripts cannot “fix” status with a raw assignment unless they are refactored to go through the aggregate (which is what you want in code review).

### WooCommerce / Laravel grounding

On a WooCommerce shop I still persist through `wc_get_order()` / CRUD / HPOS-safe APIs. The `Order` class above is not a replacement for `WC_Order`. It is the **domain lens** I use when:

- A Laravel queue worker reconciles gateway webhooks and must not invent status strings.
- A plugin service layer needs an invariant before it calls `$wcOrder->update_status()`.
- I write unit tests for payment transitions without bootstrapping all of WordPress.

The adapter maps `paid` to the shop’s WooCommerce status dialect (`processing`, `completed`, or a custom paid status — whatever that merchant’s flow already uses). The aggregate owns the **decision**; WooCommerce owns the **persistence vocabulary**. Mixing those two concerns is how plugins end up with three different strings for “money received.”

In Laravel entities living beside WordPress, the same class can sit behind a repository that writes to MySQL. Asymmetric visibility still pays off: serializers and Filament-style admin tables read `$order->status` and `$order->label`, while only application actions call `markPaid()`.

## Interview soundbite, in practice

When someone asks how I would model an order on modern PHP, I do not recite a feature list. I say roughly this:

> In PHP 8.4 I'd model an Order with asymmetric visibility so status is public to read but only the aggregate can change it, and I'd use a property set hook for email normalization instead of a setter method...

Then I show `markPaid()` as the transition and the virtual `$label` as the thing templates bind to. That one paragraph tells an interviewer I care about **invariants**, not about chasing version numbers.

## How I adopt this without breaking old plugins

Wide WordPress distribution still means many hosts on 8.1–8.3. My practical split:

1. **Shared plugin code** that must run on older PHP keeps classic private properties and methods. No shame — shipping beats fashion.
2. **New internal services** (Laravel workers, CLI reconcilers, platform-specific packages with an 8.4 requirement) use hooks and asymmetric visibility from day one.
3. **Boundaries stay boring** — DTOs crossing the WordPress/Laravel fence remain simple arrays or readonly structs until both sides share a runtime story.

I also keep hooks boring in code review: if a set hook grows past validation/normalization, I extract a value object (`EmailAddress`) and let the property hold that type. Hooks are glue, not a second framework.

## Closing

PHP 8.4 object modeling is not about writing fewer lines for sport. It is about putting **read policy**, **write policy**, and **normalization** where the field lives, so WooCommerce payment status transitions and Laravel entities stop relying on tribal knowledge about which setter is “the real one.”

Use **asymmetric visibility** when outsiders may read but only the aggregate may write. Use **set hooks** when assignment should normalize or reject. Use **virtual gets** for labels and derived display strings. Keep **readonly** for true one-shot identity. Stay aware of **lazy objects** for expensive graphs. Aim new design at **8.4/8.5** while 8.2’s December 2026 EOL clock runs down.

The next order object I sketch starts with `public private(set) string $status` — and the set hook on email — because that is the shape that survives contact with real checkout, real webhooks, and real support pressure.
