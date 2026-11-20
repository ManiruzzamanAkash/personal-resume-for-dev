---
title: "The first week on a legacy WordPress codebase: my audit routine"
slug: first-week-legacy-wordpress-codebase-audit-routine
date: 2026-11-20
category: WordPress
excerpt: "Inheriting a WordPress site nobody fully understands is risky in the first week, because every change is a guess. Here is the audit routine I run before touching code, so the first fix is safe and the plan is based on facts."
readTime: 10 min
tags: [wordpress, legacy-code, code-audit, wp-cli, agency, maintenance, architecture]
---

# The first week on a legacy WordPress codebase: my audit routine

> **In short**
> - **The problem:** when a team inherits an old WordPress site, nobody knows which plugins matter, what runs in the background, or what breaks if you update. The first "small fix" often takes the site down, and the client loses trust and sales in the same afternoon.
> - **What I do about it:** I spend the first week reading before writing. I map how the site is built, run, deployed and backed up, write it down in one short document, and only then propose changes in order of risk.
> - **Who this is for:** agencies taking over a client site, in-house teams inheriting a WordPress codebase, and founders who want to know what a new engineer should do in week one.

The call usually starts the same way. "The previous developer is gone. The site works, mostly. Can you add one feature and fix the slow checkout?" Somebody hands over a hosting login, maybe a Git repository, maybe a zip file.

The tempting move is to start on the feature. It is also the move that causes most of the outages I hear about. A plugin update pulls in a breaking change. A "cleanup" deletes a file that a cron job needed. A theme edit made over FTP is overwritten by the next deploy because the live server and the repository were never the same thing.

Legacy WordPress is rarely bad code everywhere. It is unknown code in a few critical places. The goal of week one is to find those places before they find you.

## Day one is about access and a safe copy, not code

Before reading a single file, I make sure I can undo anything.

- **Confirm access I actually need:** hosting panel, SSH or SFTP, the database, DNS, the domain registrar, any CDN, payment gateway dashboards and email-sending service. Missing access is the most common week-one blocker, and it is better discovered on Monday than during an incident.
- **Take my own backup** of files and database, stored somewhere I control, and check that it restores. A backup that has never been restored is a guess.
- **Build a local or staging copy** from that backup. Every command in this article runs there first.

On a staging copy of a store, I also make sure it cannot email real customers or charge real cards: disable outgoing mail or route it to a catch-all inbox, and put payment gateways in test mode. Staging environments that quietly send order emails are a classic way to start a relationship badly. I wrote more about why staging lies in [production debugging for WordPress plugins](/article/production-debugging-wordpress-plugins-staging-lies/).

## The truth is on the server, so I check what differs from the repository

The first question is whether the code in Git is the code that is running. On legacy sites, it often isn't.

WP-CLI (WordPress's command-line tool) gives me a fast answer for the parts that come from WordPress.org:

```bash
# Core files that differ from the official release
wp core verify-checksums

# Plugins from WordPress.org that differ from their published version
wp plugin verify-checksums --all
```

Any modified core file or plugin file is a finding. Sometimes it is a hotfix someone made in production and never wrote down. Sometimes it is malware. Either way, it changes what "update the plugin" means, because updating would silently remove that edit.

Checksums only cover code published on WordPress.org. For premium plugins, the custom theme and custom plugins, I compare the live files against the repository directly (`diff -r` or a fresh `git status` after copying the live tree over a clean checkout). If there is no repository at all, creating one from the live files is the first commit I make.

## The plugin list is the architecture

On a typical inherited site, most of the behavior lives in plugins, not in the theme. So I treat the plugin list as the system diagram.

```bash
wp plugin list --fields=name,status,version,update_version
wp theme list
wp plugin list --status=must-use
wp plugin list --status=dropin
```

For each active plugin I write one line: what it does for the business, who pays for its license, and whether it has an update waiting. Must-use plugins and drop-ins (files such as `object-cache.php` or `advanced-cache.php` in `wp-content`) deserve extra attention, because they load before everything else and are easy to forget during a migration.

Inactive plugins go on a removal list, but I don't delete them in week one. I just note them. The signs that a site needs a proper plugin review are the same ones I listed in [9 signs your WordPress site needs a plugin audit](/article/wordpress-site-needs-plugin-audit-not-another-plugin/); this is where I collect the evidence for that conversation.

## Background jobs explain most "it just happens sometimes" bugs

Legacy sites usually have work running that nobody remembers scheduling: exports, feed imports, stock syncs, emails, cache warmers. When a client says a problem happens "randomly," this is where I look first.

```bash
wp cron event list --fields=hook,next_run_relative,recurrence
```

I check three things. Is WP-Cron triggered by real traffic or by a server cron job? (If `DISABLE_WP_CRON` is set in `wp-config.php`, something else must call it, and I want to find that something.) Are there hooks whose next run is far in the past, which means they are failing or never firing? And on WooCommerce sites, what does the Action Scheduler queue look like under **Tools → Scheduled Actions**: how many pending and failed actions, and which hooks they belong to. A large pile of failed actions is often the real cause of a "slow admin" complaint. I covered how to design those jobs well in [Action Scheduler patterns for WooCommerce plugins](/article/action-scheduler-patterns-woocommerce-plugins/).

## The database tells you what the code forgot

Old sites collect data the way old houses collect boxes. I look at the database with two questions: what is unusually large, and what loads on every request.

```bash
wp db size --tables
```

Unexpectedly large tables usually point to a logging plugin, an abandoned analytics tool, session data, or revisions that were never limited. Then I check autoloaded options, which WordPress reads on every page load:

```sql
SELECT option_name, LENGTH(option_value) AS bytes
FROM wp_options
WHERE autoload IN ('yes', 'on', 'auto', 'auto-on')
ORDER BY bytes DESC
LIMIT 20;
```

The list of autoload values matters: since WordPress 6.6, the column can hold `on`, `off`, `auto`, `auto-on` and `auto-off` as well as the older `yes` and `no`, so a query that only checks `yes` misses rows. Site Health also has a check for autoloaded options in recent versions. A large serialized option from a plugin that was deleted years ago is one of the most common, cheapest performance wins on an inherited site. I write it down now and remove it later, with a backup, as a deliberate change.

On WooCommerce stores I also note whether High-Performance Order Storage is enabled and whether sync with the old posts tables is on, because that decides how every order query in custom code should be written.

## Custom code gets read for risk, not style

Only now do I open the custom theme and custom plugins. I am not reviewing formatting. I am looking for the places where a mistake would cost money or data:

- **Payment, checkout and order hooks.** Anything hooked into WooCommerce order status changes, payment completion or webhooks. These need tests before anyone touches them.
- **Direct database queries.** `$wpdb` calls without `prepare()`, queries against `wp_posts` that assume orders live there, or queries in loops.
- **Input handling.** AJAX and REST endpoints without capability checks or nonces, and output printed without escaping. A quick search for `wp_ajax_nopriv_`, `register_rest_route` and `permission_callback` finds most of the entry points.
- **Hardcoded environment values.** API keys, URLs and email addresses in code instead of configuration.
- **Edits to third-party code.** A modified copy of a plugin inside the theme, or a template override that is many versions behind the plugin it overrides. WooCommerce shows outdated template overrides on the **WooCommerce → Status** screen.

I keep a running list with file and line for each finding, tagged by risk: "could lose orders," "could leak data," "slow," or "untidy." Only the first two get attention in week one.

## Deploys and backups are part of the codebase

A site with clean code and no deploy process is still fragile. I write down, in plain words, how a change reaches production today: FTP, a host's Git integration, a CI pipeline, or "the old developer did it." I also record where backups go, how often they run, how long they are kept, and when one was last restored.

If the answer to "how do we deploy" is "upload files over FTP," I don't change it in week one. I just make sure the next change goes through Git, so the repository becomes the source of truth from that point forward.

## The output is a short map and a risk-ordered plan

At the end of the week I hand over one document, usually two or three pages. It has:

1. A one-paragraph description of how the site works, for someone non-technical.
2. The plugin map: what each active plugin is for.
3. Background jobs and integrations, with what happens if each one stops.
4. Findings, grouped by risk, each with a proposed fix and a rough size.
5. A proposed order of work: safety first (backups, access, repository), then data and payment risks, then performance, then the feature that was originally requested.

That last point is the hard conversation. The client asked for a feature, and I am suggesting some groundwork first. Showing the actual findings usually makes this an easy decision. "Two plugins have been edited on the server and updating them would undo those edits" is a concrete reason, not a sales pitch.

## Trade-offs: when a full week is too much

This routine is not free, and it is not always the right call.

- **A real emergency comes first.** If the site is down or hacked, I fix the immediate problem with the backup in hand, then do the audit. The audit is for calm weeks.
- **Small brochure sites don't need a week.** A site with five plugins, no store and no custom code can be mapped in an afternoon. I scale the routine to the risk, not to a calendar.
- **Some clients will only pay for the feature.** Then I do a shorter version focused on the area the feature touches, plus backups and the repository check, and I say clearly in writing what was not reviewed.
- **Audits go stale.** The document is accurate on the day it is written. If nobody updates it after the next big change, it becomes another legacy artifact. I keep it in the repository next to the code, so it gets changed in the same pull request as the thing it describes.

The risk on the other side is "audit forever." A week of reading with no shipped change can make a client nervous. I usually ship one small, safe, visible fix during the week, such as removing a broken cron hook or fixing a broken email, so there is progress they can see.

## What I check on a project like this

1. **Access and backups:** I have every login I need, and I have restored my own backup to a staging copy.
2. **Staging is safe:** outgoing email is captured and payment gateways are in test mode.
3. **Live matches the repository:** `wp core verify-checksums` and `wp plugin verify-checksums --all` are clean, or every difference is explained.
4. **Plugin map:** every active plugin, must-use plugin and drop-in has a known purpose and owner.
5. **Background work:** WP-Cron, server cron and Action Scheduler queues are understood, with no silent failures.
6. **Database health:** large tables and large autoloaded options are listed, with a removal plan.
7. **Risky custom code:** payment hooks, raw queries and unauthenticated endpoints are listed with file and line.
8. **Written plan:** a short document with findings ordered by risk, agreed with the client before the feature work starts.

My verdict: the first week on a legacy WordPress site decides whether the engagement goes well. Spending it on understanding instead of shipping feels slow, but it turns every later change from a guess into a decision, and it gives the client a clear, honest picture of what they own. The feature they asked for still gets built, just on a site where everyone knows what it will touch.
