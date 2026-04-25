---
title: "SOLID principles for WordPress plugins (without the dogma)"
slug: solid-principles-for-wordpress-plugins
date: 2026-04-10
category: Architecture
excerpt: A practical, opinionated take on applying SOLID to real WordPress codebases — where it helps, where it hurts, and where it's just CS-class noise.
readTime: 12 min
tags: [wordpress, architecture, solid, php]
---

# SOLID principles for WordPress plugins (without the dogma)

Every couple of years, someone publishes a post titled "SOLID for WordPress" and the responses split into two camps. Camp one: "Finally, real engineering coming to WP." Camp two: "WordPress is procedural and you're overcomplicating things."

Both are wrong, and both are right.

After seven years of writing plugins — including some that grew to six-figure install counts — here's my honest take on which SOLID principles actually pull weight in WordPress, and which ones are theater.

## A quick refresher

SOLID is five principles, named by Robert C. Martin:

1. **S**ingle Responsibility Principle
2. **O**pen/Closed Principle
3. **L**iskov Substitution Principle
4. **I**nterface Segregation Principle
5. **D**ependency Inversion Principle

I'll go through each one with the question: *does this actually make my plugin better?*

## S — Single Responsibility (yes, always)

This one earns its keep. A class should have one reason to change.

```php
// Bad — this class does five things:
class Order {
    public function calculate_total() { /* ... */ }
    public function send_receipt_email() { /* ... */ }
    public function update_inventory() { /* ... */ }
    public function notify_admin() { /* ... */ }
    public function save() { /* ... */ }
}

// Good — each concern has its own home:
class OrderTotals { /* ... */ }
class OrderEmails { /* ... */ }
class InventoryUpdater { /* ... */ }
class AdminNotifier { /* ... */ }
class OrderRepository { /* ... */ }
```

The win isn't elegance. The win is that **when emails break, you only touch the email class**. When inventory changes, you only touch inventory. The blast radius of any change shrinks dramatically.

**Verdict: keep it. Always.**

## O — Open/Closed (sometimes)

The classic phrasing — "open for extension, closed for modification" — is overstated. In WordPress, you usually *want* to modify code as requirements change, and the plugin update mechanism handles it fine.

But there's a useful distillation: **extend behavior through composition, not by editing existing classes**.

WordPress already gives you this for free with `apply_filters` and `do_action`. You don't need fancy abstract classes. You just need to recognize the moments where something is likely to need extension and add a hook.

```php
public function calculate_tax( $amount ) {
    return apply_filters( 'myplugin_tax_amount', $amount * 0.1, $amount );
}
```

**Verdict: use the WordPress-native version (filters/actions). Don't import enterprise patterns wholesale.**

## L — Liskov Substitution (rarely matters)

Liskov says: subclasses should be substitutable for their base classes without breaking expectations.

In practice, in plugin code, you almost never have deep inheritance trees. If you do, that's the bug. Composition beats inheritance in 95% of cases.

**Verdict: mostly irrelevant. If you find yourself thinking about it, you've probably already over-engineered something.**

## I — Interface Segregation (occasionally)

"Don't force clients to depend on interfaces they don't use."

This matters when you're designing public extension points. If your plugin exposes an API for other developers, give them small, focused interfaces:

```php
// Bad — one fat interface:
interface PaymentGateway {
    public function charge();
    public function refund();
    public function subscribe();
    public function generate_invoice();
    public function send_dunning_email();
}

// Better — split by capability:
interface ChargesPayments { public function charge(); }
interface IssuesRefunds { public function refund(); }
interface ManagesSubscriptions { public function subscribe(); }
```

Now a gateway that only does one-time payments doesn't have to lie about implementing subscriptions.

**Verdict: useful when designing extension APIs. Skip for internal code.**

## D — Dependency Inversion (this is the big one)

Depend on abstractions, not concretions. Out of the five, this is the one that has the biggest payoff in WordPress.

The single biggest pain in legacy plugin code: every class instantiates its own dependencies. `new Logger()` everywhere. `Database::instance()` everywhere. Globals leaking through `$wpdb`. The result: nothing is testable, nothing is swappable, everything is glued together.

Inverting it:

```php
// Bad — hard-coded dependency:
class CheckoutHandler {
    public function process( $cart ) {
        $logger = new FileLogger();
        $logger->log( "checkout started" );
        // ...
    }
}

// Good — injected dependency:
class CheckoutHandler {
    public function __construct( private Logger $logger ) {}

    public function process( $cart ) {
        $this->logger->log( "checkout started" );
        // ...
    }
}
```

Now in tests you swap in a mock logger. In production you swap in Sentry. The class doesn't know or care.

A lightweight container (or even a manual factory) is enough — you don't need PHP-DI or anything fancy.

**Verdict: this one is non-negotiable for any plugin you want to test or evolve.**

## What about WordPress itself?

WordPress core is procedural. You can't make `wp_insert_post` accept a service. That's fine. The pattern that works: **wrap the WordPress globals at your plugin's edge, then write the rest of your code against your own abstractions.**

```php
class PostRepository {
    public function find( int $id ): ?Post {
        $wp_post = get_post( $id );
        return $wp_post ? Post::from_wp_post( $wp_post ) : null;
    }
}
```

Inside `PostRepository`, talk to WordPress. Outside it, talk to `Post` objects. This single boundary makes everything else testable.

## The honest summary

If you only take three things from this:

1. **One class, one job.** This is the highest-leverage habit you can build.
2. **Inject dependencies.** Future-you will thank present-you the first time you have to write a test.
3. **Wrap WordPress at the edges.** Don't let `$wpdb` and `get_post` infect your business logic.

Everything else is nice-to-have. SOLID is a tool, not a religion. The goal is plugins that survive their own success.

---

*Got a plugin codebase you want a second opinion on? I do architecture reviews — [send me a note](mailto:manirujjamanakash@gmail.com).*
