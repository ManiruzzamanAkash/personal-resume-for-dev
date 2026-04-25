---
title: "From 1K to 100K installs: lessons from scaling SureCart"
slug: scaling-surecart-from-1k-to-100k
date: 2026-04-18
category: Engineering
excerpt: What actually changes when a WordPress plugin goes from a few thousand installs to six figures — and what I'd do differently if I started over.
readTime: 8 min
tags: [wordpress, scale, surecart, engineering]
---

# From 1K to 100K installs: lessons from scaling SureCart

When I joined SureCart in late 2022, it had about a thousand active installations. Today it's well over a hundred thousand. The product is mostly the same shape it was — but almost everything underneath it had to change.

This post is the version of those lessons I wish someone had handed me on day one.

## 1. The bug reports change shape

At a thousand installs, bugs feel personal. You can read every support ticket. You recognize handles in the GitHub issues. The bugs are usually clear: someone tried to do X, X didn't work, here's the stack trace.

At a hundred thousand, the bug reports become statistical. "Checkout fails for 0.3% of users in Safari 14 on iOS." You can't reproduce it. The user can't reproduce it reliably either. You're now debugging from logs, telemetry, and pattern recognition.

**What changed for me:** I started taking observability seriously. Logging structured events. Tagging errors with enough context (plugin version, WP version, PHP version, theme, active plugins) that you can slice them later. The cost of doing this *after* a bug surfaces is enormous; the cost of doing it preemptively is a couple of lines per critical path.

## 2. Backwards compatibility becomes the product

When 100K sites run your plugin, every database column, every hook name, every option key is a public API. You can't rename them. You can't delete them. You can deprecate, alias, and migrate — but you can't break.

```php
// You can no longer do this:
update_option( 'surecart_settings', $new_settings );

// You have to do something like this:
$migrated = surecart_migrate_options_v3( get_option( 'surecart_settings' ) );
update_option( 'surecart_settings', $migrated );
update_option( 'surecart_settings_version', '3.0' );
```

**Lesson:** Version your stored data from day one. Even if you never need it. The migration story you don't have at 1K installs becomes a six-month project at 100K.

## 3. Tests stop being optional

I used to think test coverage was a quality-of-life issue. At scale, it's a survival issue. We added integration tests for every payment flow, every webhook, every Gutenberg block — and the rate of regressions dropped by something like 80%.

The mental shift is: **a failing test is cheaper than a failing user**. By orders of magnitude.

> If you're at 1K installs, write tests for the payment paths. Just those. That's enough leverage to justify the time.

## 4. Performance is a feature you ship every release

At 1K installs, your plugin runs on a hobby blog. At 100K, it runs on stores doing real revenue, with real product catalogs, real customer counts, real query loads. A query that's fine at 100 products is catastrophic at 50,000.

We added:

- A query budget per page-load (admin AND frontend)
- Index reviews on every PR that touched a query
- Synthetic load tests for the checkout path

This isn't glamorous. It's not a feature anyone tweets about. But it's why the plugin still feels fast at scale.

## 5. Architecture pays compound interest

Here's the unsexy truth: the codebases that scale are the ones that took architecture seriously when nobody was watching. SOLID isn't an academic exercise — it's a tool for making future-you's life less miserable.

Specifically, I credit two things for keeping SureCart's codebase manageable:

1. **Service classes for business logic.** Not WordPress hooks calling WordPress hooks calling more WordPress hooks. Discrete, testable units of behavior.
2. **Type-safe boundaries.** TypeScript on the frontend, strongly-typed PHP DTOs on the backend. The number of bugs this prevents is hard to overstate.

## What I'd do differently

If I were starting a plugin today, knowing what I know now:

- I'd add structured logging on day one.
- I'd version every option, every meta key, every database column.
- I'd write integration tests for the critical path before writing the feature.
- I'd resist the urge to ship features fast at the cost of architecture. Architecture is the feature.

None of this is glamorous. None of this gets you to 1K installs faster. But all of it is the difference between getting to 100K and getting to 100K *and surviving it*.

---

*If you're working on a plugin and have questions about scaling, [drop me a line](mailto:manirujjamanakash@gmail.com). I'm always happy to talk shop.*
