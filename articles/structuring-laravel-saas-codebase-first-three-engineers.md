---
title: "Structuring a Laravel SaaS codebase for its first three engineers"
slug: structuring-laravel-saas-codebase-first-three-engineers
date: 2026-11-06
category: Laravel
excerpt: "A Laravel SaaS built by one founder usually breaks the week a second and third engineer join. Here is the structure I set up so three people can ship in parallel without stepping on each other or rewriting it a year later."
readTime: 9 min
tags: [laravel, saas, architecture, php, code-structure, team-scaling, founders]
---

# Structuring a Laravel SaaS codebase for its first three engineers

> **In short**
> - **The problem:** a Laravel app written by one person works fine until two more engineers join. Then every feature touches the same controllers, merges collide, bugs appear in unrelated screens, and onboarding takes weeks instead of days.
> - **What I do about it:** group code by business area instead of by file type, put business logic in small action classes, write down a few hard rules, and let tests and static analysis enforce them so the structure survives without a full-time architect.
> - **Who this is for:** founders and hiring managers about to grow a Laravel SaaS from one developer to a small team, and the engineers who will inherit it.

The pattern I see most often goes like this. A founder or a single contractor builds the first version of a SaaS in Laravel. It is fast to build because one person holds the whole thing in their head. Controllers do the work, models carry a lot of logic, and that is fine for a while.

Then the company raises money or lands a big customer and hires two engineers. Within a month, the `SubscriptionController` is 900 lines long and three people are editing it in the same week. A change to how invoices are numbered breaks the admin dashboard. Nobody is sure where a new feature belongs, so each person picks a different answer, and the codebase starts to look like three apps in a trench coat.

None of this is a talent problem. It is a structure problem, and it is cheapest to fix right before the team grows, not after.

## Three engineers is when structure starts to pay for itself

With one engineer, structure is a personal preference. With ten, you need an architect, code owners, and probably a platform team. Three is the awkward middle: too many people for "just ask me", too few to afford process.

What three engineers need from a codebase is simple to state:

- **Parallel work without collisions.** Two people should be able to build features in different parts of the product in the same sprint without merge conflicts.
- **Obvious placement.** A new engineer should know where a feature goes without asking.
- **Contained blast radius.** A change in billing should not silently break onboarding.
- **Rules that do not depend on one reviewer.** If the structure only holds because the founder reviews every pull request, it will not hold.

Everything below is in service of those four things. Nothing here requires microservices, a new framework, or a rewrite.

## Group code by business area, not by Laravel file type

Laravel's default layout groups by type: all controllers in one folder, all models in another. That is a good default for a tutorial and a poor one for a product, because a single feature ends up spread across eight folders and every engineer works in all of them.

I group by business area instead. The areas come from how the business talks, not from database tables:

```text
app/
├── Domains/
│   ├── Billing/
│   │   ├── Actions/        ← CreateSubscription, ChangePlan, IssueRefund
│   │   ├── Models/         ← Subscription, Invoice
│   │   ├── Events/
│   │   ├── Jobs/
│   │   └── BillingServiceProvider.php
│   ├── Accounts/           ← teams, members, invitations, roles
│   ├── Projects/           ← the core product, whatever it is
│   └── Notifications/
├── Http/
│   ├── Controllers/        ← thin, grouped by area: Billing/, Accounts/
│   └── Requests/
└── Support/                ← truly shared helpers, kept small on purpose
```

This is not a framework feature, just PSR-4 autoloading and namespaces, so it costs nothing to adopt. Since Laravel 11, routing and middleware are configured in `bootstrap/app.php`, and each area can still register its own bindings and listeners through its own service provider.

The rule I keep: **three to six areas to start.** If you need a seventh area in the first year, you probably split one too early. Too many small areas is its own mess, with every feature needing changes in four of them.

HTTP stays outside the areas on purpose. Controllers, form requests, and API resources are about the web layer, and keeping them in one place makes routes and authorization easier to review together.

## Business logic lives in small action classes

The single most useful habit for a small team is moving "what the business does" out of controllers and models into action classes: one class, one public method, one business operation.

```php
namespace App\Domains\Billing\Actions;

use App\Domains\Accounts\Models\Team;
use App\Domains\Billing\Events\PlanChanged;
use App\Domains\Billing\Models\Plan;
use App\Domains\Billing\Models\Subscription;
use Illuminate\Support\Facades\DB;

final class ChangePlan
{
    public function __construct(private ProrationCalculator $proration) {}

    public function handle(Team $team, Plan $newPlan): Subscription
    {
        return DB::transaction(function () use ($team, $newPlan) {
            $subscription = $team->subscription()->lockForUpdate()->firstOrFail();

            $credit = $this->proration->creditFor($subscription, $newPlan);

            $subscription->update([
                'plan_id' => $newPlan->id,
                'pending_credit' => $credit,
            ]);

            PlanChanged::dispatch($subscription, $credit);

            return $subscription;
        });
    }
}
```

Why this matters for a team rather than for elegance:

- **The controller, the API, the CLI command, and the queued job all call the same action.** When the admin panel and the public API both change plans, there is exactly one place where a plan change is defined.
- **Merge conflicts shrink.** Two engineers working on billing usually touch different action files, not the same controller.
- **Tests get cheap.** You test `ChangePlan` directly, without HTTP, and the controller test only checks that it wires input to the action.
- **Naming becomes documentation.** A new engineer can list `Billing/Actions` and see what billing does.

Controllers stay thin: validate with a form request, authorize with a policy, call one action, return a response. I wrote about the authorization half of that in [Laravel policies, gates and form requests](/article/laravel-policies-gates-form-requests-i-trust-before-secret-ifs/).

Models keep relationships, casts, scopes, and small invariants about their own data. They do not send emails, call Stripe, or decide pricing.

## Areas talk through a narrow surface

Grouping by area only helps if areas do not reach deep into each other. The bug I see most often in growing Laravel apps is one area querying another area's tables directly, then breaking when that area changes its schema.

The rules I write down for the first three engineers:

1. **An area may call another area's actions,** not its internal helpers or raw queries against its tables.
2. **Side effects across areas go through events.** Billing dispatches `PlanChanged`; Notifications listens and sends the email. Billing does not know emails exist.
3. **`Support/` is not a junk drawer.** Anything added there needs a second caller first.
4. **Only `Accounts` decides who belongs to which team.** Tenancy and permissions have one owner.

Events are a sharp tool, so I use them for side effects, not for core flow. If the operation is wrong without the listener running, it should be a direct call inside the action, not an event someone might forget to register. Heavy listeners should be queued, and once a queue does real work it needs monitoring, as covered in [Laravel Horizon production patterns](/article/laravel-horizon-production-patterns-i-trust/).

## Let tests and static analysis enforce the rules

Written rules decay the moment the person who wrote them is on holiday. For a three-person team, the rules have to live in CI.

Two tools do most of the work:

- **Larastan** (PHPStan with Laravel awareness) catches wrong types, missing properties, and calls to methods that do not exist, before a reviewer has to.
- **Pest architecture tests** turn structural rules into failing tests.

```php
// tests/Architecture/StructureTest.php

arch('controllers do not query models directly')
    ->expect('App\Http\Controllers')
    ->not->toUse('Illuminate\Support\Facades\DB');

arch('billing does not depend on notifications')
    ->expect('App\Domains\Billing')
    ->not->toUse('App\Domains\Notifications');

arch('billing actions are final')
    ->expect('App\Domains\Billing\Actions')
    ->toBeFinal();

arch('no debugging calls')
    ->expect(['dd', 'dump', 'ray'])
    ->not->toBeUsed();
```

These are not about purity. Each one prevents a specific argument in code review. When a rule fails in CI, the conversation is "the test says no, do we change the rule?" instead of "the senior engineer says no".

Add a formatter (Laravel Pint is the default choice) so nobody spends review time on spacing, and a short `CONTRIBUTING.md` that says where things go. At weDevs I wrote the onboarding doc and pairing path new engineers used to ramp up, and the lesson that stuck with me is that a short, specific doc beats a long, aspirational one. Half a page that answers "where does a new feature go?" is enough.

## Decide the expensive things before engineer two starts

Some decisions are cheap to change later. A few are expensive enough that I settle them before the team grows:

- **Tenancy model.** Single database with a `team_id` on every tenant table, or something more isolated. Changing this later touches every query. Whatever you pick, make it impossible to forget: a global scope or a base query, plus tests that prove one team cannot see another's data.
- **Roles and permissions.** Who can do what, and where that is checked. At Akij Group I designed the JWT auth and role/permission layer for an internal HR, POS and ERP suite, and the part that mattered most was making the permission check one consistent call, not a scatter of `if` statements.
- **Money and IDs.** Integer minor units for money, explicit types for statuses. I covered that in [PHP value objects and enums](/article/php-value-objects-enums-money-ids-i-trust/).
- **How code reaches production.** A repeatable deploy that any of the three can run, not one person's laptop. See [zero-downtime Laravel deploys](/article/zero-downtime-laravel-deploys-small-vps-atomic-releases/).

## Trade-offs, and when not to do this

This structure has real costs, and it is wrong for some teams.

- **Solo founders pre-product-market fit should skip most of it.** If the product might pivot next month, speed of change matters more than parallel work. Use default Laravel, keep controllers readable, and restructure when you hire.
- **Areas drawn too early are worse than none.** If you guess the business boundaries before you understand the business, you will spend months moving code between the wrong boxes. Wait until the product has a few months of real use.
- **Action classes can become ceremony.** A one-line update does not need its own class. I use actions for operations with business rules, side effects, or more than one caller, and leave trivial CRUD in the controller.
- **Events hide control flow.** Every event is a "who listens to this?" question for the next engineer. Keep them few and named after facts that happened.
- **This is not a modular monolith framework.** I avoid adding a package to manage modules at this size. Folders, namespaces and architecture tests are enough, and they do not add a dependency that the whole app is shaped around.
- **It is not a step toward microservices.** Clear areas make a future split possible, but three engineers should run one deployable app. Splitting services at this size mostly adds network failures and deploy coordination.

## What I check on a project like this

1. Can a new engineer name the business areas from the folder list alone?
2. Is there exactly one place where each important operation (sign-up, plan change, refund) is defined?
3. Are controllers thin enough that most are under a screen of code?
4. Does any area query another area's tables directly?
5. Is tenant isolation enforced by default and covered by a test that tries to cross it?
6. Do architecture tests and static analysis run in CI and block merges?
7. Is there a half-page doc that says where a new feature goes?
8. Can every engineer on the team deploy, and roll back, without asking someone else?

The goal is not a beautiful codebase. It is a codebase where three people can each own a part of the product, ship in the same week, and trust that the others did not quietly break their part. Group by business area, put the rules of the business in actions, keep the surfaces between areas narrow, and make CI the one who says no. Do it right before the second engineer starts, and it costs a few days. Do it after the fifth, and it is a rewrite.
