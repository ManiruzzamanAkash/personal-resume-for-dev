---
title: "Subscription billing edge cases: proration, failed renewals, dunning"
slug: subscription-billing-edge-cases-proration-failed-renewals-dunning
date: 2026-11-19
category: WooCommerce
excerpt: "Subscriptions rarely fail on the happy path. They fail on plan switches, declined renewals and the emails in between. Here is how I design proration, retries and dunning so recurring revenue doesn't leak or double-charge."
readTime: 11 min
tags: [woocommerce, woocommerce-subscriptions, stripe, recurring-billing, dunning, proration, payments, ecommerce, saas]
---

# Subscription billing edge cases: proration, failed renewals, dunning

> **In short**
> - **The problem:** subscription stores lose money in the quiet places: a plan switch that charges the wrong amount, a renewal that fails and is never recovered, a retry that charges a customer twice. Each one costs revenue, support time and trust.
> - **What I do about it:** I decide the billing rules in writing before writing code, classify payment failures before retrying them, make every renewal charge idempotent, and treat dunning (the process of recovering failed payments) as a customer-communication system, not a cron job.
> - **Who this is for:** engineers building or maintaining WooCommerce Subscriptions gateways and custom billing, and store owners whose recurring revenue keeps "leaking" without an obvious bug.

The first charge is the easy part. The customer is on the page, the card is in front of them, and if 3-D Secure asks for a code, they type it in. Everything after that happens while nobody is watching: a renewal at 3 a.m., a card that expired last month, a bank that now wants the customer to authenticate again, a customer who upgraded halfway through the month and expects to pay "the difference."

The failure I see most often isn't a crash. It's a renewal that quietly went to on-hold, sent one generic email, and stayed there. The store didn't lose a customer because they cancelled. It lost them because nobody asked them to update a card.

I built and shipped subscription billing as part of SureCart's core engineering, alongside gateway integrations for Stripe, PayPal, Mollie and Razorpay. Before that, at Paysera, I owned a WooCommerce payment plugin through the PSD2 / SCA rollout, including reconciliation tooling. The lesson from both: **the bugs live at the edges of the billing cycle, so that's where the design has to start.**

## A renewal is a distributed transaction, not a scheduled task

It's tempting to think of a renewal as "a job runs, a card gets charged." In practice, at least three systems have to agree: your store (the subscription and its renewal order), the gateway (the payment attempt), and the customer's bank (which can approve, decline, or ask for authentication). Any of them can time out, retry, or answer late.

In WooCommerce Subscriptions, a renewal fires the `woocommerce_scheduled_subscription_payment` action, which creates a renewal order and then calls a gateway-specific hook, `woocommerce_scheduled_subscription_payment_{gateway_id}`, with the amount to charge and the renewal order. Your gateway charges the card and marks that order paid or failed. Subscriptions reacts to the order status: a paid renewal keeps the subscription active, a failed one triggers `woocommerce_subscription_renewal_payment_failed` and puts the subscription on hold.

That gives you three states to keep consistent: subscription status, renewal order status, and what the gateway actually did. Most billing bugs are a disagreement between two of them, for example an order marked failed because the request timed out, while the bank approved the charge a second later.

## Make every renewal charge idempotent before anything else

An idempotent operation gives the same result no matter how many times you run it. For renewals, that means one renewal order can produce at most one successful charge.

Double charges usually come from ordinary events, not exotic ones: a scheduled action that runs twice because the first run timed out, an admin who clicks "process renewal" while the scheduled one is in flight, or a webhook that marks the order paid while your synchronous call is still retrying. Action Scheduler, the queue Subscriptions uses for renewals, is reliable, but "reliable" for a queue means *at least once*, not *exactly once*. I wrote about that property in [Action Scheduler patterns that keep WooCommerce plugins from timing out](/article/action-scheduler-patterns-woocommerce-plugins/).

The defense is simple and boring: derive an idempotency key from the renewal order, send it to the gateway, and refuse to charge an order that already has a transaction.

```php
add_action(
    'woocommerce_scheduled_subscription_payment_' . $this->id,
    [ $this, 'process_renewal' ],
    10,
    2
);

public function process_renewal( float $amount, WC_Order $renewal_order ): void {
    // Already paid or already charged: never charge twice.
    if ( $renewal_order->is_paid() || $renewal_order->get_transaction_id() ) {
        return;
    }

    // Same key on every attempt for this order. The gateway dedupes repeats.
    $key = 'renewal-' . $renewal_order->get_id() . '-' . $renewal_order->get_meta( '_retry_attempt' );

    try {
        $result = $this->api->charge( [
            'amount'          => $amount,
            'currency'        => $renewal_order->get_currency(),
            'customer'        => $renewal_order->get_meta( '_gateway_customer_id' ),
            'payment_method'  => $renewal_order->get_meta( '_gateway_payment_method_id' ),
            'off_session'     => true,
            'idempotency_key' => $key,
        ] );
    } catch ( Gateway_Timeout $e ) {
        // Unknown outcome. Don't mark failed; let the webhook or a status check decide.
        $renewal_order->add_order_note( 'Renewal charge timed out; awaiting gateway confirmation.' );
        return;
    }

    if ( $result->succeeded() ) {
        $renewal_order->payment_complete( $result->id );
        return;
    }

    $renewal_order->update_meta_data( '_last_decline_code', $result->decline_code );
    $renewal_order->update_status( 'failed', 'Renewal declined: ' . $result->decline_code );
}
```

Two details matter more than the code. First, a timeout is not a failure. If you mark the order failed and the bank approved it, the next retry charges again. Treat "unknown" as its own state and resolve it from the gateway's webhook or a status lookup. Second, the webhook handler needs the same guard, because it races with this code. The pattern is in [Idempotent WooCommerce payment webhooks](/article/idempotent-woocommerce-payment-webhooks/).

The `_retry_attempt` suffix is deliberate. A retry is a *new* attempt and needs a new key; a duplicate run of the *same* attempt must reuse the old one.

## Classify the decline before you retry it

Not every failed renewal should be retried. Retrying the wrong kind of failure wastes attempts, annoys the bank, and can make future approvals less likely.

I sort declines into three buckets:

- **Soft declines.** Insufficient funds, a temporary issuer error, a processing hiccup. These are what retries are for. Spacing them out over days gives payday a chance to arrive.
- **Hard declines.** Lost or stolen card, closed account, "do not honor" repeated, an invalid card number. Retrying these won't help. The customer needs to give you a new payment method, so skip straight to asking them.
- **Authentication required.** Under SCA in Europe, a bank can refuse an off-session charge and ask for the cardholder to authenticate. No retry fixes this. The customer has to come back on-session and complete the challenge. This one catches teams that built billing before PSD2 and never handled it.

WooCommerce Subscriptions ships a failed-payment retry system, but it's **off by default**. You enable it under the Subscriptions settings. Its default rules make five retries over seven days, waiting 12 hours, 12 hours, 24 hours, 48 hours and then 72 hours after each failed attempt. During retries the renewal order sits at Pending and the subscription at On-hold. If every retry fails, the renewal order is marked Failed. It also only applies where the store controls the schedule: gateways that run their own billing schedule, like PayPal Standard, are excluded, and so are SEPA payments.

Those defaults are reasonable for soft declines. They are wasteful for hard declines and useless for authentication-required failures. If your gateway exposes decline codes, store them on the order (as the code above does) and use them to decide whether a retry is worth scheduling or whether the next step is an email with a payment link.

## Dunning is a messaging system with a payment form attached

Dunning means the sequence of reminders and recovery steps after a failed payment. Teams often reduce it to "send the failed-payment email." That email is usually the least effective part.

What makes dunning work:

- **One clear action.** Every message links to a page where the customer can pay the pending renewal or update their card in one step. In WooCommerce Subscriptions, paying a pending renewal manually also updates the payment method on the subscription, which is exactly what you want.
- **Messages that match the cause.** "Your card expired" and "your bank needs you to confirm this payment" are different problems with different fixes. A single generic "payment failed" email makes the customer guess.
- **A schedule that ends.** Decide when retries stop and what happens next: cancel, pause, or leave on hold for a sales follow-up. "On hold forever" is not a policy; it's a backlog.
- **Something before the failure.** The cheapest recovery is the one that never needs to happen. A reminder before an annual renewal, or when the card on file is about to expire, prevents a class of failures entirely.

## Proration is a product decision before it's arithmetic

Proration means charging or crediting for the part of a billing period a customer actually used when they change plans mid-cycle. The math is easy. The rules behind it are what teams forget to decide.

WooCommerce Subscriptions makes this explicit in its switching settings: you can charge the full new price at the switch, prorate upgrades only, or prorate both upgrades and downgrades. You can apply proration to virtual products, physical products, or both. Sign-up fees and fixed-length subscriptions have their own settings. Stripe makes a similar choice per API call: its `proration_behavior` parameter defaults to `create_prorations`, which adds proration items to the next invoice; `always_invoice` bills them immediately; `none` turns proration off.

Before any code, I want a written answer to each of these:

1. **When does the customer pay for an upgrade?** Immediately, or on the next renewal? Immediate payment is clearer for the customer but adds an off-session charge that can fail.
2. **Does a downgrade create a credit, a refund, or nothing?** Credits are simplest to account for. Refunds create work for whoever reconciles payouts.
3. **What happens to coupons and taxes on the prorated amount?** A 50% coupon applied to a credit line can quietly turn a downgrade into money owed to the customer.
4. **Can the customer see the number before they confirm?** Stripe offers an invoice preview endpoint and a `proration_date` parameter so the charge matches the preview exactly. Whatever the platform, show the amount first.
5. **What does a physical product switch mean?** A customer switching a monthly coffee box mid-cycle may already have this month's box shipped. Prorating it can mean paying for something twice or getting it free.

## Calendars break more renewals than code does

Some edge cases have nothing to do with payments and everything to do with dates:

- **Month-end anchors.** A subscription that started on January 31 has to renew *sometime* in February. Decide whether it moves to the last day of the month or drifts to the 28th forever. Stripe, for instance, bills on February 28 (or 29) and then goes back to March 31; your custom code should make its choice on purpose.
- **Time zones.** "Renews on the 1st" in the store's time zone can be the 31st for the customer. Store timestamps in UTC and show local dates.
- **Trial endings.** The end of a free trial is the first *off-session* charge, so it fails like a renewal, not like a checkout. Make sure your retry and dunning flow covers it.
- **Card expiry.** Cards expire on a known date. That's the most predictable failure in billing, and the easiest to warn about.

## Trade-offs: when not to build this yourself

Everything above is work, and not every store needs to own it.

- **If the gateway can own the schedule, consider letting it.** Stripe Billing, for example, handles proration, retries and dunning emails on its side. You trade control over the store-side data (renewal orders, reports in WooCommerce) for less code to maintain. That trade is worth it for a SaaS-style product and rarely worth it for a store that ships physical boxes and needs every renewal as a real order.
- **Don't build custom retry logic on top of a gateway that already retries.** Two retry systems on the same failed charge is how customers get charged twice or emailed four times.
- **Don't prorate when nobody asked for it.** For low-priced plans, "the new price starts next renewal" is easier to explain, easier to support, and avoids an extra off-session charge. Proration is a feature, not a requirement.
- **Don't add aggressive retries for hard declines.** Banks and card networks watch retry behavior. More attempts is not more recovery.

## What I check on a project like this

1. Is there a written billing policy covering upgrades, downgrades, credits, refunds, coupons, and when access stops after a failed payment?
2. Does every renewal charge carry an idempotency key tied to the renewal order and attempt number?
3. Are timeouts treated as "unknown" and resolved from the gateway, never marked failed by default?
4. Are decline codes stored and used to choose between retry, card-update email, and authentication request?
5. Is the retry system actually enabled, and is exactly one system (store or gateway) retrying each charge?
6. Does every dunning message link to a one-step page to pay the renewal or update the card?
7. Do trial endings, month-end anchors and card expiry have tests, not just assumptions?
8. Is there a report of subscriptions stuck on hold, with an owner who looks at it?

Subscription billing doesn't usually break loudly. It leaks: a few renewals that never retried, a few customers charged twice, a few plan switches that cost more than anyone expected. The fix isn't clever code. It's deciding the rules before the edge cases arrive, making each charge safe to run twice, and treating the customer messages after a failure as part of the product. Get those right and recurring revenue behaves like what it's supposed to be: predictable.
