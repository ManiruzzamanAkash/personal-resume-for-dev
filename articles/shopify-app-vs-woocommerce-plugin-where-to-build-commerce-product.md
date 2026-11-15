---
title: "Shopify app or WooCommerce plugin: where to build a commerce product"
slug: shopify-app-vs-woocommerce-plugin-where-to-build-commerce-product
date: 2026-11-15
category: WooCommerce
excerpt: "Building a commerce product to sell to merchants means choosing who controls your billing, your updates and your support load. Here is how I decide between a Shopify app, a WooCommerce plugin, and selling it yourself with SureCart."
readTime: 9 min
tags: [woocommerce, shopify, surecart, plugin-business, shopify-apps, saas, founders, ecommerce]
---

# Shopify app or WooCommerce plugin: where to build a commerce product

> **In short**
> - **The problem:** founders who want to sell a tool to online stores often pick a platform by market size alone. The platform also decides how you bill, how you ship updates, what you host, and who your support tickets are really about. Get that wrong and the product works but the business doesn't.
> - **What I do about it:** I match the product to the platform's delivery model. Hosted, data-heavy, subscription-first tools go to Shopify. Tools that need to change how the store itself behaves go to WooCommerce. If it's a WordPress plugin, I sell it from my own site with licensing, and use a marketplace only for reach.
> - **Who this is for:** founders, agencies and product engineers planning their first commerce app or plugin, or a second platform for one that already works.

A common version of this mistake looks like this. A team builds a WooCommerce extension that works well for its first customers, sees how big the Shopify App Store is, and decides to "port it." Six months later they've rebuilt the product as a hosted service with its own servers, background workers, uptime monitoring and a GDPR process. Almost nothing carried over except the idea.

The reverse happens too. A team with a hosted SaaS assumes a WordPress plugin is "just a thin connector." Then they find out it has to run on thousands of hosting setups they don't control, beside plugins they have never heard of, on PHP versions they would never pick.

I have shipped commerce code on both sides. At Paysera I worked on the payment gateway's WooCommerce, Shopify and Magento integrations. At weDevs I worked on Dokan's checkout and vendor-payout modules. Today I work on SureCart's core engineering. The lesson that keeps coming back is simple: **the platform you build on is a business model, not just an API.**

## A Shopify app is a SaaS you host, with Shopify in charge of billing

On Shopify you don't install code on the merchant's store. You run a web application on your own infrastructure. The merchant installs it through OAuth. Your app reads and writes store data through Shopify's APIs and shows its screens inside the Shopify admin.

That has consequences most first-time teams underestimate:

- **You own production.** Servers, queues, webhook processing, retries and uptime are yours. When your app is down, it's down for every merchant at once.
- **Shopify controls the payment relationship.** Shopify's App Store requirements say an app must use Shopify App Pricing or the Billing API for all app charges. Apps that bill off-platform can't be listed in the App Store unless Shopify says otherwise. You don't get to run your own Stripe checkout for App Store customers.
- **The API surface is chosen for you.** Since April 2025, new public apps submitted to the App Store have had to use the GraphQL Admin API rather than REST. Embedded apps must use session tokens and the current App Bridge.
- **Revenue share is real but forgiving early.** Under the Partner Program terms that took effect in June 2025, the first $1 million of lifetime revenue is exempt. After that, Shopify takes 15%. The exemption is counted per partner, across all of a partner's apps, and no longer resets every year.

What you get in return is a lot. Every store runs the same platform version. Every merchant has a payment method already on file. And discovery happens inside the admin the merchant already uses every day. You support one environment, not ten thousand.

## A WooCommerce plugin runs inside the merchant's server, so their server becomes your problem

A WooCommerce extension is PHP that runs inside the merchant's WordPress site, in the same process as their theme and every other plugin. That is the platform's biggest strength and its biggest cost.

The strength is reach into the store itself. A plugin can change checkout rules, add order statuses, replace how prices are calculated, write to its own database tables, and hook into almost any step of the order lifecycle. Marketplaces like Dokan are only possible because of this: a vendor-payout system has to sit inside order processing, not watch it from outside through webhooks.

The cost is that you inherit every environment you run in:

- **Hosting you didn't choose.** Different PHP versions, memory limits, object caches, cron that only runs on page loads, and security plugins that block your REST routes.
- **Conflicts you didn't write.** The support ticket says "your plugin broke checkout." The cause is often another plugin, a theme override or a caching rule. You still have to find it.
- **Platform changes you must keep up with.** Order data moving to HPOS (custom order tables) and checkout moving to blocks both meant extension authors had to rework real code. I covered the order side in [HPOS-ready WooCommerce plugins](/article/hpos-ready-woocommerce-plugins-data-access/).

On billing, you have options. The official Woo Marketplace's own docs describe a revenue share with 70% of sales going to the vendor. It also reviews products before listing and expects ongoing support. Or you can sell from your own site and keep the customer relationship. Many plugin businesses also ship a free version on WordPress.org for discovery and sell an add-on.

## Selling a WordPress plugin yourself is a licensing problem, and SureCart is one way to solve it

If you go the WooCommerce route and sell directly, the product you need isn't a store. It's a license server. You need to issue keys, limit activations per site, deliver updates only to paying customers, and handle renewals that fail.

This is where SureCart fits the decision. I should be clear about my bias: I work on SureCart's core engineering. Its licensing add-on covers this case. You add a `release.json` file to the plugin, include SureCart's WordPress SDK, and the SDK provides a license settings page inside the customer's admin. SureCart handles update checks and downloads, so your own site doesn't serve every update request. Other tools in the WordPress world solve the same problem. Whichever you choose, the point is the same: **selling a plugin directly means running subscriptions and update delivery as part of your product.** Budget for it.

SureCart isn't a third app marketplace in this comparison. It's the storefront and billing layer for the "sell it yourself" path.

## The product's shape usually makes the decision

Instead of starting with "which market is bigger," I ask what the product actually has to do.

| If the product… | It belongs |
| --- | --- |
| Is mostly analytics, email, reviews, search or AI over store data | Shopify app (or a hosted SaaS with a thin connector for both) |
| Has to change checkout, pricing, tax or order logic deeply | WooCommerce plugin |
| Needs heavy background compute or third-party API calls per order | Hosted service; on Woo, keep the plugin a thin client |
| Must keep merchant data on the merchant's own server | WooCommerce plugin |
| Is a marketplace, membership or B2B workflow layered on orders | WooCommerce plugin |
| Needs recurring revenue from day one with minimal billing work | Shopify app |

The middle path deserves its own mention. If most of the value is a hosted service (an AI feature, a sync engine, a reporting backend), build the service once. Then write a Shopify app and a small WordPress plugin that both talk to it. That is roughly how payment gateways work. The heavy logic lives on the provider's side, and each platform gets an integration that follows its own rules. I wrote about that kind of integration in [building the Paysera payment gateway](/article/building-paysera-payment-gateway-10k-merchants/).

## The support load looks different on each platform

Founders tend to budget for development and forget support. The two platforms create very different queues.

On Shopify, most tickets are about your app's behavior or your service's availability. The environment is the same everywhere, so you can usually reproduce a bug.

On WooCommerce, a large share of tickets are about the merchant's environment. Expect to ask for system status reports, test with other plugins turned off, and explain caching. That is engineering time, and it grows with your install count. The plugins that hold up best keep their footprint small. They store their own data in their own tables, move slow work to background jobs, and fail loudly when the environment can't support them. I wrote about the background-job side in [Action Scheduler patterns for WooCommerce plugins](/article/action-scheduler-patterns-woocommerce-plugins/).

## Trade-offs, and when not to do this

- **Don't port; rebuild on purpose.** A Shopify app and a WooCommerce plugin share an idea, not a codebase. Plan the second platform as a new product with a shared core service, not as a translation.
- **Don't build on Shopify if the product needs to own checkout logic.** Shopify gives apps defined extension points. If your value depends on rewriting how orders work, you will be fighting the platform.
- **Don't build on WooCommerce if you can't fund support.** A cheap plugin with a heavy support load loses money one ticket at a time.
- **Don't treat the 15% or the 30% as the main cost.** Hosting, support and keeping up with platform changes usually cost more than the platform's cut, especially early.
- **Don't launch on both at once.** Prove the product on one platform, then design the second one from what you've learned.
- **Check the terms yourself before you commit.** Revenue shares, listing rules and API requirements change. The numbers here come from the platforms' published docs as of this writing.

## What I check before building a commerce product

1. Does the core value need to run inside the store, or can it run beside it as a service?
2. Who will bill the merchant, and does that platform allow the billing model I want?
3. Who runs production: me (Shopify, hosted service) or thousands of hosts I don't control (WooCommerce)?
4. Which platform changes are coming that would force a rework (API versions, order storage, checkout blocks)?
5. How will paid updates reach customers, and how are licenses and activations enforced?
6. What will a typical support ticket look like, and who on the team answers it?
7. If a second platform comes later, which parts sit in a shared service and which are platform-specific?
8. What does the platform's revenue share cost at my target revenue, compared with hosting and support?

My default is to let the product's shape pick the platform. If the value lives in data and a hosted service, I build a Shopify app and keep WooCommerce as a thin connector to the same backend. If the value is changing how the store itself behaves, I build a WooCommerce plugin. I keep it small and well-behaved, and I sell it with proper licensing from my own site. If you pick by market size first, you end up with a product that fits one platform's business model and runs on the other's.
