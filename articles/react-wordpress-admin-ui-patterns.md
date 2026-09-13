---
title: "React in the WordPress admin: stop fighting PHP pages"
slug: react-wordpress-admin-ui-patterns
date: 2026-09-13
category: Engineering
excerpt: "Shipping a React screen inside wp-admin is easy. Shipping one that survives capability checks, REST auth, and real merchant workflows is a different craft."
readTime: 12 min
tags: [wordpress, react, admin, php, javascript, architecture]
---

# React in the WordPress admin: stop fighting PHP pages

The first React screen I bolted onto `wp-admin` looked great in a demo and fell apart the week a client with two store managers and a custom capability map opened it.

That is the pattern. WordPress already has an admin: menus, capability gates, settings APIs, notices, list tables, and a request lifecycle that assumes PHP rendered the page. React does not replace that stack. It sits *inside* it. If you treat the admin as “just a SPA mount point,” you will fight PHP forever — wrong enqueue order, broken nonces, screens that ignore `current_user_can`, and UIs that look modern while leaking data through unauthenticated REST routes.

I build WordPress and WooCommerce plugins for real shops and product teams. The React admin work that lasts is not the flashiest dashboard. It is the one that respects how WordPress already decides who can see what, how assets load, and how state crosses the PHP/JS boundary.

This is the discipline I use when a plugin needs a serious admin UI.

## The wrong mental model

Most failures start with this assumption:

> “I will enqueue a bundle, call `createRoot` on a div, and own the whole screen.”

That works for a prototype. It fails when:

- Another plugin injects scripts that expect jQuery on the same page
- A multisite network admin hits your screen with different caps
- Your “settings” write path bypasses the Settings API and loses auditability
- You fetch private data with a cookie-authenticated `fetch` and forget nonce headers
- You rebuild navigation that WordPress already registered, then wonder why deep links break

React in `wp-admin` is not Create React App with a WordPress logo. It is a **guest UI** inside a host that already owns auth, menus, and page chrome.

## Decide what React owns (and what PHP keeps)

Before you open a JSX file, draw a hard boundary.

**PHP should still own:**

- Menu registration (`add_menu_page` / `add_submenu_page`)
- Capability checks for who can *open* the screen
- Server-rendered shell when you need progressive enhancement or no-JS fallbacks
- Nonce generation and capability-gated REST route registration
- Options / custom tables writes that must remain auditable from PHP

**React should own:**

- Interactive forms, wizards, and multi-step configuration
- Live previews, filters, and tables that would be painful as full page reloads
- Client-side validation that reduces round trips (never as the only gate)
- Composition of WordPress UI primitives (`@wordpress/components`, SlotFill)

If React “owns” capability logic by hiding buttons, you do not have security. You have theater.

```php
add_submenu_page(
    'woocommerce',
    __( 'Sync settings', 'acme' ),
    __( 'Sync settings', 'acme' ),
    'manage_woocommerce',
    'acme-sync-settings',
    'acme_render_sync_settings_page'
);

function acme_render_sync_settings_page() {
    if ( ! current_user_can( 'manage_woocommerce' ) ) {
        wp_die( esc_html__( 'You do not have permission.', 'acme' ) );
    }

    echo '<div class="wrap"><div id="acme-sync-root"></div></div>';
}
```

The mount point is dumb on purpose. The interesting part is how you feed it.

## Enqueue like a WordPress citizen

A React admin bundle that loads on every `admin_enqueue_scripts` call is how you make every other screen slower. Scope it.

```php
add_action( 'admin_enqueue_scripts', function ( $hook ) {
    if ( 'woocommerce_page_acme-sync-settings' !== $hook ) {
        return;
    }

    $asset_file = plugin_dir_path( __FILE__ ) . 'build/index.asset.php';
    $asset      = file_exists( $asset_file )
        ? include $asset_file
        : array(
            'dependencies' => array( 'wp-element', 'wp-components', 'wp-api-fetch' ),
            'version'      => '1.0.0',
        );

    wp_enqueue_script(
        'acme-sync-admin',
        plugins_url( 'build/index.js', __FILE__ ),
        $asset['dependencies'],
        $asset['version'],
        true
    );

    wp_enqueue_style(
        'acme-sync-admin',
        plugins_url( 'build/index.css', __FILE__ ),
        array( 'wp-components' ),
        $asset['version']
    );

    wp_localize_script(
        'acme-sync-admin',
        'acmeSyncAdmin',
        array(
            'rootId'   => 'acme-sync-root',
            'restUrl'  => esc_url_raw( rest_url( 'acme/v1' ) ),
            'nonce'    => wp_create_nonce( 'wp_rest' ),
            'canWrite' => current_user_can( 'manage_woocommerce' ),
            'settings' => acme_get_public_admin_settings(),
        )
    );
} );
```

Notes I do not skip anymore:

- Use the `.asset.php` file from `@wordpress/scripts` so dependency versions stay honest
- Pass **boot data** through `wp_localize_script` (or `wp_add_inline_script`) instead of a second unauthenticated fetch for config the page already knows
- Put `canWrite` in boot data for UX, and **re-check on every write** on the server
- Prefer `wp-api-fetch` middleware over hand-rolled `fetch` so the REST nonce is not a tribal secret

## Prefer WordPress packages over reinventing the admin design system

If you are already inside `wp-admin`, fighting the platform’s React stack is expensive. `@wordpress/components`, `@wordpress/data`, `@wordpress/i18n`, and `@wordpress/api-fetch` exist so your screen feels native and shares accessibility patterns.

That does not mean every screen must look like the block editor. It means:

- Buttons, modals, notices, and form controls should not invent a second accessibility story
- Data stores should not reinvent caching, resolvers, and invalidation if `@wordpress/data` fits
- Strings should go through `__()` / `sprintf` so translators are not locked out of your shiny UI

When I have built denser product UIs — SureCart-adjacent admin work at Brainstorm Force, payment and merchant tooling in the Paysera gateway world — the screens that aged best were the ones that looked like WordPress, not like a marketing site trapped in `/wp-admin`.

## REST is the contract; React is the consumer

The cleanest admin React apps treat the REST API as the product boundary.

Bad shape:

- React posts to `admin-ajax.php` with action soup
- PHP returns HTML fragments and hopes client code can parse them
- Capability checks live only in the menu callback

Better shape:

```php
register_rest_route(
    'acme/v1',
    '/settings',
    array(
        array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'acme_rest_get_settings',
            'permission_callback' => function () {
                return current_user_can( 'manage_woocommerce' );
            },
        ),
        array(
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'acme_rest_update_settings',
            'permission_callback' => function () {
                return current_user_can( 'manage_woocommerce' );
            },
            'args'                => acme_settings_schema(),
        ),
    )
);
```

Then the React side stays boring on purpose:

```js
import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';
import { Button, Notice, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

export function SyncSettingsApp( { canWrite } ) {
    const [ settings, setSettings ] = useState( null );
    const [ error, setError ] = useState( null );
    const [ saving, setSaving ] = useState( false );

    useEffect( () => {
        apiFetch( { path: '/acme/v1/settings' } )
            .then( setSettings )
            .catch( ( e ) => setError( e.message ) );
    }, [] );

    async function onSave() {
        if ( ! canWrite ) {
            return;
        }
        setSaving( true );
        setError( null );
        try {
            const next = await apiFetch( {
                path: '/acme/v1/settings',
                method: 'POST',
                data: settings,
            } );
            setSettings( next );
        } catch ( e ) {
            setError( e.message );
        } finally {
            setSaving( false );
        }
    }

    if ( ! settings ) {
        return error ? <Notice status="error">{ error }</Notice> : null;
    }

    return (
        <>
            { error && <Notice status="error">{ error }</Notice> }
            <TextControl
                label={ __( 'Webhook URL', 'acme' ) }
                value={ settings.webhookUrl }
                onChange={ ( webhookUrl ) =>
                    setSettings( { ...settings, webhookUrl } )
                }
                disabled={ ! canWrite }
            />
            <Button variant="primary" onClick={ onSave } disabled={ ! canWrite || saving }>
                { __( 'Save', 'acme' ) }
            </Button>
        </>
    );
}
```

Schema validation in `args` is not bureaucracy. It is how you stop a clever browser console from writing nonsense into options.

## State: boot data, server truth, client cache

I keep three layers distinct:

1. **Boot data** — page-scoped constants (REST root, nonce, flags, initial settings snapshot)
2. **Server truth** — what REST returns after a write
3. **Client cache** — React state or a `@wordpress/data` store while the user edits

The bug I still see in reviews is treating boot data as permanently authoritative after a save elsewhere (another tab, a WP-CLI command, a webhook). If the value can change outside this screen, re-fetch or invalidate. If it cannot, say so in the product design.

For larger admin apps I use a small store with resolvers instead of prop-drilling fetch calls through eight components. For a single settings form, `useState` is enough. Match the complexity to the surface area.

## SlotFill and extending screens you do not own

Sometimes you are not building a full page. You are extending WooCommerce, SureCart, or core screens. SlotFill is the WordPress answer to “inject UI without forking the host.”

Use it when:

- The host plugin documents a Slot
- Your UI is additive (a panel, a card, a filter row)
- You can degrade gracefully if the Slot is missing after a host update

Do **not** use DOM scraping and `MutationObserver` hacks to jam React into someone else’s markup. That works until their CSS class rename ships on a Tuesday.

## Performance and fairness on shared admin pages

`wp-admin` is a shared runtime. Your bundle competes with WooCommerce, SEO plugins, page builders, and security tools.

Practical rules:

- Code-split heavy charts or editors; do not make every merchant download your analytics library to open a toggle
- Avoid polling loops that hammer REST every two seconds “for live status” — prefer explicit refresh, Heartbeat sparingly, or server-sent updates only when the product truly needs them
- Keep CSS scoped; global admin CSS resets are how you break list tables you never meant to touch
- Measure the screen on a staging site that already has “too many plugins,” not on a clean local install

When I help teams untangle slow admin dashboards — including the kind of client-site rescue work that shows up around [SquartUp](https://squartup.com) when an agency stack has grown by accretion — the React bundle is rarely the only culprit. It is usually React plus unbounded queries plus scripts enqueued site-wide. Fix the enqueue map first. Then profile the JS.

## Accessibility is not a phase after polish

WordPress admin users include people who navigate by keyboard, use screen readers, and manage shops all day. If your React modal traps focus incorrectly, or your custom table has no row headers, you shipped a regression against the platform’s baseline.

Minimum bar I hold myself to:

- Use `@wordpress/components` primitives before custom widgets
- Visible focus states
- Notices announced usefully, not only colored
- Forms with real labels, not placeholder-only fields
- Do not remove the `.wrap` heading structure without replacing it

## Testing what actually breaks

Unit-testing a reducer is fine. It will not catch the failures that matter:

- A shop manager role can open the menu but gets 403 on write
- The screen works for `administrator` and blank-screens for `shop_manager`
- REST works in the browser session and fails for application passwords / basic auth clients you promised to support
- Your script depends on `wp-editor` and tanks every product edit screen because you registered dependencies wrong

I smoke-test with at least two roles, an incognito session, and a disabled complementary plugin set. If the feature touches money, refunds, or PII, I also verify that read routes do not over-expose fields “because the UI needed them for a tooltip.”

## A checklist I reuse

When a plugin needs a React admin surface, I walk this list before calling it done:

1. PHP registers the menu and capability gate
2. Assets enqueue only on that screen hook
3. Boot data includes nonce, REST root, and UX flags — not secrets
4. Every write path has a `permission_callback` and schema
5. UI uses WordPress components where practical
6. No security decision is client-only
7. Bundle size is justified; polling is justified or removed
8. Two roles tested; no-JS story considered (even if it is “please enable JavaScript”)

## Closing

React belongs in the WordPress admin when interaction density exceeds what PHP forms can honestly deliver. It does not belong there as a way to escape WordPress.

The craft is quieter than the demos: scoped enqueues, REST as the boundary, capabilities on the server, boot data instead of mystery fetches, and UI that feels like it was invited into `wp-admin` rather than occupying it.

If you get those pieces right, the React screen stops being the fragile demo and starts being the part of the plugin operators trust on a Monday morning.
