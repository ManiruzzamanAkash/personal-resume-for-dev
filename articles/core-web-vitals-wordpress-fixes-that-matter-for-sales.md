---
title: "Core Web Vitals on WordPress: the fixes that matter for sales"
slug: core-web-vitals-wordpress-fixes-that-matter-for-sales
date: 2026-11-27
category: WordPress
excerpt: "Most WordPress speed work chases a Lighthouse score while real shoppers still wait on product pages. Here is how I audit Core Web Vitals from field data, and the handful of fixes that move the pages where money is made."
readTime: 11 min
tags: [wordpress, core-web-vitals, performance, woocommerce, lcp, inp, ecommerce, agency]
---

# Core Web Vitals on WordPress: the fixes that matter for sales

> **In short**
> - **The problem:** a WordPress store can score 95 in a lab test and still feel slow to real customers on phones, because the score measures one page on a fast machine while shoppers wait on product, category and cart pages. Slow, jumpy pages cost attention at exactly the moment someone is deciding to buy.
> - **What I do about it:** start from real-user data, rank the templates that make money, and fix the few causes that usually dominate: a slow server response, a hero image loaded too late, layout that shifts as things load, and too much JavaScript fighting for the main thread.
> - **Who this is for:** WordPress and WooCommerce store owners, and the agencies running their sites, who have "fix site speed" on the list and want to know where the effort pays off.

The version of this I see most often: someone runs PageSpeed Insights on the homepage, gets a red score, installs an optimization plugin, turns on every checkbox, and gets a green score. A week later the cart is broken for some visitors, the mobile menu stops responding, and Search Console still says most product URLs are "Poor."

Nothing about that is unusual. The homepage was never the problem, the lab score was never the measure that counts, and "minify and defer everything" fixes a symptom while creating new bugs.

Core Web Vitals are Google's three user-experience metrics: how fast the main content appears, how quickly the page responds to a tap, and how much the layout jumps around. They are worth caring about, but only if you measure the right pages and fix the causes in the right order.

## The score that matters comes from real visitors, not Lighthouse

There are two kinds of performance data, and mixing them up wastes most speed projects.

**Lab data** is a single simulated load: Lighthouse, the top half of PageSpeed Insights, or a test run from your laptop. It is great for debugging, because it is repeatable and shows you a waterfall.

**Field data** is what real Chrome users experienced over the last 28 days, collected in the Chrome UX Report (CrUX). It is what Search Console's Core Web Vitals report and the "Discover what your real users are experiencing" section of PageSpeed Insights show. Field data is assessed at the 75th percentile, so a page passes only if three out of four visits are good.

The current thresholds for "good" are:

| Metric | What it measures | Good at p75 |
| --- | --- | --- |
| **LCP** (Largest Contentful Paint) | When the main image or heading appears | ≤ 2.5 s |
| **INP** (Interaction to Next Paint) | How fast the page responds to taps and clicks | ≤ 200 ms |
| **CLS** (Cumulative Layout Shift) | How much content jumps while loading | ≤ 0.1 |

INP replaced the older First Input Delay metric in March 2024. If an agency report still talks about FID, it is out of date.

I start every audit in Search Console, not Lighthouse. It groups URLs that behave alike, which on WordPress almost always means "URLs using the same template." That grouping is the map for everything else.

## Fix templates, not URLs, and start where the money is

A WordPress site is a small number of templates rendered thousands of times. On a store that usually means: homepage, category (product archive), single product, cart, checkout, and blog post. Fixing the product template once fixes every product.

So I rank templates by two things: how much traffic arrives there, and how close that page is to a purchase. On most stores the single product page and the category page carry both. The homepage gets attention because owners look at it, not because customers convert there.

Two practical consequences:

- **Test a real product, not a demo one.** Pick a product with a gallery, variations, reviews and a long description, because that is what customers see.
- **Test on a mid-range phone profile.** Desktop numbers on a fast connection hide most of the problem.

Cart and checkout are a separate case. They are usually not cached, so they depend on raw server speed. I wrote about why that path degrades on large stores in [why your WooCommerce checkout slows down after 50K orders](/article/why-woocommerce-checkout-slows-down-after-50k-orders/).

## Slow LCP is usually the server or a late hero image

When LCP is poor, the cause is almost always one of two things, and you can tell which from a single waterfall.

**The HTML arrives late.** If Time to First Byte (the wait before the first byte of HTML) is already over a second, no front-end trick will rescue LCP. On WordPress this means the page is not served from a full-page cache, or the cache is being bypassed (a cookie set on every visitor, a query string, a logged-in customer), or the uncached render is slow because of heavy plugins and queries. The fix lives on the server: a working page cache, a persistent object cache for the requests that cannot be page-cached, and a PHP-FPM and Nginx setup sized for the traffic. My notes on that are in [tuning Nginx and PHP-FPM on a VPS before traffic hurts](/article/nginx-php-fpm-vps-tuning-before-traffic-hurts/).

**The hero image is discovered too late.** The LCP element on a product page is usually the main product image. It is slow when:

- it is lazy-loaded, so the browser deliberately waits before fetching it;
- it is injected by a JavaScript slider, so the browser cannot see it until scripts run;
- it is a CSS background image, which the browser finds later than an `<img>`;
- it is a 2,000-pixel original served to a 400-pixel phone screen.

WordPress core already helps: it adds `loading="lazy"` to images by default, avoids it for images it expects near the top of the page, and since WordPress 6.3 adds `fetchpriority="high"` to the image it guesses is the LCP. Themes and page builders often defeat this by rendering the hero through their own markup or a slider. The check is simple: in the page source, the main product image should be a plain `<img>` with `srcset`, without `loading="lazy"`, ideally with `fetchpriority="high"`.

When a theme gets it wrong, I fix it at the template level rather than with another plugin:

```php
// Make sure the main product image is never lazy-loaded and is fetched early.
add_filter( 'wp_get_attachment_image_attributes', function ( $attr, $attachment ) {
    if ( ! is_product() ) {
        return $attr;
    }

    $product = wc_get_product( get_queried_object_id() );

    if ( $product && (int) $product->get_image_id() === (int) $attachment->ID ) {
        $attr['loading']       = 'eager';
        $attr['fetchpriority'] = 'high';
    }

    return $attr;
}, 10, 2 );
```

Ten lines, scoped to one template, easy to delete later. That is the shape I want for performance fixes.

## Layout shift comes from things the theme did not reserve space for

CLS is the metric customers feel as "I tapped the wrong button." On WordPress stores the usual causes are:

- **Images without dimensions.** If `width` and `height` are missing, the browser cannot reserve space. Core outputs them for images inserted normally; custom theme code and builders sometimes drop them.
- **Banners that appear after load.** Cookie notices, "free shipping over X" bars and promo strips injected at the top of the page push everything down. Render them in the HTML with reserved space, or overlay them instead of inserting them.
- **Web fonts swapping in.** A fallback font with very different metrics makes text reflow when the real font arrives. Preloading the one or two fonts used above the fold, and limiting font weights, helps.
- **Price and stock fragments.** Content loaded by AJAX after the page renders, such as cart counts, currency switchers or "only 3 left" badges, shifts layout if it has no fixed space.

The fastest way to find them is the Performance panel in Chrome DevTools with layout-shift regions highlighted, on the real product template.

## Poor INP means too much JavaScript, usually from plugins

INP is the metric WordPress sites struggle with most now, because it measures what happens after the page looks ready. A shopper taps "Add to cart" or opens a variation dropdown, and the browser is busy running scripts, so nothing happens for half a second.

The pattern I see most often is not one heavy script. It is many plugins each loading their JavaScript on every page: sliders on pages with no slider, form scripts on pages with no form, chat widgets, analytics and tag-manager containers with years of accumulated tags, and page-builder runtimes for a few animations.

What helps, in order:

1. **Stop loading what the page does not use.** Dequeue plugin scripts on templates that do not need them. This is usually the biggest win and the least risky.
2. **Audit third-party tags.** Every pixel in the tag manager runs on the main thread. Remove the ones nobody reads reports from.
3. **Delay non-essential widgets until interaction.** Chat and review widgets can load after the first scroll or tap.
4. **Check your own handlers.** Variation forms and mini-cart updates that re-render large chunks of DOM on every change are a common source of slow interactions in custom themes.

This is the same inventory problem described in [9 signs your WordPress site needs a plugin audit](/article/wordpress-site-needs-plugin-audit-not-another-plugin/): you cannot fix INP on a site where nobody knows why each plugin is there.

## Optimization plugins help, but "everything on" breaks stores

Caching and optimization plugins are useful. Page caching, image compression and modern formats, and critical CSS are real wins. The trouble is the aggressive options:

- **Combining and deferring all JavaScript** breaks scripts that depend on load order, which is how checkouts and payment fields fail.
- **Delaying all scripts until interaction** can make the first tap slower, which hurts INP instead of helping it.
- **Caching pages with cart or session state** shows one customer's cart to another, or a stale price.

My rule: enable options one at a time, exclude cart, checkout and account pages from anything aggressive, and test an actual purchase with a real payment method in test mode after each change.

WordPress 6.8 also added speculative loading in core: by default it prefetches same-site links with conservative eagerness, so the next page can start loading when a visitor begins to click. It is off for logged-in users and for sites without pretty permalinks, and URLs with query strings are skipped by default. On stores, I check for links that change state without a query string, such as a custom "add to cart" or "empty cart" path, and exclude them with the `wp_speculation_rules_href_exclude_paths` filter.

## When not to chase Core Web Vitals

Speed work has an opportunity cost, and I say so when it applies.

- **Low-traffic sites with no field data.** If CrUX has no data for your pages, there is no field score to fix. Make the pages reasonably fast and move on.
- **Pages that already pass.** Going from "good" to "slightly better" rarely changes anything a business notices. A 98 instead of 92 in Lighthouse is not a goal.
- **When the real problem is elsewhere.** If customers drop off because shipping costs appear late or the checkout asks for an account, no amount of LCP work will help.
- **When the fix is a rebuild in disguise.** If the theme or builder makes every fix a fight, the honest recommendation may be a new theme for the money templates, scoped and estimated separately.

Core Web Vitals are a page-experience signal for search, not a ranking switch. The stronger reason to fix them is that customers notice slow and jumpy pages whether Google does or not.

## What I check on a project like this

1. Search Console Core Web Vitals report: which URL groups fail, on mobile and desktop, and which metric.
2. Templates ranked by traffic and closeness to purchase, with one real example URL each.
3. TTFB on cached and uncached requests, and whether the page cache is bypassed for anonymous visitors.
4. The LCP element on product and category pages: plain `<img>`, correct size, not lazy-loaded, `fetchpriority="high"`.
5. Layout shifts on the product template: image dimensions, injected banners, fonts, AJAX fragments.
6. Scripts loaded per template, with each plugin's script mapped to the feature that needs it.
7. Third-party tags in the tag manager, each with an owner who still uses its data.
8. A full test purchase after every optimization setting change, with cart and checkout excluded from aggressive options.

The verdict: Core Web Vitals work pays off on WordPress when it is treated as an audit, not a plugin setting. Start from field data, fix the product and category templates first, and expect the causes to be ordinary: a slow server response, a hero image loaded late, unreserved space, and plugin JavaScript nobody pruned. A handful of scoped fixes there usually does more for real shoppers than any amount of chasing a green Lighthouse badge on the homepage.
