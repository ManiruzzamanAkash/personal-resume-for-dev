---
title: "PHP 8.6: partial application, Duration, and the deprecations that prepare PHP 9"
slug: php-86-partial-application-deprecations
date: 2026-09-19
category: Engineering
excerpt: "PHP 8.6 is a small surface release with a heavy deprecation map toward PHP 9 — Partial Function Application, Duration, clamp(), session default flips, and the cleanup checklist I use for WordPress and Laravel plugins."
readTime: 16 min
tags: [php, php-86, partial-function-application, deprecations, laravel, wordpress, woocommerce, migration]
---

# PHP 8.6: partial application, Duration, and the deprecations that prepare PHP 9

I ship WordPress plugins, WooCommerce gateways, and Laravel companions for a living. Major PHP releases usually arrive as a story I tell clients in two sentences: “here is the shiny feature,” then “here is what will break you next year.” **PHP 8.6** (GA targeted around **19 November 2026**) is different. It is not a reshape release the way property hooks defined 8.4, or the way the pipe operator alone reshaped how I write transformation pipelines in 8.5. The feature surface is intentionally small. The deprecation map toward **PHP 9** is not.

That is the mental model I want for this release: **an easy afternoon to upgrade the runtime**, and a deliberate quarter to clean deprecations so PHP 9 is boring instead of a fire drill. The interactive panel above walks Features, Deprecations, and Session defaults, then steps a Partial Function Application (PFA) slug pipeline the same way I would refactor a plugin helper.

## What kind of release is 8.6?

When I compare minor versions for plugin support matrices, I look at two axes:

1. **New ergonomics** — can I delete ceremony in new code?
2. **Future breakage foreshadowed** — what becomes a warning now and a fatal later?

8.4 was mostly axis 1 (property hooks, asymmetric visibility). 8.5 leaned on axis 1 again with pipe. **8.6 still has a headline feature — Partial Function Application — but axis 2 is the real product work.** Session defaults flip quietly. The Oniguruma-backed `mb_ereg` family starts its walk toward removal. Returning from `__construct` / `__destruct` or from `finally` starts warning. Aliases like `is_double` / `is_long` and `spl_object_hash` get marked for the exit.

If you only remember one sentence from this article: **bumping to 8.6 is cheap; ignoring the deprecation stream is how PHP 9 becomes expensive.**

<figure class="php86-inline-flow" role="img" aria-label="PHP 8.4 and 8.5 reshaped APIs; 8.6 is a small feature surface with a heavy deprecation map toward PHP 9.">
  <div class="php86-inline-flow-row">
    <span class="php86-inline-pill">8.4 hooks / visibility</span>
    <span class="php86-inline-arrow" aria-hidden="true">→</span>
    <span class="php86-inline-pill">8.5 pipe</span>
    <span class="php86-inline-arrow" aria-hidden="true">→</span>
    <span class="php86-inline-pill php86-inline-pill--accent">8.6 PFA + deprecations</span>
    <span class="php86-inline-arrow" aria-hidden="true">→</span>
    <span class="php86-inline-pill php86-inline-pill--warn">PHP 9 removals</span>
  </div>
  <figcaption>Small release surface. Heavy prep work. Removals land in the next major.</figcaption>
</figure>

## Partial Function Application — the ergonomic win

Partial Function Application (PFA) lets me call a function with **some** arguments filled and get back a `Closure` for the rest. Placeholders are:

- **`?`** — exactly one argument still needed at this position
- **`...`** — zero or more remaining arguments (or a thunk when everything is already filled)

The classic pain this deletes is the arrow-function tax around `array_map`, `array_filter`, and pipe stages:

```php
// Before — arrow boilerplate I type a dozen times a week
$result = array_map(
    static fn (string $s): string => str_replace(' ', '-', $s),
    $titles
);

// After — partial application
$result = array_map(str_replace(' ', '-', ?), $titles);
```

With the **pipe operator** from 8.5, PFA becomes the natural right-hand side for unary stages:

```php
$slug = $rawTitle
    |> trim(?)
    |> strtolower(?)
    |> str_replace(' ', '-', ?)
    |> preg_replace('/[^a-z0-9-]+/', '', ?);
```

That is the same pipeline I used to write as nested calls or a chain of `fn ($x) => …` wrappers. Reviewers can read left-to-right. Static analysis still sees real parameter and return types on the generated closure — PFA inherits name, type, optionality, defaults, by-ref, and a couple of runtime-relevant attributes from the underlying callable.

### Eager evaluation vs arrow functions

One subtlety I call out in code review: **filled arguments evaluate when the partial is created**, not when it is later invoked. Arrow functions delay the body.

```php
function speak(string $who, string $msg): void
{
    printf("%s: %s\n", $who, $msg);
}

function getArg(): string
{
    echo "getArg\n";
    return 'hi';
}

$arrow = static fn (string $who): void => speak($who, getArg());
echo "Arnaud\n";
$arrow('Larry');
// Prints: Arnaud, then getArg, then Larry: hi

$partial = speak(?, getArg());
echo "Arnaud\n";
$partial('Larry');
// Prints: getArg first (at partial creation), then Arnaud, then Larry: hi
```

If `getArg()` hits the database or reads request state, that difference matters. Prefer PFA when the filled values are cheap and stable; prefer an arrow when you need lazy evaluation.

### What you cannot partial

Constructors are intentionally out: **`new Foo(?)` is a compile error** (“Cannot create Closure for new expression”). Static factories are fine:

```php
class OrderId
{
    public function __construct(private int $value) {}

    public static function fromInt(int $value): self
    {
        return new self($value);
    }
}

$maker = OrderId::fromInt(?); // OK
$orderId = $maker(42);

// $broken = new OrderId(?); // Fatal: cannot partial `new`
```

A few context-bound builtins (`compact`, `extract`, `func_get_args`, …) stay incompatible, same family as first-class callables.

### Optional parameters and `?`

Placeholder rules around optionals are easy to get wrong. Roughly:

- If you **omit** an optional by using fewer placeholders than parameters, the underlying default still applies when the partial eventually runs.
- If you **place `?` on an optional** (especially when placeholders run into a variadic tail), that slot becomes **required** on the resulting closure — you asked for a hole, so the engine expects you to fill it later.

```php
function stuff(int $a, int $b = 1, string ...$rest): void {}

$needsFour = stuff(?, ?, ?, ?);
// $a and $b become required; last two map into the variadic as concrete params

$keepDefaultB = stuff(?, ...);
// $b stays optional with default 1
```

Also watch callbacks that pass **extra** arguments. `array_find`-style APIs pass value *and* key. A partial like `intval(?)` (no `...`) ignores extras safely. `intval(...)` exposes the optional `$base` and can silently treat an array key as a base. Prefer the precise `?` form for callbacks unless you truly want passthrough.

## Small stdlib improvements that still matter

PFA is the headline. The rest of the additions are the kind of stdlib polish that removes one-off helpers from plugin codebases.

### `clamp()`

```php
$qty = clamp($requestedQty, 1, $stock);
$opacity = clamp($opacity, 0.0, 1.0);
```

I used to write `max($min, min($max, $value))` and hope the argument order stayed memorable under review. `clamp($value, $min, $max)` is the shape I want in cart quantity guards and admin UI sliders.

### `SortDirection` enum

```php
enum SortDirection
{
    case Ascending;
    case Descending;
}

// Prefer the enum at API boundaries instead of magic SORT_ASC / SORT_DESC ints
usort($rows, static function (array $a, array $b) use ($direction): int {
    $cmp = $a['total'] <=> $b['total'];
    return $direction === SortDirection::Descending ? -$cmp : $cmp;
});
```

### `Time\Duration` (typed duration vs raw ints)

When I cover Duration at all, I treat it as **stdlib honesty**: stop smuggling “milliseconds as int” through five layers of a queue job. A typed duration is harder to confuse with a Unix timestamp or a retry count.

```php
use Time\Duration;

$timeout = Duration::fromSeconds(2);
// Io\Poll and similar APIs can take Duration instead of ambiguous int milliseconds
```

I am not rewriting every `sleep(1)` tomorrow. I am using Duration at **new** boundaries — poll waits, HTTP client timeouts in Laravel services beside WordPress, anything where “was that seconds or ms?” has already bitten me in staging.

### `#[\Override]` on constants and enum cases

`#[\Override]` already helped methods. Extending it to **class constants and enum cases** catches the silent rename when a parent constant disappears or changes meaning:

```php
abstract class GatewayStatus
{
    public const PENDING = 'pending';
    public const PAID = 'paid';
}

final class PayseraStatus extends GatewayStatus
{
    #[\Override]
    public const PENDING = 'pending';

    #[\Override]
    public const PAID = 'paid';
}
```

Same idea for enum cases that must stay aligned with a parent or interface contract as those land in your codebase.

### Debuggable enums, `error_include_args`, `grapheme_strrev`, `Io\Poll`

A few more notes I keep on the 8.6 card:

- **Enums and `__debugInfo`** — better `var_dump` / debugger output when an enum carries meaningful state for support tooling.
- **`error_include_args`** — when enabled, error messages can include argument values (off by default for safety; turn on in controlled staging, not casually on shared hosts that log to world-readable files).
- **`grapheme_strrev()`** — reverse text by grapheme cluster so emoji and composed characters survive. Prefer it over `strrev()` anywhere you touch merchant-facing names.
- **`Io\Poll`** — a modern polling API (epoll / WSAPoll territory) as an alternative to wrestling `stream_select()` for non-blocking IO in long-running Laravel workers. Brief mention is enough for most WordPress plugin engineers; reach for it when you own the process model.

### `json_decode` location in errors

Failed `json_decode` messages getting **location context** (where in the payload things went wrong) sounds small until you have chased a corrupt WooCommerce REST payload at 2 a.m. Anything that shortens “invalid JSON” into “near offset / path X” belongs in the upgrade notes I paste into a release PR.

## Session defaults — the silent breakage risk

This is the change I put at the top of every 8.6 upgrade checklist for shops with **SSO, embedded admin, or payment callbacks**:

| Directive | Old default | 8.6 default |
| --- | --- | --- |
| `session.use_strict_mode` | `0` | `1` |
| `session.cookie_httponly` | `0` | `1` |
| `session.cookie_samesite` | (empty) | `Lax` |

Nothing throws. Users simply **stop staying logged in** on certain cross-site flows, or JavaScript that read the session cookie via `document.cookie` quietly fails.

<figure class="php86-inline-flow" role="img" aria-label="Session cookie with SameSite Lax blocks cross-site POST callbacks from carrying the session.">
  <div class="php86-inline-flow-col">
    <span class="php86-inline-pill">Browser POST from payment / SSO</span>
    <span class="php86-inline-arrow php86-inline-arrow--down" aria-hidden="true">↓</span>
    <span class="php86-inline-pill php86-inline-pill--warn">SameSite=Lax (new default)</span>
    <span class="php86-inline-arrow php86-inline-arrow--down" aria-hidden="true">↓</span>
    <span class="php86-inline-pill">Session cookie often omitted on cross-site POST</span>
  </div>
  <figcaption>Payment return URLs and older SSO POSTs are the usual casualties — test them on staging with 8.6 defaults.</figcaption>
</figure>

Practical guidance I give teams:

- **`use_strict_mode=1`** — rejects uninitialized session IDs (session fixation hardening). Custom handlers should implement `validateId()` / `create_sid()` or consciously set the ini back to `0` with a documented reason.
- **`cookie_httponly=1`** — session cookie leaves the JS surface. If something read it from the browser, move that concern to a dedicated CSRF token cookie.
- **`cookie_samesite=Lax`** — cross-site POSTs will not send the session cookie. Payment gateways and SSO that rely on session continuity across a cross-site POST need `SameSite=None; Secure` **explicitly**, plus a threat model that accepts that choice.

WordPress itself leans on cookies heavily; plugin authors who open their own `session_start()` (rare but real in legacy bridges) must re-test. Laravel apps should confirm `config/session.php` already expresses the intended SameSite / http_only values so a php.ini default change does not surprise production.

## Deprecations — the real PHP 9 prep

I treat 8.6 deprecations as a **migration backlog**, not noise. Warnings today are removals in PHP 9.

### `mb_ereg` family (Oniguruma unmaintained)

The multibyte regex functions backed by **Oniguruma** are deprecated because the upstream library is unmaintained. Plan on **removal in PHP 9**. The migration path I use in plugins is PCRE with the `u` modifier, or a dedicated extension only if you truly need Oniguruma semantics.

```php
// Before (deprecated in 8.6 → gone in 9)
if (mb_ereg('^[[:alnum:]]+$', $sku)) {
    // ...
}

// After
if (preg_match('/^[\p{L}\p{N}]+$/u', $sku) === 1) {
    // ...
}
```

Search the codebase for `mb_ereg`, `mb_eregi`, `mb_ereg_replace`, `mb_split`, and the search-state cousins. In WooCommerce-adjacent code this often hides in SKU validators and “friendly” slug repair utilities.

### Return from `__construct` / `__destruct`, and return from `finally`

```php
class LegacyService
{
    public function __construct()
    {
        // Deprecated: returning a value from constructors / destructors
        return false;
    }
}

function writeWithCleanup(callable $write): void
{
    try {
        $write();
    } finally {
        // Deprecated: returning from finally (control-flow footgun)
        return;
    }
}
```

Constructors should establish invariants or throw. Destructors should not return meaningful values. `finally` should clean up — use control flow outside it.

### Aliases and identity helpers

| Deprecated direction | Prefer |
| --- | --- |
| `is_double()`, `is_long()`, `is_integer()`, `doubleval()` | `is_float()`, `is_int()`, `floatval()` |
| `spl_object_hash()` | `spl_object_id()` when you need an identity key for the request |
| Other aliases / niche helpers (`metaphone`, `strcoll`, `SORT_LOCALE_STRING`, …) | Modern Intl / explicit APIs |

`spl_object_hash()` → `spl_object_id()` shows up in object maps and WeakMap-adjacent caching inside plugins. Updating is usually mechanical; do it while 8.6 only warns.

### Why the upgrade still feels “easy”

None of the above is a hard break on day one. **8.6 does not remove the big surfaces** — it marks them. That is why I tell clients the runtime bump can be an afternoon (CI image, `composer` platform php, smoke tests), while **deprecation cleanup is the PHP 9 project**. Mix those two timelines and people either fear 8.6 unnecessarily or sleepwalk into 9.

## Before / after — a plugin-shaped PFA refactor

Here is the kind of helper I still find in WordPress and Laravel codebases: map a list of product titles into URL slugs.

```php
// Before
function slugify_many(array $titles): array
{
    return array_map(
        static function (string $title): string {
            $title = trim($title);
            $title = strtolower($title);
            $title = str_replace([' ', '_'], '-', $title);
            return preg_replace('/[^a-z0-9-]+/', '', $title) ?? '';
        },
        $titles
    );
}
```

```php
// After — pipe + PFA (8.5 + 8.6)
function slugify(string $title): string
{
    return $title
        |> trim(?)
        |> strtolower(?)
        |> str_replace([' ', '_'], '-', ?)
        |> (preg_replace('/[^a-z0-9-]+/', '', ?) ?? '');
}

function slugify_many(array $titles): array
{
    return array_map(slugify(...), $titles);
}
```

Same behavior, less nesting, clearer stages. The interactive stepper above animates that transformation — wrapper closure → partial → pipe stages — so you can pause on each form.

## Migration checklist for WordPress / Laravel plugin engineers

This is the checklist I actually paste into upgrade tickets:

1. **Raise CI to 8.6** (or the current RC if you are early) alongside 8.4/8.5 matrix jobs. Do not drop older minors your customers still need until your support policy says so.
2. **Run the test suite with deprecations promoted** — in PHPUnit, fail on warnings where you can; in WordPress, log `E_DEPRECATED` during smoke runs on staging.
3. **Grep for mbregex** — `mb_ereg`, `mb_eregi`, `mb_split`, replace callbacks; migrate to `preg_*` + `/u`.
4. **Grep constructor / destructor returns** and **`return` inside `finally`**.
5. **Replace aliases** — `is_double` / `is_long` / `is_integer` / `doubleval` / `spl_object_hash`.
6. **Audit session usage** — any `session_start`, custom save handlers, JS reading session cookies, payment or SSO cross-site POSTs. Set SameSite / httponly / strict mode **explicitly** in code or ini so defaults cannot surprise you.
7. **Re-test payment return URLs and SSO** on a staging host that uses 8.6 session defaults without your old overrides.
8. **Adopt PFA in new code only** first — `array_map(strtoupper(...), $x)` style call sites, pipe stages. Do not mass-rewrite stable plugins in the same PR as the runtime bump.
9. **Try `clamp()` and Duration at new boundaries** — quantity guards, timeouts — without boiling the ocean.
10. **Track JSON error improvements and `error_include_args`** for staging diagnostics; keep argument echoing off by default in production logs that might leave the box.
11. **Document PHP 9 removals** on the team wiki: mbregex gone, deprecated aliases gone, constructor return discipline enforced. 8.6 is the warning shot.

## How I am adopting it in real projects

My rule for client plugins mirrors how I adopted property hooks: **new modules and greenfield Laravel services get the new idiom; legacy stable code gets deprecation fixes only.** Merchants do not pay me to rewrite a working checkout for prettier callables. They do pay me when a PHP 9 deadline lands and `mb_ereg` becomes a white screen of death.

So the adoption order is:

1. CI + staging on 8.6.
2. Deprecation burn-down (especially mbregex + session semantics).
3. PFA and pipe in new helpers.
4. Duration / Poll only where we own long-running processes.

That order keeps the “small release” honest. You feel the productivity win without gambling the catalog.

## Closing

PHP 8.6 will not redefine how I model an `Order` aggregate — 8.4 already did that work. It will not be the first time I write a left-to-right transform — 8.5’s pipe already shipped. What 8.6 gives me is **Partial Function Application** to make those pipes and callbacks short, a handful of stdlib fixes (`clamp`, `SortDirection`, Duration, better errors), and a **deprecation map that is really a PHP 9 preview**.

Upgrade the runtime when your matrix allows. Schedule the cleanup like a product milestone. And for anything that touches sessions or payment callbacks, treat the new defaults as a feature you must opt into consciously — not a surprise you discover from “users keep getting logged out after pay.”

If you maintain WordPress or Laravel plugins and want a second set of eyes on an 8.6 / PHP 9 readiness pass, that is exactly the kind of boring, high-leverage review I like to do.
