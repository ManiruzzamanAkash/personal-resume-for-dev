---
title: "PHP value objects and enums: the money, status, and ID types I trust"
slug: php-value-objects-enums-money-ids-i-trust
date: 2026-10-13
category: Engineering
excerpt: "Most production bugs I have chased in PHP were not clever. They were a float pretending to be money, a string pretending to be a status, or an int that was the wrong kind of ID. Here is how I use readonly value objects and backed enums to make those bugs hard to write in the first place."
readTime: "12 min"
tags: [php, architecture, domain-modeling, enums, value-objects, laravel, testing]
---

# PHP value objects and enums: the money, status, and ID types I trust

If I look back at the production incidents I have helped debug in PHP codebases, very few of them were caused by hard problems. Almost none were about concurrency theory or a subtle framework bug. Most of them looked like this:

- A refund of `19.99` became `19.989999999999998` somewhere between a form request and a payment gateway call.
- An order was stuck because something wrote `'Completed'` into a column that every query checked against `'completed'`.
- A job deleted the wrong record because it received a `$customerId` where it expected a `$userId`, and both were just `int`.
- A price was stored in cents in one table and in major units in another, and a report added them together.

None of these are exotic. They are what happens when a codebase uses primitive types for domain concepts. `float`, `string`, and `int` are honest about what the computer stores. They say nothing about what the business means.

Modern PHP gives us very good tools to fix this. Readonly classes, constructor promotion, backed enums, first-class enum methods, and static analysis that actually understands them. In this post I want to show the small set of types I now reach for in almost every serious PHP or Laravel project, and the rules I follow so they help instead of becoming ceremony.

## The rule: primitives at the edges, types in the middle

The mental model I use is simple. HTTP requests, database rows, queue payloads, and API responses are made of primitives. That is fine. Those are the edges of the system.

Everything between the edges, the code that makes decisions, should work with types that carry meaning. A function that calculates a discount should accept `Money`, not `float $amount, string $currency`. A method that moves an order forward should accept an `OrderStatus`, not a string.

So the work is:

1. Convert primitives into domain types as early as possible on the way in.
2. Keep domain logic typed.
3. Convert back to primitives as late as possible on the way out.

When I follow that, most of the bugs above stop being possible to write without a type error or a failing static analysis check.

## Money: never a float

Money is the first value object I add to any project that charges anyone for anything. The rules are short:

- Store amounts as integers in the smallest unit (cents, poisha, pence).
- Always carry the currency with the amount.
- Refuse to do arithmetic across currencies.
- Make the object immutable, so every operation returns a new instance.

Here is the version I keep coming back to. It is small on purpose.

```php
<?php

declare(strict_types=1);

namespace App\Domain\Shared;

use InvalidArgumentException;

final readonly class Money
{
    private function __construct(
        public int $minor,
        public Currency $currency,
    ) {}

    public static function ofMinor(int $minor, Currency $currency): self
    {
        return new self($minor, $currency);
    }

    public static function zero(Currency $currency): self
    {
        return new self(0, $currency);
    }

    public function plus(Money $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->minor + $other->minor, $this->currency);
    }

    public function minus(Money $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->minor - $other->minor, $this->currency);
    }

    public function multiply(int $quantity): self
    {
        return new self($this->minor * $quantity, $this->currency);
    }

    public function isNegative(): bool
    {
        return $this->minor < 0;
    }

    public function equals(Money $other): bool
    {
        return $this->currency === $other->currency
            && $this->minor === $other->minor;
    }

    private function assertSameCurrency(Money $other): void
    {
        if ($this->currency !== $other->currency) {
            throw new InvalidArgumentException(sprintf(
                'Cannot combine %s with %s.',
                $this->currency->value,
                $other->currency->value,
            ));
        }
    }
}
```

A few choices here are deliberate.

The constructor is private. I want callers to say `Money::ofMinor(1999, Currency::USD)` so the unit is visible at the call site. If I later add `Money::fromDecimalString('19.99', Currency::USD)` for form input, that is a second named constructor, and nobody has to guess which unit a raw `new Money(1999, ...)` means.

There is no `divide` method. Division is where money gets interesting, because you lose cents. When a business needs to split an amount, I add an explicit `allocate(array $ratios): array` that distributes the remainder, instead of a `divide` that silently rounds.

```php
/** @return list<Money> */
public function allocate(int ...$ratios): array
{
    $total = array_sum($ratios);

    if ($total <= 0) {
        throw new InvalidArgumentException('Ratios must sum to a positive number.');
    }

    $remainder = $this->minor;
    $results = [];

    foreach ($ratios as $ratio) {
        $share = intdiv($this->minor * $ratio, $total);
        $results[] = $share;
        $remainder -= $share;
    }

    // Hand the leftover cents out one by one, starting from the first share.
    for ($i = 0; $remainder > 0; $i++, $remainder--) {
        $results[$i % count($results)]++;
    }

    return array_map(fn (int $minor) => new self($minor, $this->currency), $results);
}
```

Splitting `10.00` three ways gives `3.34`, `3.33`, `3.33`, and the parts always add back up to the original. That single property has saved me from more accounting arguments than any test suite.

### Currency as a backed enum

The currency is an enum, not a string. That gives me a closed set of supported currencies and a place to put currency facts.

```php
enum Currency: string
{
    case USD = 'USD';
    case EUR = 'EUR';
    case BDT = 'BDT';

    public function decimals(): int
    {
        return match ($this) {
            self::USD, self::EUR, self::BDT => 2,
        };
    }
}
```

The `match` without a `default` is intentional. If someone adds `JPY` later, static analysis tells them `decimals()` does not handle it. That is exactly the conversation I want to force.

If you work with many currencies, use a mature library like `brick/money` or `moneyphp/money` instead of growing your own. My own class is fine for products that support a handful of currencies and want zero dependencies in the domain layer. The rules matter more than the implementation.

## Status: a backed enum with behavior

Strings for status are the second thing I remove. A `status` column with free text is a bug factory. A backed enum turns it into a closed set with a single source of truth.

The part people often skip is putting behavior on the enum. An order status is not just a label. It knows which statuses can follow it.

```php
enum OrderStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Fulfilled = 'fulfilled';
    case Cancelled = 'cancelled';
    case Refunded = 'refunded';

    /** @return list<self> */
    public function allowedNext(): array
    {
        return match ($this) {
            self::Pending => [self::Paid, self::Cancelled],
            self::Paid => [self::Fulfilled, self::Refunded],
            self::Fulfilled => [self::Refunded],
            self::Cancelled, self::Refunded => [],
        };
    }

    public function canMoveTo(self $next): bool
    {
        return in_array($next, $this->allowedNext(), true);
    }

    public function isFinal(): bool
    {
        return $this->allowedNext() === [];
    }

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Awaiting payment',
            self::Paid => 'Paid',
            self::Fulfilled => 'Fulfilled',
            self::Cancelled => 'Cancelled',
            self::Refunded => 'Refunded',
        };
    }
}
```

Now the transition rule lives in one place. The model or service that changes status uses it:

```php
final class Order
{
    public function transitionTo(OrderStatus $next): void
    {
        if (! $this->status->canMoveTo($next)) {
            throw InvalidOrderTransition::from($this->status, $next);
        }

        $this->status = $next;
    }
}
```

I have seen teams reach for a full state machine package at this point. Sometimes that is right, especially when transitions need guards, side effects, and audit logs. But for most order, subscription, and ticket flows, an enum with `allowedNext()` plus one guarded method covers ninety percent of the value with almost no new concepts.

### Do not let enums leak into storage decisions by accident

Two rules I follow with backed enums and the database:

1. **The backing value is a contract.** Once `'paid'` is in a production table, renaming the case is fine, but changing the value is a data migration. I treat backing values like column names.
2. **Store the value, not the name.** `OrderStatus::Paid->value` is `'paid'`. `OrderStatus::Paid->name` is `'Paid'`. Mixing them is exactly how the `'Completed'` versus `'completed'` bug happens.

Use `tryFrom` at the edges, where input might be garbage, and `from` inside the system, where a bad value means a real bug:

```php
// At the edge: user input, webhooks, query strings.
$status = OrderStatus::tryFrom($request->string('status')->toString())
    ?? throw ValidationException::withMessages(['status' => 'Unknown status.']);

// Inside: a value we wrote ourselves should always be valid.
$status = OrderStatus::from($row->status);
```

## IDs: stop passing bare integers

This is the one that feels like overkill until it saves you. If a method signature is `refund(int $orderId, int $userId, int $amount)`, nothing stops a caller from swapping two arguments. PHP will happily run it. Your tests might even pass if the fixture IDs happen to collide.

Typed IDs make the signature honest:

```php
final readonly class OrderId
{
    public function __construct(public int $value)
    {
        if ($value <= 0) {
            throw new InvalidArgumentException('OrderId must be positive.');
        }
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return (string) $this->value;
    }
}
```

```php
public function refund(OrderId $orderId, UserId $actor, Money $amount): Refund
```

Now `refund($userId, $orderId, ...)` is a type error, caught before it ever runs.

I do not wrap every ID in every project. My rule is: typed IDs for the core aggregates that money, permissions, or deletions depend on. Orders, customers, accounts, subscriptions. A lookup table for countries does not need one.

If you use UUIDs or ULIDs, the same class pattern works with a `string $value` and validation in the constructor. Typed IDs also make it painless to migrate an aggregate from auto-increment to ULID later, because the change is contained in one class and its casts.

## Wiring it into Laravel without fighting the framework

The usual objection I hear is that Laravel models are built around primitives, so value objects will be awkward. In practice, Eloquent casts make this clean.

Enums need no work at all:

```php
protected function casts(): array
{
    return [
        'status' => OrderStatus::class,
        'currency' => Currency::class,
    ];
}
```

For `Money`, which spans two columns, I write a small custom cast:

```php
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/** @implements CastsAttributes<Money, Money> */
final class MoneyCast implements CastsAttributes
{
    public function __construct(
        private string $amountColumn = 'total_minor',
        private string $currencyColumn = 'currency',
    ) {}

    public function get(Model $model, string $key, mixed $value, array $attributes): ?Money
    {
        if ($attributes[$this->amountColumn] === null) {
            return null;
        }

        return Money::ofMinor(
            (int) $attributes[$this->amountColumn],
            Currency::from($attributes[$this->currencyColumn]),
        );
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): array
    {
        if (! $value instanceof Money) {
            throw new InvalidArgumentException('Expected Money.');
        }

        return [
            $this->amountColumn => $value->minor,
            $this->currencyColumn => $value->currency->value,
        ];
    }
}
```

```php
protected function casts(): array
{
    return [
        'total' => MoneyCast::class.':total_minor,currency',
        'status' => OrderStatus::class,
    ];
}
```

Now `$order->total` is a `Money`, `$order->total->plus($shipping)` works, and nobody in the codebase ever sees a raw cents integer unless they go looking for it.

Typed IDs follow the same pattern with a one-column cast. I usually expose them through an accessor like `$order->orderId()` rather than overriding the primary key itself, because a lot of framework internals expect `$model->id` to stay a primitive. That is a pragmatic line, not a purity line, and I am comfortable with it.

### Form requests: convert at the edge

Validation is the edge on the way in. I like form requests that return typed values, so controllers never touch raw input:

```php
final class RefundOrderRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'min:1'],
            'reason' => ['required', Rule::enum(RefundReason::class)],
        ];
    }

    public function amount(Order $order): Money
    {
        return Money::ofMinor($this->integer('amount'), $order->currency);
    }

    public function reason(): RefundReason
    {
        return $this->enum('reason', RefundReason::class);
    }
}
```

The controller becomes boring, which is what I want:

```php
public function __invoke(RefundOrderRequest $request, Order $order, RefundOrder $action)
{
    $refund = $action->handle(
        $order,
        $request->amount($order),
        $request->reason(),
        $request->user(),
    );

    return RefundResource::make($refund);
}
```

### API resources: convert at the edge on the way out

On the way out, I keep the JSON shape explicit. I never serialize a value object by accident through `toArray()` magic, because then the public API shape depends on private class layout.

```php
'total' => [
    'amount_minor' => $this->total->minor,
    'currency' => $this->total->currency->value,
],
'status' => [
    'value' => $this->status->value,
    'label' => $this->status->label(),
],
```

Clients get stable primitives. The domain stays typed. Each side can change without breaking the other.

## Queues and serialization: the trap nobody warns you about

Value objects in queued jobs need one bit of care. Laravel serializes job properties. Readonly objects with only scalar and enum properties serialize fine. But if a value object holds a reference to something heavy, or its class is renamed between deploy and job execution, jobs fail in confusing ways.

My rules for job payloads:

- Pass typed IDs and small value objects, not models with loaded relations.
- Keep value object properties to scalars and enums so serialization is predictable.
- Treat a rename of a value object class like a breaking change for in-flight jobs. Deploy the alias first, drain the queue, then remove the old name.

That last point is the same discipline I use for event and job class renames in general. Queues remember your old code longer than you do.

## Testing: value objects are the cheapest tests you will write

One quiet benefit of this style is how easy it is to test. Value objects have no dependencies. Their tests run in milliseconds and read like specifications.

```php
it('allocates without losing cents', function () {
    $parts = Money::ofMinor(1000, Currency::USD)->allocate(1, 1, 1);

    expect(array_map(fn (Money $m) => $m->minor, $parts))->toBe([334, 333, 333]);
});

it('refuses to add different currencies', function () {
    Money::ofMinor(100, Currency::USD)->plus(Money::ofMinor(100, Currency::EUR));
})->throws(InvalidArgumentException::class);

it('does not allow refunds before payment', function () {
    expect(OrderStatus::Pending->canMoveTo(OrderStatus::Refunded))->toBeFalse();
});
```

I also like a simple dataset test that walks every enum case, so adding a case without thinking about its transitions fails loudly:

```php
it('defines transitions for every status', function (OrderStatus $status) {
    expect($status->allowedNext())->toBeArray();
    expect($status->label())->not->toBeEmpty();
})->with(OrderStatus::cases());
```

Combined with PHPStan or Psalm at a decent level, these types give you a lot of safety for very little code. Static analysis understands enums, readonly properties, and exhaustive `match` well now. That is what makes this approach practical in 2026 in a way it was not in the PHP 7 days.

## Where I stop

Value objects are easy to overdo. I have seen codebases with an `EmailAddress`, `FirstName`, `LastName`, `PhoneNumber`, `StreetLine1`, and `StreetLine2` class for a contact form that sends one email. That is not safety. That is a tax.

My filter for whether a concept deserves its own type:

1. **Does a wrong value cost money, data, or trust?** Money, IDs of core aggregates, and statuses that gate actions usually pass.
2. **Does it have rules?** If there is validation, normalization, or arithmetic, a type gives those rules a home.
3. **Is it easy to confuse with something else of the same primitive type?** Two `int` IDs side by side, or two currency amounts in different units.
4. **Does it show up across many files?** A concept used in one form does not need a class.

If a concept passes two of those four, I give it a type. If it passes none, it stays a string, and that is fine.

## How I introduce this into an existing codebase

You rarely get to start greenfield. On existing Laravel and PHP projects, I introduce these types gradually, in roughly this order:

1. **Enums for status columns first.** Add the enum, add the cast, keep the column values unchanged. This is close to zero risk and removes a whole class of string bugs immediately.
2. **Money at the payment boundary.** Start where the risk is highest, usually checkout, refunds, and invoices. Convert at the edges of that module only.
3. **Typed IDs on the scariest methods.** Anything that deletes, refunds, or changes permissions gets typed IDs in its signature.
4. **Raise static analysis one level.** Once the types exist, a stricter PHPStan level actually starts finding real bugs instead of noise.

Each step is a small, reviewable PR. None of them requires a big rewrite. When I help teams modernize older PHP products through [SquartUp](https://squartup.com), this sequence is one of the first things I suggest, because it pays off within weeks and does not stop feature work.

## A quick checklist

Before I approve a PR that touches money, status, or core IDs, I ask:

1. Is any amount of money a `float` anywhere in this change?
2. Does every amount carry its currency?
3. Are status values coming from an enum, with transitions checked in one place?
4. Are raw strings and ints converted to domain types at the edge, not deep in the logic?
5. Could two arguments of the same primitive type be swapped silently?
6. Is the JSON shape on the way out explicit, rather than leaked from a class?
7. Will in-flight queued jobs still deserialize after this deploy?
8. Is there a fast unit test for each new rule on these types?

## Final verdict

The most valuable architecture work I do in PHP is not about layers, patterns, or folder names. It is about making the obvious bugs impossible to write. A `Money` class that refuses floats and mixed currencies, a status enum that knows its own transitions, and typed IDs on the methods that can hurt you cover a surprising share of real production incidents.

Modern PHP makes this cheap. Readonly classes, backed enums, exhaustive `match`, Eloquent casts, and solid static analysis turn what used to be ceremony into a few small files. Keep primitives at the edges, keep meaning in the middle, and stop where the types stop paying for themselves. Your future self, reading a stack trace at midnight, will be grateful the compiler caught it first.
