---
title: "Event-driven Laravel: events, listeners and when they hurt"
slug: event-driven-laravel-events-listeners-when-they-hurt
date: 2026-11-28
category: Laravel
excerpt: "Laravel events make side effects easy to add and hard to follow: emails sent for rolled-back orders, listeners nobody can find, tests that pass for the wrong reason. Here is how I use events, and where I refuse to."
readTime: 10 min
tags: [laravel, events, listeners, queues, architecture, php, saas]
---

# Event-driven Laravel: events, listeners and when they hurt

> **In short**
> - **The problem:** Laravel events let one action quietly trigger many others, such as sending a receipt, updating a report or calling a partner API. Used carelessly, they send emails for orders that never saved, hide business rules where nobody looks, and make a simple bug take a day to trace.
> - **What I do about it:** I keep the core business step in plain, explicit code, use events only for side effects that can fail or run late without breaking the main flow, dispatch them after the database commits, and make every queued listener safe to run twice.
> - **Who this is for:** Laravel teams whose app has grown past a handful of listeners, and tech leads deciding whether "just fire an event" is the right answer in code review.

The bug report usually reads like this: a customer got an order confirmation email, but there is no order. Support checks the database and finds nothing. Engineering checks the logs and finds a failed payment, a rolled-back transaction, and, a few lines earlier, a listener that happily sent the email.

The second version is slower to notice. A new engineer changes how invoices are created, all the tests pass, and three days later someone asks why the accounting export stopped picking up new invoices. The export was driven by a listener on a model event, registered by auto-discovery, in a file nobody opened.

Neither is a Laravel bug. Both come from using events as a default way to structure code instead of a deliberate tool with a specific job. Here is how I draw that line.

## Events are for side effects, not for the business step itself

An event says "this happened." A listener says "when that happens, also do this." That shape is good when the "also" is a side effect: something the main action does not depend on, and that can run later or fail without making the main action wrong.

Good fits:

- Sending notifications and emails after an order, signup or password change.
- Updating search indexes, caches, analytics or a reporting table.
- Telling another system something changed: a webhook, a CRM sync, an audit log.

Bad fits are the steps that define the operation. If "place an order" must reserve stock, record the payment and create the order rows, those belong in one service or action class, in order, inside one transaction. Hiding stock reservation in an `OrderPlaced` listener means the order can exist without the reservation, and the only way to learn that is to know the listener exists.

My rule in review: if removing the listener would make the data wrong, it should not be a listener.

```php
final class PlaceOrder
{
    public function handle(Cart $cart, PaymentResult $payment): Order
    {
        return DB::transaction(function () use ($cart, $payment) {
            $order = Order::createFromCart($cart);
            $this->stock->reserve($order);      // part of the operation
            $order->recordPayment($payment);    // part of the operation

            OrderPlaced::dispatch($order);      // side effects only

            return $order;
        });
    }
}
```

The service reads top to bottom. A new engineer can see what placing an order means without searching for listeners.

## Dispatch after commit, or you will notify about data that does not exist

The rolled-back-order email is the most common event bug I see, and it has a precise cause. The event fires inside a transaction. A listener runs, either synchronously or on a queue worker that picks the job up within milliseconds. Then the transaction rolls back. The email has already gone, or the queued job looks for an order that was never committed.

Laravel has direct answers to this, and I use them by default:

- Implement `Illuminate\Contracts\Events\ShouldDispatchAfterCommit` on the event. Laravel holds the event until the open transaction commits and discards it if the transaction fails. With no transaction open, it dispatches immediately.
- For queued listeners, implement `ShouldQueueAfterCommit` instead of `ShouldQueue` when your queue connection does not already have `after_commit` enabled.
- For model observers, implement `ShouldHandleEventsAfterCommit` so the observer's handlers wait for the commit too.

```php
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final class OrderPlaced implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public readonly Order $order) {}
}
```

I'd rather put the guarantee on the event than trust every listener author to remember it. The event is the contract; the listeners come and go.

## Every queued listener must be safe to run twice

Queues retry. Workers get killed mid-job during deploys. A listener that calls a payment provider or sends an email can run once, fail on the last line, and run again. If it is not idempotent (safe to repeat with the same result), customers get two emails or partners get two API calls.

The patterns I reach for:

- **Record that the side effect happened, keyed by something stable.** A `sent_notifications` row with a unique key on `(order_id, type)` turns a second send into a no-op.
- **Pass IDs to external APIs that support idempotency keys.** Many payment and messaging APIs accept one; use the order ID or event ID, not a random value.
- **Re-read state inside the listener.** By the time a queued listener runs, the order may be cancelled. Check before acting.

```php
final class SendOrderReceipt implements ShouldQueueAfterCommit
{
    public function handle(OrderPlaced $event): void
    {
        $order = $event->order->fresh();

        if ($order === null || $order->isCancelled()) {
            return;
        }

        $sent = SentNotification::firstOrCreate(
            ['order_id' => $order->id, 'type' => 'receipt'],
        );

        if (! $sent->wasRecentlyCreated) {
            return; // already sent on an earlier attempt
        }

        Mail::to($order->email)->send(new OrderReceipt($order));
    }

    public function failed(OrderPlaced $event, Throwable $e): void
    {
        report($e);
    }
}
```

That ordering marks the receipt as sent before the mail call, so a crash between the two means a missed email, not a duplicate. Which failure you prefer is a product decision; I make it explicit instead of leaving it to chance. The same thinking applies to inbound webhooks, which I covered in [idempotent WooCommerce payment webhooks](/article/idempotent-woocommerce-payment-webhooks/).

The `failed` method runs once retries are exhausted. I always define it on listeners that touch money or customers, so a permanent failure becomes a visible report instead of a silent row in `failed_jobs`.

## Model events are the easiest to add and the hardest to trust

Eloquent fires events like `creating`, `created`, `updating`, `saved` and `deleted`, and observers make it tempting to hang behavior on them. I use them sparingly, for three reasons.

First, they don't fire for everything. Mass updates and deletes through the query builder, such as `Invoice::where(...)->update([...])`, never load the models, so `updated` and `deleted` never fire. Neither do raw queries or imports that bypass Eloquent. A rule that lives in an observer is a rule that some code paths skip.

Second, they fire when you don't want them. Seeders, data migrations and admin repair scripts trigger the same observers as real traffic. Laravel gives you `saveQuietly()` and `Model::withoutEvents()` for this, but every quiet save is a place where someone had to know to opt out.

Third, they hide intent. `InvoiceObserver::created` tells you *when* something runs, not *why*. A domain event like `InvoiceIssued`, dispatched by the code that issues invoices, carries the reason in its name.

So my default is: model events for mechanical concerns tied to the row itself (setting a UUID, clearing a cache key, writing an audit trail). Domain events, dispatched explicitly, for anything with business meaning.

## Discovery is convenient; `event:list` is how you keep it honest

Current Laravel auto-discovers listeners in `app/Listeners`: any `handle` or `__invoke` method is registered for the event type-hinted in its signature. That removes a registration file, and with it the one place where you could read every listener at a glance.

I compensate in two ways:

- **Run `php artisan event:list` in review** when a PR adds or moves a listener. It prints every event and its listeners. If the output surprises anyone, that is the conversation to have.
- **Cache the manifest in production** with `php artisan optimize` or `event:cache`, as part of the deploy, so discovery doesn't scan directories on every boot. My deploy steps for that live in [zero-downtime Laravel deploys](/article/zero-downtime-laravel-deploys-small-vps-atomic-releases/).

I also keep a soft limit: when one event has more than four or five listeners, I look at whether the event is doing too much, or whether a few of those listeners are really one workflow that should be a single, readable job.

## Test the dispatch and the listener separately

`Event::fake()` is useful and easy to misuse. Faking all events in a feature test means none of your listeners run, so a test can pass while a broken listener would have failed in production.

What I do instead:

1. In the test for the business action, fake only the events it should dispatch, with `Event::fake([OrderPlaced::class])`, and assert with `Event::assertDispatched`. Other events still run.
2. Test each listener directly: build the event, call `handle`, assert the side effect. That covers the idempotency path too: call it twice, expect one email.
3. Add one cheap wiring test with `Event::assertListening(OrderPlaced::class, SendOrderReceipt::class)` for listeners that matter to the business, so a rename or a moved file doesn't silently unregister them.

The Laravel docs also note that `Event::fake()` should be called after factories that depend on model events, otherwise those factories lose behavior they rely on. That one catches teams regularly.

## When not to use events at all

Events add a layer of indirection. That is worth paying for when it buys decoupling you actually need. It often doesn't.

- **One listener, forever.** If an event has a single listener and nothing else will ever care, a direct method call or a dispatched job is clearer. Indirection with one consumer is just distance.
- **The caller needs the result.** Events don't return values in any useful way. If the action needs a computed price or a validation answer, call a service.
- **Order matters.** Relying on the order listeners run in is fragile, and with discovery nobody chose that order on purpose. If step B must follow step A, write A then B.
- **Stopping propagation.** Returning `false` from a listener stops later listeners. It works, but it means one listener controls others it doesn't know about. When I see it, I usually replace the event with explicit code.
- **Small teams, small apps.** In a codebase with two engineers and a dozen features, explicit service calls are easier to follow. Events earn their keep when separate parts of the app, or separate teams, need to react to the same thing without knowing about each other. I touched on where that boundary sits in [structuring a Laravel SaaS for its first three engineers](/article/structuring-laravel-saas-codebase-first-three-engineers/).

## What I check on a project like this

1. Can each core operation (place order, issue invoice, change plan) be read in one class, without opening a listener?
2. Do events that touch the database or the outside world implement `ShouldDispatchAfterCommit`, or use after-commit queued listeners?
3. Is every queued listener that sends, charges or syncs safe to run twice, with a stable key recording that it ran?
4. Do listeners that affect customers or money define `failed`, and does someone see those reports?
5. Are business rules kept out of model observers, given that mass updates and raw queries skip them?
6. Does `php artisan event:list` match what the team believes is registered, and is the event manifest cached on deploy?
7. Do feature tests fake only the events they assert on, with separate tests for each important listener?
8. Are there events with a single listener, or listeners that return `false`, that should be plain method calls instead?

Events are one of the cleaner tools Laravel gives you for keeping side effects out of the main path, and that is the job I give them: notify, index, sync, audit. The trouble starts when they become the default way to connect any two pieces of code, because the result reads well in a diagram and badly in a stack trace. Keep the business step explicit, fire events after commit, make listeners safe to repeat, and an event-driven Laravel app stays something a new engineer can follow on their first week.
