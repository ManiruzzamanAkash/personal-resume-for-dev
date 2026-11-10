---
title: "9 signs your WordPress site needs a plugin audit, not another plugin"
slug: wordpress-site-needs-plugin-audit-not-another-plugin
date: 2026-11-10
category: WordPress
excerpt: "When a WordPress site gets slow, fragile or scary to update, the usual fix is one more plugin. Here are nine signs the real fix is an audit, and the routine I use to decide what stays, what goes, and what gets replaced."
readTime: 10 min
tags: [wordpress, plugins, plugin-audit, performance, security, maintenance, woocommerce, agency]
---

# 9 signs your WordPress site needs a plugin audit, not another plugin

> **In short**
> - **The problem:** most WordPress sites that feel slow, break on updates, or get hacked are not short of plugins. They have too many, nobody knows why half of them are there, and each new problem gets solved by installing one more.
> - **What I do about it:** stop adding, list every active plugin with an owner and a reason, measure what each one costs, then remove, replace or consolidate. An audit is usually a few days of work; the plugin pile took years.
> - **Who this is for:** store owners, agencies and in-house teams running a WordPress or WooCommerce site that has been live for a couple of years and passed through more than one developer.

The pattern I see most often goes like this. The site is slow, so someone installs a caching plugin. The caching plugin breaks the cart, so someone adds an exclusion plugin. The admin is slow, so someone installs a "database optimizer." A form stops sending email, so an SMTP plugin goes on top. Two years and three developers later, the plugins screen has fifty entries and nobody can say which ones are safe to touch.

None of those decisions was stupid on its own. Each one fixed the symptom in front of it. The cost is cumulative: every plugin runs code on requests, adds options to the database, hooks into things other plugins also hook into, and is one more vendor whose update can take the site down.

Adding a plugin is the cheapest decision on day one and the most expensive one to reverse later. That is why the fix for a plugin-shaped problem is often fewer plugins, not a better one.

## Sign 1: nobody can say why a plugin is installed

Open the plugins screen and ask, for each active plugin: what does it do on this site, who asked for it, and what breaks if it goes? If the honest answer for several of them is "not sure," the site is being run on archaeology.

This is the root sign. Every other sign on this list gets worse when nobody owns the inventory. A plugin without a known purpose cannot be safely updated, replaced or removed, so it just stays forever.

## Sign 2: two or more plugins do the same job

Overlap is common and quietly expensive: two SEO plugins both printing meta tags, a page builder plus a block library plus an "addons" pack for the builder, three plugins that each add custom CSS, or a security plugin and a firewall plugin both scanning files on a schedule.

Duplicates do more than waste resources. They fight. Two plugins writing the same `<title>` tag or both minifying the same script produce bugs that look random because they depend on load order.

## Sign 3: updates are postponed because "last time it broke"

When a team stops updating plugins because an update once broke checkout, the site has traded a visible risk for an invisible one. Outdated plugins are a common way WordPress sites get compromised, and public vulnerability databases (WPScan, Wordfence Intelligence, Patchstack) list issues by plugin and version, so an attacker does not have to guess.

The real problem is not the update. It is that there is no staging copy to test it on and no record of which plugins are risky. An audit fixes the inventory so updates become routine again. I wrote about why staging environments lie and how to make them less misleading in [production debugging for WordPress plugins](/article/production-debugging-wordpress-plugins-staging-lies/).

## Sign 4: a plugin is abandoned, closed, or nulled

Check every plugin's source. On WordPress.org, look at the last update date and whether the listing has been closed; a closed listing often means an unresolved security issue. For commercial plugins, check whether the license is active and the vendor still ships updates.

Two cases need action immediately, not at the next audit:

- **Nulled plugins** (paid plugins downloaded from an unofficial site). These are a well-known way malware gets onto WordPress sites. Remove them and buy the real thing or replace it.
- **Plugins closed for security reasons.** Replace them, because a fix may never come.

When I led a security-hardening pass across plugins at weDevs, most of the work was not clever. It was finding the unsafe patterns that had piled up over time and closing them one by one. Sites accumulate the same kind of debt, just across vendors instead of inside one codebase.

## Sign 5: the admin is slow even when the front end is cached

Page caching hides front-end slowness from visitors, so the admin is where a heavy plugin stack shows itself. If saving a post, opening the orders screen, or loading the dashboard takes several seconds, plugins are usually doing work on every admin request: remote license checks, dashboard widgets that call APIs, notices that query the database, or settings pages that load everywhere instead of only on their own screen.

Query Monitor shows this quickly: queries and HTTP calls per request, grouped by the plugin that made them. A plugin making an external HTTP call on every admin page load is a finding on its own.

## Sign 6: autoloaded options keep growing

WordPress loads every option marked "autoload" on every request, front end and admin. Plugins add options and often leave them behind after they are deleted. Recent WordPress versions include a Site Health check that warns when the total autoloaded size gets large, which makes this easy to spot.

A quick query lists the worst offenders:

```sql
SELECT option_name, LENGTH(option_value) AS bytes
FROM wp_options
WHERE autoload IN ('yes', 'on', 'auto-on', 'auto')
ORDER BY bytes DESC
LIMIT 20;
```

The option names usually tell you which plugin wrote them, including plugins that were removed years ago. This was one of the checks in [why WooCommerce checkout slows down after 50K orders](/article/why-woocommerce-checkout-slows-down-after-50k-orders/), and it applies to any WordPress site, not just stores.

## Sign 7: a plugin is doing a one-line job

A surprising share of plugins on most sites exist to do something tiny: add a tracking snippet, disable comments, change the login logo, add one custom post type, redirect one URL. Each brings an update cadence, a settings page, and sometimes upsell notices.

These are good candidates to move into a small site-specific plugin (a "must-use" plugin in `wp-content/mu-plugins/` or a regular plugin the team owns), where a few lines of code replace a vendor dependency. The point is not that custom code is always better. It is that one well-understood file the team controls is cheaper to own than ten unrelated vendors.

## Sign 8: errors in the logs that nobody reads

Turn on logging (`WP_DEBUG_LOG` on staging, or your host's PHP error log in production) and look at a day of output. Deprecation notices, warnings about undefined array keys, and fatal errors from a plugin that only runs on one screen all show which plugins are not keeping up with current PHP and WordPress versions.

A noisy log is also a practical problem: real errors get lost in it. A plugin that writes hundreds of warnings a day is telling you it is not maintained carefully.

## Sign 9: every new requirement starts with "is there a plugin for that?"

This is a process sign, not a technical one. When the first response to any request is to search the plugin directory, nobody is weighing the long-term cost. Plugins are a great way to buy functionality. They are a poor way to make architecture decisions.

The healthy version is a short rule: a new plugin needs a reason, an owner, and a check that nothing already installed does the job. Agencies and in-house teams that have that rule rarely need a big audit. In the [senior engineer vs agency](/article/senior-wordpress-engineer-vs-agency/) piece I described this as the "someone who says no" part of ownership.

## The audit routine: inventory, measure, decide

When several of these signs show up, this is the routine I follow. It works on a copy of production, never on the live site.

1. **Inventory.** Export the plugin list with versions, source (WordPress.org, vendor, custom), last update date, and license status. WP-CLI makes this a one-liner: `wp plugin list --format=csv`.
2. **Assign a reason and an owner** to every active plugin. Anything without one goes on a "candidate to remove" list.
3. **Measure the cost.** Profile a few representative pages (home, product, cart, checkout, a heavy admin screen) and attribute queries, HTTP calls and time to plugins. Check autoloaded options and the error log.
4. **Check the risk.** Look each plugin and version up in a public vulnerability database. Flag abandoned, closed and nulled ones.
5. **Decide per plugin:** keep, update, replace, consolidate, or remove. Write down the reason.
6. **Remove in small batches** on staging, with a test pass over the paths that make money (checkout, forms, logins). Then repeat in production during a quiet period.
7. **Clean up leftovers.** Orphaned options, tables and scheduled events that removed plugins left behind, after confirming nothing still uses them.

The decision step matters most. Removing plugins is not the goal; a site with forty well-chosen, maintained plugins can be healthier than one with fifteen bad ones.

## When not to do this

An audit is not always the right next step, and parts of it can do damage if rushed.

- **Do not audit the week before a sale or launch.** Removing plugins changes behavior in ways tests miss. Do it when there is time to watch the site afterwards.
- **Do not deactivate plugins on the live site to "see what happens."** Some plugins (memberships, subscriptions, multilingual, page builders) leave content broken or locked when deactivated, and some run destructive cleanup on uninstall. Test on a copy.
- **Do not delete a plugin's data just because the plugin looks unused.** Old order notes, form entries and redirects can be business records or SEO-critical. Confirm with whoever owns that data first.
- **Do not replace a mature plugin with custom code out of principle.** A well-maintained plugin for payments, security or SEO usually beats something written in-house that nobody will maintain. Custom code wins for small, stable jobs, not for complex, moving ones.
- **If the site is a short-lived campaign page,** the effort is rarely worth it. Audits pay off on sites that will keep running and changing.

## What I check in a plugin audit

1. Every active plugin has a written reason and an owner, and inactive plugins are removed rather than left installed.
2. No two plugins do the same job (SEO, caching, security, builders, custom CSS).
3. Each plugin's last update date, source and license status, with abandoned, closed and nulled plugins flagged.
4. Every installed version checked against a public vulnerability database.
5. Queries and external HTTP calls per request, attributed to plugins, on key front-end pages and the slowest admin screen.
6. Total autoloaded options size and the largest entries, including leftovers from removed plugins.
7. A day of PHP error logs, grouped by plugin.
8. A staging copy where updates and removals are tested before production.

A WordPress site that feels slow, fragile or risky is usually not missing a plugin. It is carrying years of decisions nobody wrote down. An audit turns that pile back into a list someone owns: what each plugin is for, what it costs, and whether it still earns its place. Most sites come out of it with fewer plugins, faster admin screens, and updates the team is no longer afraid to run, and the habit of asking "what does this cost us?" before the next install keeps it that way.
