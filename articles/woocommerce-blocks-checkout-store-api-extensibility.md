---
title: "WooCommerce Blocks checkout: extend Store API without breaking cart"
slug: woocommerce-blocks-checkout-store-api-extensibility
date: 2026-09-16
category: Engineering
excerpt: "Shortcode checkout hooks do not travel to Blocks. Here is how I extend WooCommerce cart and checkout through the Store API so fees, fields, and payments survive without breaking the cart."
readTime: 12 min
tags: [woocommerce, blocks, store-api, checkout, wordpress, php, javascript, hpos]
---

# WooCommerce Blocks checkout: extend Store API without breaking cart

I still open pull requests where someone “fixed checkout” by adding three more `woocommerce_checkout_*` actions.

On a classic shortcode checkout, that can look green for years. On **WooCommerce Blocks** checkout — the Cart and Checkout blocks powered by the **Store API** — those hooks often never run where you think they do. The cart total drifts. A custom field vanishes on refresh. A payment method that worked on `[woocommerce_checkout]` refuses to appear in the block UI. Merchants blame “Blocks are buggy.” Usually the plugin is speaking the old dialect to a new checkout contract.

I have spent enough time next to payment gateways, product backends, and WooCommerce shops to treat Blocks checkout as a **different surface**, not a theme skin. This is how I extend it without breaking the cart.

## Why shortcode checkout hooks fail on Blocks

Classic checkout is a server-rendered PHP page with a long chain of actions and filters: `woocommerce_before_checkout_form`, `woocommerce_checkout_fields`, `woocommerce_checkout_update_order_meta`, `woocommerce_review_order_before_payment`, and friends. Themes and plugins inject HTML, mutate `$_POST`, and hope the next request still agrees.

Blocks checkout is not that page.

It is a React client that talks to WooCommerce over REST-ish Store API routes (`/wc/store/v1/...`). Cart state lives in that API contract. Totals, coupons, shipping, fees, and many extensions are computed and returned as structured JSON. The browser re-renders from the response. If your fee only exists because you echoed a hidden input on a shortcode template, Blocks never saw it.

Common failure modes I triage:

1. **Hook never fires** — you attached to `woocommerce_checkout_before_customer_details` and the Blocks tree never renders that template.
2. **State is request-local** — you mutate session or globals in a classic AJAX handler that Blocks does not call.
3. **Totals disagree** — PHP still calculates a fee on `woocommerce_cart_calculate_fees`, but the Store API response you did not extend omits the extension data the UI needs, so refresh/rehydrate looks “wrong.”
4. **Payment method is shortcode-only** — gateway registered for classic checkout, no Blocks payment method integration, so the radio list is empty for that gateway.
5. **Order meta written too late / in the wrong place** — you relied on `$_POST` keys that never arrive because the field was never registered with the Store API / Checkout block field system.

The mental shift: **stop injecting into a PHP page; extend the cart/checkout contract the block already trusts.**

## Treat the Store API as the contract

When I design a Blocks-safe extension, I ask one question first: *what must be true in the Store API cart (and later the order) for this feature to be correct after a refresh?*

That usually means:

- A **cart extension** that contributes calculated data (fees, messages, availability flags)
- Optional **schema / ExtendSchema** registrations so clients and other plugins see typed fields
- Checkout **additional fields** (or equivalent supported field APIs for your WooCommerce version) when the merchant must collect structured input
- A **Blocks payment method** package when you are a gateway
- Server-side validation that runs on Store API update/checkout routes, not only on classic `woocommerce_checkout_process`

I keep business rules on the server. The React side is presentation and interaction. If the only place a fee exists is a `useEffect` that patches local state, you will lose a support ticket the first time someone reloads mid-checkout.

Sketch of the server-side idea (shape varies by WooCommerce version; always check current `ExtendSchema` / Store API docs for your target):

```php
add_action( 'woocommerce_store_api_register_endpoint_data', function () {
    woocommerce_store_api_register_endpoint_data(
        array(
            'endpoint'        => 'cart',
            'namespace'       => 'my-plugin',
            'data_callback'   => 'my_plugin_cart_data',
            'schema_callback' => 'my_plugin_cart_schema',
            'schema_type'     => ARRAY_A,
        )
    );
} );

function my_plugin_cart_data() {
    return array(
        'gift_wrap_available' => my_plugin_gift_wrap_ok(),
        'gift_wrap_selected'  => WC()->session ? (bool) WC()->session->get( 'my_gift_wrap' ) : false,
    );
}
```

The point is not the exact helper name. The point is: **cart JSON includes your extension namespace**, and the block UI reads that instead of inventing parallel truth.

## Extending cart and checkout data without fighting totals

Fees and discounts still belong in WooCommerce’s cart calculation pipeline. I still use `woocommerce_cart_calculate_fees` (or the equivalent supported fee APIs) so tax and totals stay consistent. What I add for Blocks is:

1. **A clear session / cart item / extension key** for the merchant choice (gift wrap, donation, COD surcharge opt-in).
2. **A Store API route or update handler** that sets that key when the block UI toggles it — not a custom admin-ajax that only your shortcode knows.
3. **Extension data on the cart response** so the UI can show price, eligibility, and errors after every cart update.
4. **Idempotent calculation** — selecting gift wrap twice must not stack two fees.

Pattern that keeps cart honest:

```php
add_action( 'woocommerce_cart_calculate_fees', function ( $cart ) {
    if ( is_admin() && ! defined( 'DOING_AJAX' ) ) {
        return;
    }
    if ( ! WC()->session || ! WC()->session->get( 'my_gift_wrap' ) ) {
        return;
    }
    $cart->add_fee( __( 'Gift wrap', 'my-plugin' ), 4.50, true );
} );
```

Then wire the session flag from a Store API-friendly update (custom Store API route under your namespace, or the documented cart update extension points for your version). The block button should call *that*, then rely on the returned cart — including totals and your extension data — as source of truth.

Things I refuse to do anymore:

- Echo fee HTML into a classic hook and hope Blocks scrapes it
- Store the only copy of “selected add-on” in `localStorage`
- Recalculate a different fee amount in JavaScript than PHP uses for the order

If PHP and the UI disagree by a cent, Blocks will surface it as a mysterious “cart changed, please review” loop. Fix the contract, not the toast.

## Checkout fields that survive refresh

Legacy plugins love:

```php
add_filter( 'woocommerce_checkout_fields', function ( $fields ) {
    $fields['billing']['billing_vat'] = array(
        'label'    => 'VAT number',
        'required' => false,
        'class'    => array( 'form-row-wide' ),
        'priority' => 120,
    );
    return $fields;
} );
```

That still matters for shortcode checkout. For Blocks, I register fields through WooCommerce’s **additional checkout fields** / Blocks field APIs (names evolve; pin to the WooCommerce major you support) and persist with the order using the supported save path — preferably order CRUD setters / meta APIs that remain valid under HPOS, not raw `update_post_meta` on an assumed post id.

Rules I enforce in code review:

- Validate on the Store API checkout path, return structured errors the block can show next to the field
- Do not require a field only by checking `$_POST['billing_vat']` in `woocommerce_checkout_process` if Blocks never posts that shape
- Keep PII and tax ids on the order object via `$order->update_meta_data()` / getters after `wc_get_order()`

## Payment methods for Blocks

A gateway that only implements classic `WC_Payment_Gateway` checkout fields is unfinished for modern WooCommerce.

Blocks expects a **payment method integration**: a registered payment method script (often built with `@woocommerce/blocks-registry` patterns), server-side payment method data, and careful handling of `process_payment` / Store API payment processing so the order transitions correctly.

When I review a gateway for Blocks readiness, I look for:

1. **Script registration** that only loads on Cart/Checkout block contexts (do not dump a 200KB bundle on every admin page)
2. **Can-make-payment logic** that mirrors classic `is_available()` — currency, country, cart product types, feature flags
3. **No reliance on classic payment box HTML** as the only UX
4. **Server authority** for charge creation — the browser may collect a token; PHP still creates the payment intent / charge with the same amounts WooCommerce just calculated
5. **HPOS-safe order updates** after payment — use `wc_get_order()`, setters, `$order->save()`, never assume `wp_posts` is the order row

I have lived adjacent to payment work at Paysera-scale merchant volumes and later around product ecosystems at SureCart / Brainstorm Force. The lesson transfers cleanly: **checkout UI can be React; money movement stays a boring, logged, idempotent server path.**

## Testing what actually breaks

Staging with a shortcode checkout theme is not a Blocks test.

My minimum matrix:

1. **Cart block + Checkout block** on a block theme (or a classic theme that still embeds the blocks)
2. Toggle every extension control (fee, field, shipping restriction) and **hard refresh** — state must return from Store API
3. Apply coupon, change shipping method, update address — totals and extension fees must remain coherent
4. Complete payment with the Blocks payment method, then with a second gateway to catch “only works when alone”
5. Place order logged out and logged in
6. Repeat with **HPOS enabled** and compatibility mode off on a copy of production-shaped data
7. Run a classic shortcode checkout once if you still claim dual support — regressions there are still regressions

I also watch the Network panel for `/wc/store/v1/cart` and checkout requests. If your feature never appears in the JSON, the UI is theater.

Automated coverage that has paid rent for me:

- PHP unit/integration tests around fee calculation and Store API extension callbacks
- A smoke e2e that adds a product, enables the extension, asserts the fee line in the Store API cart response, and places an order

You do not need a perfect Playwright suite on day one. You need at least one test that fails when someone “simplifies” the feature back into a shortcode-only hook.

## HPOS-aware notes for checkout extensions

Blocks and HPOS are separate projects that meet at the order object.

After checkout, anything you persist must go through order CRUD:

```php
$order = wc_get_order( $order_id );
if ( ! $order ) {
    return;
}
$order->update_meta_data( '_my_vat_number', $vat );
$order->save();
```

Avoid:

- `get_post_meta( $order_id, ... )` for core or custom order fields you care about in production
- Custom tables keyed only by post ID with no migration story
- Reports that `JOIN wp_postmeta` for orders after you declared HPOS compatibility

If your checkout extension writes “pending enrichment” work, keep checkout fast: record intent on the order, then hand off to Action Scheduler or an external queue. I wrote about that split in more depth when pairing Laravel workers with WooCommerce — the same rule applies when the trigger is a Blocks checkout instead of a classic one.

## Migrating a legacy `woocommerce_checkout_*` plugin

When a client asks me to “just make it work on Blocks,” I do not rewrite everything on day one. I sequence:

### 1. Inventory the shortcode surface

List every hook that injects UI, mutates cart, validates, or writes order meta. Tag each as: *totals*, *field*, *payment*, *side effect*, or *theme chrome*.

### 2. Move totals and validation first

Fees, discounts, stock holds, and “cannot checkout if X” rules must be server-side and cart-driven. Until those are correct in Store API responses, a prettier React control only hides the bug.

### 3. Replace UI injection with block-aware UI

Hidden fields and `echo` templates become:

- Store API extension data + a small checkout block integration script, or
- Official additional fields where they fit

### 4. Dual-run for one release

Keep shortcode paths working while Blocks paths write the **same meta keys** and fee names. Merchants switch themes mid-season. Your job is not to punish them.

### 5. Delete the dead hooks deliberately

Once analytics show Blocks checkout volume and shortcode is gone, remove the classic-only UI hooks so the next developer does not “fix” a ghost feature.

A practical migration checklist I keep in the PR description:

- [ ] Fee/discount visible in `/wc/store/v1/cart` JSON
- [ ] Extension namespace documented for the storefront team
- [ ] Field validation errors return on Store API checkout
- [ ] Payment method registered for Blocks (if gateway)
- [ ] Order meta written via `WC_Order` APIs
- [ ] HPOS-on staging order inspected in admin
- [ ] Classic checkout still passes if still supported
- [ ] No new `$_POST`-only requirements without a Blocks equivalent

## Where product judgment beats more hooks

Not every classic customization should be ported one-for-one. Some checkout “features” were really theme hacks: rearrange columns with `detach`/`attach`, dump HTML into `woocommerce_review_order_before_submit`, or run remote fraud calls inline before thank-you.

On Blocks, that is the moment to ask whether the feature belongs in:

- Cart calculation
- A documented checkout field
- A payment method
- A post-purchase flow / thank-you block / email
- Or an external service beside WordPress

When shops come to [SquartUp](https://squartup.com) for WooCommerce work, the useful conversation is rarely “which hook replaces this one?” It is “what is the Store API truth we need so cart and checkout cannot disagree?”

## Closing

WooCommerce Blocks checkout is not hostile to extensions. It is hostile to **page-shaped assumptions**.

Shortcode hooks optimized for injecting into a PHP form. The Store API optimizes for a cart document the client can trust after every update. Extend that document — fees, fields, payments, validation — and keep order writes on HPOS-safe CRUD. Test with real Cart/Checkout blocks, hard refresh, and payment. Migrate legacy `woocommerce_checkout_*` plugins by moving totals and validation first, UI second, deletions last.

The cart that does not break is usually the one where React never got a vote on the money.
