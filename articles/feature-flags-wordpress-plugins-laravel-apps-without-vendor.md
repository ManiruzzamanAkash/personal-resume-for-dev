---
title: Feature flags in WordPress plugins and Laravel apps without a vendor
slug: feature-flags-wordpress-plugins-laravel-apps-without-vendor
date: 2026-11-25
category: Architecture
excerpt: "Feature flags let you ship code before you ship the feature, but most teams either skip them or buy a platform they barely use. Here is how I build small, honest flags in WordPress plugins and Laravel apps, and how I keep them from rotting."
readTime: 10 min
tags: [feature-flags, architecture, wordpress, laravel, laravel-pennant, plugin-development, releases, saas]
---

# Feature flags in WordPress plugins and Laravel apps without a vendor

> **In short**
> - **The problem:** a big change sits on a long-lived branch for weeks because it can't go live until it's finished. When it finally merges, it collides with everything else, ships all at once, and if it breaks checkout or the admin there is no quick way back except a rushed release.
> - **What I do about it:** I merge unfinished work behind a small flag that the team controls, turn it on for ourselves first, then a few customers, then everyone, and delete the flag soon after. No paid platform needed: a WordPress option or Laravel Pennant covers most of it.
> - **Who this is for:** WordPress plugin teams and Laravel SaaS teams of one to ten engineers who want safer releases without adding another vendor and another bill.

The failure I see most often starts with a sensible decision. A team is rebuilding a settings screen, a checkout step or a pricing engine. It's too big for one pull request and not useful half-done, so it lives on a branch. Three weeks later the branch has drifted far behind `main`, the merge takes a day, and the release goes out with the new code and two unrelated fixes bundled together. Something breaks. Nobody can tell which change caused it, and rolling back means rolling back all of it.

The other version is quieter. A team does add flags, as scattered `if` statements reading random option names. A year later there are forty of them, half are always on, three are always off, and nobody remembers which ones are safe to remove. The flags became the legacy code.

Both are avoidable with very little machinery. You don't need a feature-flag vendor to get most of the value. You need a clear definition of what a flag is for, one place where flags are read, and a rule for when they die.

## A feature flag separates deploying code from releasing a feature

That's the whole idea, and it's worth saying plainly for anyone who isn't an engineer. *Deploying* puts code on the servers or into a plugin release. *Releasing* lets users see it. A flag is a switch between the two. The code can be live in production for weeks, tested by the team on real data, before a single customer sees it.

That one separation buys three things:

1. **Small merges.** Unfinished work goes into `main` daily, behind a flag that's off. No long-lived branch, no merge week.
2. **Gradual exposure.** Turn it on for the team, then for a handful of friendly accounts, then for everyone.
3. **A fast off switch.** If the new checkout step misbehaves, you flip the flag back. No emergency release, no rollback of unrelated fixes.

What a flag is *not* is a permanent configuration setting. "Show prices with tax" is a setting: customers choose it and it lives forever. "Use the new tax engine" is a flag: the team controls it and it should be gone in a month or two. Mixing the two is how you end up with forty undeletable switches.

## One small interface, read in one place

Whatever the storage, I put every flag check behind a single function or class. Components, templates and controllers ask "is `new-checkout` on for this user?" and never know where the answer comes from.

In a WordPress plugin that can be this small:

```php
namespace Acme\Shop;

final class Flags {
    private const OPTION = 'acme_shop_flags';

    /** Every flag the plugin knows about, with its default. */
    private const DEFAULTS = [
        'new-checkout-step' => false,
        'tax-engine-v2'     => false,
    ];

    public static function on( string $flag, ?int $user_id = null ): bool {
        if ( ! array_key_exists( $flag, self::DEFAULTS ) ) {
            return false; // Unknown flags are off, never an error on a customer's site.
        }

        // A constant in wp-config.php wins: useful for staging and for support.
        $const = 'ACME_FLAG_' . strtoupper( str_replace( '-', '_', $flag ) );
        if ( defined( $const ) ) {
            return (bool) constant( $const );
        }

        $stored = get_option( self::OPTION, [] );
        $value  = $stored[ $flag ] ?? self::DEFAULTS[ $flag ];

        /** Lets a site owner or an add-on override a flag in code. */
        return (bool) apply_filters( 'acme_shop_flag', $value, $flag, $user_id );
    }
}
```

A few choices in there are deliberate:

- **One option, not one per flag.** All flags live in a single array option, so there's one row to inspect and one `get_option` call, which WordPress caches for the request.
- **A known list with defaults.** The `DEFAULTS` array is the inventory. A flag that isn't listed doesn't exist, which is what makes cleanup possible later.
- **Unknown means off.** A typo in a flag name should hide a feature, not fatal-error a store.
- **A constant override.** On a plugin installed on sites you don't control, support will one day need to turn something off on one customer's site. Telling them to add one line to `wp-config.php` is much easier than shipping a build.
- **A filter last.** It keeps the plugin extensible the WordPress way, and it makes flags easy to force in tests.

Then the call site reads like plain English: `if ( Flags::on( 'new-checkout-step' ) ) { ... }`. Toggling from the command line is a WP-CLI option update away, which is handy on staging.

## In Laravel, Pennant is the vendor-free default

Laravel ships a first-party package for this, [Laravel Pennant](https://laravel.com/docs/pennant), and for most apps it removes the need to build anything. You define a feature with a name and a closure that resolves its initial value for a scope, which by default is the authenticated user:

```php
use Illuminate\Support\Lottery;
use Laravel\Pennant\Feature;

// In a service provider's boot method.
Feature::define('new-billing-page', fn (User $user) => match (true) {
    $user->isInternal()         => true,                   // the team sees it first
    $user->team->isBetaTester() => true,                   // then opted-in accounts
    default                     => Lottery::odds(1 / 20),  // then a small random slice
});
```

Checking it is one line: `Feature::active('new-billing-page')` in a controller, `@feature('new-billing-page') ... @endfeature` in Blade, or the `EnsureFeaturesAreActive` middleware on a route group.

The detail that matters most is how Pennant stores results. With the default database driver, the first time a feature is checked for a user, the resolved value is saved, and later checks read the stored value instead of running the closure again. That's exactly what you want for a lottery rollout: a user who got the new page keeps getting it, instead of flipping on every request.

It also means changing the closure doesn't change anyone who already has a stored value. When I widen a rollout, I either update the stored values with `Feature::activateForEveryone('new-billing-page')` or clear a user's value with `Feature::forget(...)` so it resolves again. The Pennant docs are explicit that the "for everyone" methods only touch stored values, so the definition has to change too.

Two Pennant habits worth adopting early:

- **Pick the scope deliberately.** In B2B SaaS the unit of rollout is usually the team or account, not the user. Half a company seeing a new invoice screen produces confused support tickets. Pennant lets you set the default scope with `Feature::resolveScopeUsing(...)` or pass one with `Feature::for($team)`.
- **Eager-load in loops.** Checking a flag per row in a list of users can mean a query per row. `Feature::for($users)->load(['new-billing-page'])` loads them up front.

For a Laravel app I only build my own flag layer when the flags must be shared with a non-Laravel system, or when the app is already structured around a settings service, as in [the shape I use for a SaaS codebase's first engineers](/article/structuring-laravel-saas-codebase-first-three-engineers/).

## Rollout is a sequence, and the off switch is part of the design

A flag is only safe if turning it off is safe. Before I write the first line behind a flag, I ask what happens to data created while it was on.

A new settings screen that writes the same columns as the old one is easy: flip it off and the old screen still reads everything. A new tax engine that writes a new table is not. If you turn it off after a day, orders placed during that day reference data the old code doesn't understand. In that case the flag has to control *reads and writes together*, or the new code has to write in a format both versions can read until the flag is removed.

The rollout itself is boring on purpose:

1. Merge behind a flag that's off everywhere.
2. Turn it on for the team, on production, and use it for real work.
3. Turn it on for a few accounts who agreed to try it, and watch errors and support tickets.
4. Widen in steps. Hold at each step long enough to see a normal day of traffic.
5. Turn it on for everyone.
6. Delete the flag and the old code path.

Step six is the one teams skip.

## A flag that outlives its rollout is technical debt with a switch on it

Every flag doubles the number of paths through the code it guards. Two flags in the same area make four combinations, and nobody tests all four. Old flags also lie: an `if` that's been true for a year still looks like it might be false, so the next engineer has to reason about a branch that never runs.

My rules for keeping flags from piling up:

- **Every flag has an owner and an expected removal date**, written next to its default. In the WordPress class above that's a comment in `DEFAULTS`; in Laravel it's a docblock on the feature class or definition.
- **Removing the flag is part of the original ticket.** The feature isn't done when it's at 100%. It's done when the flag is gone.
- **Release flags and kill switches are different things.** A kill switch for a risky integration, such as an outbound API call during checkout, may live for years on purpose. I name those differently (`kill-` prefix) so nobody "cleans them up" by accident.
- **A periodic grep.** Once a release cycle, list every flag and its age. It takes ten minutes and it's the cheapest refactor you'll ever do.

## Trade-offs and when not to use flags

Flags aren't free, and I don't reach for them by default.

- **Small changes don't need them.** If a change is one pull request and easy to revert, a flag adds a branch and a cleanup task for no benefit.
- **Schema migrations aren't flaggable.** A flag can choose which code path runs. It can't un-add a column. Database changes still need the expand-then-contract approach: add the new structure, run both, migrate, then remove the old one.
- **WordPress plugins can't see their users.** In a SaaS app you can roll out to 5% of accounts and watch dashboards. In a plugin running on thousands of independent sites, you usually can't. There, flags mostly serve internal testing, beta opt-ins and the support off switch, not percentage rollouts.
- **Caching hides flag changes.** A full-page cache can keep serving the old version long after you flip a flag. On long-running Laravel workers, anything you memoize in a static property survives between requests, a trap I wrote about in [running Laravel Octane in production](/article/laravel-octane-production-what-changes-what-breaks/).
- **Testing gets wider.** Critical paths need tests with the flag on and off while both exist. That cost is real, and it's the best argument for short-lived flags.

When does a vendor make sense? When non-engineers need to target users by many attributes from a dashboard, when you need audit logs of every toggle for compliance, or when you run experiments that need statistics. At that point you're buying an experimentation product, not a switch, and that's a different decision.

## What I check on a project like this

1. Is there exactly one place in the code where flags are read, and does it have a list of every flag that exists?
2. Does an unknown or missing flag fall back to "off" without errors?
3. Is the rollout scope right: user, team, account, or the whole site?
4. Can the flag be turned off safely after data has been written with it on?
5. Will caches or long-running workers keep serving the old value after a change?
6. Are critical paths tested with the flag both on and off?
7. Does every release flag have an owner and a removal date, and is removal part of the ticket?
8. Are long-lived kill switches named so they're never mistaken for leftovers?

Feature flags are one of the cheapest ways to make releases calmer, and you don't need a platform to get there: a well-shaped option in WordPress or Pennant in Laravel covers what most teams of this size need. The discipline is the hard part, not the code. Define what a flag is for, read it in one place, make the off switch genuinely safe, and delete it when the rollout is done. A team that does those four things ships big changes in small pieces, and that's what lets it move quickly without breaking the store.
