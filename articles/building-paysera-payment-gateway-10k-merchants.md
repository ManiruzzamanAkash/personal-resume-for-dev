---
title: "Building a payment gateway used by 10K+ European merchants"
slug: building-paysera-payment-gateway-10k-merchants
date: 2026-04-14
category: Case Studies
excerpt: A retrospective on the Paysera payment gateway — Symfony microservices, WooCommerce / Shopify / Magento plugins, and the boring engineering decisions that kept 10K merchants from noticing us.
readTime: 8 min
tags: [case-study, payments, symfony, woocommerce, shopify, ecommerce]
---

# Building a payment gateway used by 10K+ European merchants

From early 2020 to late 2022 I worked at Paysera — a Lithuanian fintech that runs a multi-currency wallet, IBAN accounts, and a payment gateway used by tens of thousands of European merchants. My slice of the work was the gateway: the integrations sitting between Paysera's core payments backend and the platforms merchants actually run their stores on (WooCommerce, Shopify, Magento, OpenCart, PrestaShop, plus a handful of bespoke integrations).

This is a retrospective on what we built, what worked, and what I'd do differently if I started over today. It's also the kind of post I wish more freelance engineering portfolios contained — not "look how clever this code is", but "here is the boring discipline that kept 10K merchants from noticing the system existed at all".

## The brief

Paysera's gateway needed to do three things, and do them flawlessly:

1. **Accept a checkout from any merchant platform**, hand the customer to a hosted Paysera page, take payment, and notify the platform of success or failure.
2. **Reconcile**. Webhooks fail. Networks blip. We needed a system where the merchant's order state and Paysera's payment state always converged within 24 hours, even when something broke in between.
3. **Stay invisible**. Payment infrastructure is judged by the absence of incident, not the presence of feature. The brief was: don't make merchants think about us.

The customer-facing UX was, ironically, the smallest part. The hard parts were the failure modes.

## The architecture, in one paragraph

A core Paysera payments service (Symfony, PostgreSQL) exposed a stable REST API for "create payment session", "get payment status", "refund payment". On top of that, a fleet of platform-specific plugins (WooCommerce, Shopify, Magento, etc.) handled the platform-side glue: registering as a payment method, creating sessions on checkout submission, handling webhook callbacks, updating order state. A separate reconciliation worker polled outstanding payments and patched divergence.

The key insight: **the plugins were thin**. Almost everything intelligent lived in the core service. A new platform integration was, ideally, a few hundred lines of glue.

## Lesson 1: Idempotency is the whole game

The single most important property of a payment integration: **the same webhook delivered twice must produce the same outcome as the same webhook delivered once**.

This sounds obvious. It is not, in practice, obvious. The default WooCommerce hook flow will happily mark an order paid twice, send two confirmation emails, decrement stock twice, and trigger downstream automations twice. Every one of those is a future support ticket.

The pattern we converged on:

```php
// Inside the webhook handler, for every payment event:
$lock = acquire_lock( "payment:{$paysera_id}" );

try {
  $order = wc_get_order( $local_order_id );

  // Re-check the current state every time. Don't trust the webhook payload
  // alone — fetch fresh state from Paysera's core service.
  $current = $client->get_payment_status( $paysera_id );

  if ( $order->get_meta( 'paysera_processed_event' ) === $current->event_id ) {
    // Already handled this exact event. Bail.
    return;
  }

  $order->update_status( map_paysera_status( $current->status ) );
  $order->update_meta_data( 'paysera_processed_event', $current->event_id );
  $order->save();
} finally {
  release_lock( $lock );
}
```

It's not glamorous code. It's the boring backbone that keeps merchants from getting paid twice (or not at all).

## Lesson 2: Webhooks are advisory, not authoritative

We learned the hard way that webhook delivery, even from a well-engineered provider, is *not* a guarantee. ISP outages, customer firewalls, transient gateway errors, DNS hiccups — all of them swallow webhooks silently.

The fix: **never trust the webhook to be the source of truth**. The webhook is a hint that something happened. The actual state is whatever Paysera's core service says when you ask it. The reconciliation worker, polling every 15 minutes for any order in `pending` state older than 30 seconds, was the safety net that caught everything the webhooks dropped.

Result: in two and a half years, we had zero confirmed cases of a merchant losing a payment to webhook delivery failure. We had hundreds of cases where the reconciliation worker quietly fixed it.

## Lesson 3: Test the platform, not the protocol

Each platform integration was tested at three layers:

1. **Unit tests** for our pure logic (status mapping, signature verification, amount conversion).
2. **Integration tests** that stood up a real WooCommerce / Magento / Shopify dev store and ran a full checkout against a sandbox Paysera environment.
3. **Contract tests** that locked the shape of webhook payloads — so a backend API change couldn't silently break a plugin.

The integration tests were the most expensive to build and the most valuable to keep. Every plugin release ran against a matrix of platform version × PHP version × WP version. Catching a Symfony or Woo change before merchants did is the difference between a quiet release and a Monday morning of refunds.

## Lesson 4: Multi-platform forces good abstractions

When you ship the *same* feature on WooCommerce *and* Shopify *and* Magento, you're forced to find the seams in your architecture. Anything platform-specific has to live in the plugin. Anything cross-platform has to live in the core service. The discipline this imposed kept the core API ruthlessly clean — because three teams of plugin developers would scream if it leaked platform-specific concepts.

This is the silent benefit of multi-platform work that single-platform teams miss: **the act of supporting variety makes your core stronger**.

## Lesson 5: Localization is engineering

Paysera serves merchants across 15+ European languages. The gateway plugins shipped translations for all of them. This sounds like a marketing concern; it's actually an engineering one.

Things we learned:
- **Date and number formats are localized at the platform level**, not the gateway level. Trust the platform's locale, don't reinvent it.
- **Error messages need to be pre-translated** at the time you ship, not generated dynamically. A failure message that arrives in English to a Lithuanian merchant erodes trust.
- **Bank-level identifiers (IBAN, SWIFT) have format rules that vary by country**. Validate at the edge, before the payment leaves the merchant's site.

## What I'd do differently today

Knowing what I know now, four things:

1. **Start with reconciliation, not webhooks.** I'd build the polling worker first and treat webhooks as a latency optimization on top.
2. **Adopt typed API contracts from day one.** We retrofitted JSON Schema later. OpenAPI from the start would have prevented a class of plugin-vs-API drift bugs.
3. **Invest in observability before you need it.** Every payment got tagged with a correlation ID, but we added that after a hairy 2021 incident. Should have been there from commit one.
4. **Smaller, more frequent plugin releases.** We bundled features into quarterly releases. Every release was a tense day. Continuous deployment with feature flags would have lowered that risk dramatically.

---

This is the kind of work I love taking on as a freelance engagement: ecommerce infrastructure, payment integrations, multi-platform plugin architecture. If you're building (or rebuilding) a payment integration, a checkout flow, or a multi-platform commerce extension and want a senior engineer who's done this at scale — [drop me a line](mailto:manirujjamanakash@gmail.com) or [book a call](https://calendly.com/manirujjamanakash/new-meeting).
