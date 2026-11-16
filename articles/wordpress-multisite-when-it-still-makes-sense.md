---
title: "WordPress multisite in 2026: when it still makes sense"
slug: wordpress-multisite-when-it-still-makes-sense
date: 2026-11-16
category: WordPress
excerpt: "Multisite turns many WordPress sites into one install with one codebase, one database and one point of failure. Here is how I decide whether a network will save an agency time or quietly lock every site into the same problems."
readTime: 10 min
tags: [wordpress, multisite, architecture, agency, hosting, woocommerce, decision-guide]
---

# WordPress multisite in 2026: when it still makes sense

> **In short**
> - **The problem:** multisite looks like a shortcut for running many WordPress sites, but it ties them all to one codebase, one database and one set of plugins. Chosen for the wrong reasons, it turns one bad update into an outage on every site, and makes it hard to ever move a single site out.
> - **What I do about it:** I use multisite only when the sites are meant to be the same product run by the same team: same plugins, same theme family, same update schedule. Otherwise I run separate installs and automate them.
> - **Who this is for:** agencies and in-house teams deciding how to host a group of related sites, and anyone who inherited a network and wonders whether to keep it.

The request usually sounds reasonable. "We have twelve regional sites and updating them one by one takes a day. Can we put them all in one WordPress?" Multisite can do exactly that. One install, one dashboard, one plugin update that lands everywhere.

The trouble shows up a year later. One region wants a plugin the others don't. A marketing team wants to hand a site to a different agency. A security issue in a plugin that only one site uses is now present on all of them, because the code lives in one shared folder. And somebody asks how to export just one site to its own server, and the honest answer is "carefully, over several days."

Multisite is not obsolete. It is a specific tool for a specific shape of business, and the mistake is using it as a general way to manage "lots of sites."

## Multisite shares more than most people expect

Before the decision, it helps to know what is actually shared, because the trade-offs all come from here.

- **One codebase.** Every site runs the same WordPress core, the same installed plugins and the same installed themes. Only a super admin (the network-level administrator) can install or update them.
- **One database, mixed tables.** Each site gets its own content tables with a numbered prefix (`wp_2_posts`, `wp_2_options`, and so on). Users are different: `wp_users` and `wp_usermeta` are shared across the whole network, so one account can belong to several sites.
- **One file tree for uploads**, split per site under `wp-content/uploads/sites/<id>/`.
- **One `wp-config.php`**, one PHP version, one server configuration, one cron setup.

Plugins can be activated per site or network-activated (switched on for every site at once). Themes have to be enabled for the network before a site can use them. Since WordPress 4.5, mapping a site to its own domain is built into core, so `brand-a.com` and `brand-b.com` can both live in one network without a plugin.

That is a lot of sharing. When the sites really are one product, it is a gift. When they are not, every shared piece becomes a negotiation.

## It fits when the sites are one product with one owner

The cases where I recommend multisite have the same shape: many sites, one team, one standard.

- **A university, a newsroom or a company with many departments or regional sites** that should look alike, use the same approved plugins, and be maintained by one central team.
- **A franchise or chain** where each location gets a site from the same template, and local staff edit content but never touch plugins.
- **A platform where creating a site is the product**, such as a school giving every class a blog or a SaaS that provisions a site per customer. Subdomain networks can create sites on demand, which is hard to match with separate installs.
- **Shared users are a feature.** If one person should log in once and edit several sites, the shared users table does that natively.

In all of these, the restriction "every site runs the same plugins at the same version" is exactly what the owner wants. It is governance, not a limitation.

## It fails when each site has its own owner or its own roadmap

The failure I see most often is a network built for convenience out of sites that were never meant to be the same.

- **Different clients in one network.** An agency puts unrelated clients in one install to save hosting. Now client A's plugin request is a risk to client B, and client B's site can't leave without a migration project.
- **Sites with very different traffic.** One busy store and twenty brochure sites share a database server and a PHP pool. When the store has a sale, every brochure site slows down with it.
- **Sites that need different plugins.** You can install a plugin on the network and activate it on one site only, but the code is still on disk for all of them, and its updates are still everyone's update. Fifty plugins each used by one site is a plugin audit waiting to happen; I wrote about that pattern in [9 signs your WordPress site needs a plugin audit](/article/wordpress-site-needs-plugin-audit-not-another-plugin/).
- **Different compliance or data rules.** If one site needs stricter access, separate backups or data kept in a specific region, sharing a database and a users table works against you.

The test I use is simple: if two sites would ever reasonably want different answers to "which plugins, which versions, which host," they should not share an install.

## WooCommerce on multisite is several stores, not one

This is the most common misunderstanding, so it gets its own section. WooCommerce runs on multisite, but each site is its own store with its own products, orders, carts, settings and payment configuration. Multisite does not give you a shared catalog, shared stock or a shared cart across sites.

If the goal is "one inventory, several storefronts" (for example per country), multisite alone does not deliver it. You end up adding a sync plugin or custom code to copy products and stock between sites, and now you own a distributed-data problem inside WordPress. For that goal I usually look at one store with per-market pricing and languages first, or at a single back end feeding several front ends, which I covered in [Headless WooCommerce: when it's worth it](/article/headless-woocommerce-when-its-worth-it/).

Where multisite plus WooCommerce does fit: genuinely separate stores run by one team, such as several brands with different catalogs that share a design system and an operations team.

## The code has to know it is on a network

Most plugin bugs on multisite come from code that assumes it is the only site in the database. Three patterns cover most of them.

**Cross-site reads with `switch_to_blog()`.** This changes the database table prefix to another site so you can read its posts or options. It does not load that site's plugins or theme: the WordPress docs say plainly that code loaded for the original site does not switch. So reading another site's data works; calling another site's plugin functions does not. Every switch needs a matching `restore_current_blog()`, one per switch, or later URLs and queries quietly point at the wrong site.

```php
$summary = [];

foreach ( get_sites( [ 'number' => 100, 'fields' => 'ids' ] ) as $site_id ) {
    switch_to_blog( $site_id );

    try {
        $summary[ $site_id ] = (int) wp_count_posts( 'post' )->publish;
    } finally {
        // Always restore, even if something above throws.
        restore_current_blog();
    }
}
```

Looping like this over a large network on every page load is expensive. I keep it in a WP-CLI command or a scheduled job and cache the result.

**Activation hooks.** When a plugin is network-activated, its activation hook runs once, not once per site. If the plugin creates tables or default options, it has to handle every existing site and also sites created later (the `wp_initialize_site` hook fires when a new site is set up).

**Options vs network options.** `get_option()` reads the current site. Settings that should apply to the whole network belong in `get_site_option()` / `update_site_option()`. Mixing them up produces the classic bug where a setting "works on the main site only."

None of this is hard, but a plugin that was never tested on a network will hit at least one of these. Before I accept a plugin into a network, I check that it states multisite support and I test it on a staging network with more than one site.

## Trade-offs: what you give up either way

Multisite is a bet on sameness. Here is what each side costs.

**Choosing multisite, you give up:**

- **Independent updates.** One plugin update reaches every site that has it. A bad release breaks all of them at once.
- **Easy exit.** Moving one site out means extracting its prefixed tables, its users from the shared tables, its uploads folder, and rewriting URLs. It is doable, but it is a project.
- **Hosting choice.** Some managed hosts limit or charge extra for multisite, and some caching and security tools behave differently on networks.
- **Isolation.** One compromised admin account with super admin rights reaches every site.

**Choosing separate installs, you give up:**

- **One-click maintenance.** Updating thirty sites is thirty updates, unless you automate it.
- **Shared users and single sign-on**, which you would have to add yourself.
- **On-demand site creation** from a template, which needs scripting.

The second list is mostly solvable with tooling. WP-CLI can update plugins across many installs from one script, a shared starter theme or plugin bundle keeps sites consistent, and a deployment pipeline can roll changes out site by site, so a bad update stops at the first failure instead of hitting everyone. The first list is structural. That asymmetry is why separate installs are my default when in doubt.

## If you inherited a network, don't break it up by reflex

A network that is working is not a problem just because it is a network. If the sites still share an owner and a plugin set, I would rather harden it: fewer plugins, staged updates on a copy of the network, backups that can restore a single site, and super admin rights limited to the people who really need them.

I recommend splitting a network when the reasons above start showing up as real costs: plugin requests that only one site wants, one site's traffic hurting the others, or a site that needs to move to another team or host. Then I move the sites that have diverged out one at a time, and leave the ones that still belong together.

## What I check on a project like this

1. **Ownership.** Will one team own every site, its plugins and its updates for the next few years?
2. **Plugin overlap.** Do the sites need the same plugins? If most plugins are used by only one site, that is a strong signal against multisite.
3. **Traffic shape.** Is any site much busier than the rest, or likely to run sales and campaigns that would load the shared server?
4. **Exit plan.** If one site has to leave the network, do we know how, and roughly how long it would take?
5. **WooCommerce expectations.** Does anyone expect shared stock, a shared catalog or a shared cart? If so, multisite alone won't provide it.
6. **Network-aware code.** Do custom plugins handle network activation, new sites, `switch_to_blog()` restores and network options correctly?
7. **Hosting support.** Does the host support multisite, domain mapping and SSL for every mapped domain?
8. **Blast radius.** Who has super admin, and how are updates staged before they reach every site?

My verdict: multisite still makes sense when sameness is the goal. If the sites are one product, run by one team, on one plugin set, a network saves real time and gives you governance for free. If the sites only look similar today, separate installs plus good automation cost a little more effort upfront and save you from a migration later. It is the same question as choosing a tenancy model for a SaaS, which I went through in [Laravel multi-tenancy: one database, schemas, or one per tenant?](/article/laravel-multi-tenancy-single-database-schema-or-database-per-tenant/): decide where the wall between sites should sit before you build, because moving it afterwards is the expensive part.
