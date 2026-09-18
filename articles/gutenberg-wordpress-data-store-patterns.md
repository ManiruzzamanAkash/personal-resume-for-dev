---
title: "Gutenberg @wordpress/data: store patterns that keep editors honest"
slug: gutenberg-wordpress-data-store-patterns
date: 2026-09-18
category: Engineering
excerpt: "Most Gutenberg bugs I chase are not React bugs — they are store bugs. Here is how I design @wordpress/data stores so selectors, resolvers, and dispatches stay predictable in real editors."
readTime: 12 min
tags: [wordpress, gutenberg, wordpress-data, react, block-editor, core-data, javascript]
---

# Gutenberg @wordpress/data: store patterns that keep editors honest

When a Gutenberg panel flickers, a sidebar shows yesterday's product, or a block toolbar acts on the wrong client id, the instinct is to blame React. Nine times out of ten I eventually find the real culprit one layer down: **how the plugin talks to `@wordpress/data`**.

I have shipped enough block and admin UIs — payment settings, commerce sidebars, editor extensions next to SureCart and WooCommerce workflows — to stop treating the data layer as “Redux with WordPress names.” It is a contract. Selectors, resolvers, actions, and controls either tell the truth about async state or they lie politely until a merchant opens the editor on a slow host.

This is the craft I use in 2026 when I add a custom store, extend `core-data`, or wire a plugin sidebar that must stay honest under concurrent edits.

## Why the store is the product surface

In classic PHP admin pages I could cheat. A form posts, PHP loads the option, the page re-renders. Gutenberg is different: the editor is a long-lived React tree. Multiple plugins select overlapping slices. Autosave, pre-publish checks, and entity records all race the same registry.

If my store API is vague — “give me settings” without saying whether they are loaded, stale, or errored — every consumer invents its own loading flag. That is how you get double fetches, empty flashes, and the classic “works on my laptop, fails on a 200ms REST host” bug.

What I want from a store:

1. **Selectors that answer one question** — not “everything the panel might need someday.”
2. **Resolvers that own the async path** — consumers should not know about `apiFetch` unless they are writing a control.
3. **Actions that describe intent** — `saveSettings`, not `setStateFromResponse`.
4. **Honest derived state** — `isResolving`, `hasFinishedResolution`, error selectors — so the UI can show loading without local boolean spaghetti.

## The registry mental model (keep it small)

`@wordpress/data` is a registry of named stores. Each store has:

- **State** — plain data the store owns.
- **Actions** — functions that return action objects (or thunks / generators when controls are involved).
- **Selectors** — pure reads over state (plus registry selectors that can call other stores).
- **Resolvers** — optional companions to selectors that kick off data loading when a selector is first used.
- **Controls** — side-effect handlers (`apiFetch`, `select`, `dispatch`) for generator-style actions.

I register with `createReduxStore` + `register` (the modern path), not the older `registerStore` shape, unless I am patching a legacy plugin.

```js
import { createReduxStore, register } from '@wordpress/data';

const DEFAULT_STATE = {
	settings: null,
	lastError: null,
};

const actions = {
	setSettings( settings ) {
		return { type: 'SET_SETTINGS', settings };
	},
	setError( lastError ) {
		return { type: 'SET_ERROR', lastError };
	},
	* receiveSettings() {
		try {
			const settings = yield {
				type: 'API_FETCH',
				request: { path: '/my-plugin/v1/settings' },
			};
			return actions.setSettings( settings );
		} catch ( lastError ) {
			return actions.setError( lastError );
		}
	},
};

const selectors = {
	getSettings( state ) {
		return state.settings;
	},
	getLastError( state ) {
		return state.lastError;
	},
};

const resolvers = {
	getSettings() {
		return actions.receiveSettings();
	},
};

const store = createReduxStore( 'my-plugin/settings', {
	reducer( state = DEFAULT_STATE, action ) {
		switch ( action.type ) {
			case 'SET_SETTINGS':
				return { ...state, settings: action.settings, lastError: null };
			case 'SET_ERROR':
				return { ...state, lastError: action.lastError };
			default:
				return state;
		}
	},
	actions,
	selectors,
	resolvers,
	controls: {
		API_FETCH( { request } ) {
			return wp.apiFetch( request );
		},
	},
} );

register( store );
```

Three rules I enforce in review:

- **Namespace the store name** — `my-plugin/settings`, never generic `settings`. Collisions are silent and brutal.
- **Resolvers pair with selectors by name** — `resolvers.getSettings` runs when something selects `getSettings` and resolution has not finished.
- **Do not put `apiFetch` inside React components** if a resolver can own it. Components should select and dispatch, not become mini SDKs.

## Selectors: ask narrow questions

The most expensive habit in Gutenberg plugins is selecting a fat object and destructuring in the component:

```js
// Fragile: any settings field change re-renders every consumer.
const settings = useSelect( ( select ) =>
	select( 'my-plugin/settings' ).getSettings()
);
```

Prefer selectors that return what the view needs:

```js
const currency = useSelect( ( select ) =>
	select( 'my-plugin/settings' ).getCurrency()
);
```

If the state is nested, add a focused selector. Memoization in the store beats `useMemo` glue in five panels.

### Registry selectors when you must join stores

Sometimes a block needs “current post type + my plugin flag.” Use `register`’s registry selectors (or `select` inside a selector factory) carefully. Joining stores is powerful and also a subscription multiplier — every dependency store change can wake your component.

I join stores when the alternative is prop-drilling through three plugin boundaries. I avoid joining stores for convenience formatting that belongs in the view.

## Resolvers: the async contract merchants actually feel

Resolvers are how Gutenberg pretends data is local. First `getEntityRecord` looks sync; underneath, a resolver fetches and the selector updates.

Patterns that keep me sane:

### 1. One resolver per “load this resource” selector

If `getSettings()` needs the network, put the fetch in `resolvers.getSettings`. Do not also call `apiFetch` in `useEffect` “just in case.” Double loading is the default outcome of mixed strategies.

### 2. Respect resolution status in the UI

```js
import { useSelect } from '@wordpress/data';
import { store as myStore } from './store';

function SettingsPanel() {
	const { settings, isLoading, hasError } = useSelect( ( select ) => {
		const s = select( myStore );
		return {
			settings: s.getSettings(),
			isLoading: s.isResolving( 'getSettings' ),
			hasError: Boolean( s.getLastError() ),
		};
	}, [] );

	if ( isLoading ) {
		return <Spinner />;
	}
	if ( hasError ) {
		return <Notice status="error">{ __( 'Could not load settings.', 'my-plugin' ) }</Notice>;
	}
	return <SettingsForm settings={ settings } />;
}
```

WordPress core exposes `isResolving` / `hasFinishedResolution` on stores that use the resolution layer. Custom stores get this when registered properly through `@wordpress/data`. If you reinvent `{ loading: true }` in every component, you have abandoned the platform.

### 3. Invalidate on purpose

After `saveSettings`, invalidate so the next select re-resolves — or optimistically update state in the same action path. Silent caches are how support tickets say “I saved but the sidebar still shows the old API key.”

```js
import { dispatch } from '@wordpress/data';

yield dispatch( 'my-plugin/settings' ).setSettings( saved );
yield dispatch( 'my-plugin/settings' ).invalidateResolution( 'getSettings' );
```

Use invalidation when the server is the source of truth. Use optimistic local updates when the UX cannot wait and you can roll back on failure.

## Actions and controls: intent over transport

I write actions as **domain language**:

- `savePaymentMethod`
- `hydrateFromOrder`
- `associateProduct` — keep names boring and searchable

Transport details belong in controls / generators:

```js
* saveSettings( nextSettings ) {
	const saved = yield {
		type: 'API_FETCH',
		request: {
			path: '/my-plugin/v1/settings',
			method: 'POST',
			data: nextSettings,
		},
	};
	return actions.setSettings( saved );
}
```

Why generators instead of async/await everywhere? In Gutenberg, controls keep side effects testable and consistent with core packages. When I do use thunks, I still keep the action name about intent.

## `useSelect` and `useDispatch`: subscription discipline

### Equality and dependency arrays

```js
const clientId = useSelect( ( select ) =>
	select( 'core/block-editor' ).getSelectedBlockClientId()
, [] );
```

The second argument is the dependency list for the mapping function. Empty `[]` means “mapping identity is stable.” If the mapping closes over props (`props.productId`), list them:

```js
const product = useSelect(
	( select ) =>
		select( 'core' ).getEntityRecord( 'postType', 'product', productId ),
	[ productId ]
);
```

Forgetting deps is a classic stale-closure bug. Over-selecting (returning a new object literal every time without care) is a classic re-render bug. When I must return an object, I keep the selector itself stable or use a shallow compare pattern the team already owns.

### Dispatch is not free of ceremony

```js
const { saveSettings } = useDispatch( 'my-plugin/settings' );
```

Wire buttons to intents. Do not sprinkle `dispatch( 'my-plugin/settings' ).setSettings( raw )` through onChange handlers if validation belongs in the action.

## Prefer `core` / `core-data` before inventing parallel worlds

For posts, pages, site settings, and custom post types, **`@wordpress/core-data`** already speaks REST:

- `getEntityRecord`
- `getEntityRecords`
- `editEntityRecord`
- `saveEditedEntityRecord`
- `getEditedEntityRecord`

If I need “the product currently being edited,” I start here — not with a second product cache in my plugin store. Parallel caches diverge; merchants notice.

My plugin store should hold **plugin-owned state**: feature flags that are not entities, ephemeral UI (which tab is open), derived caches that core cannot express, or integrations that call non-entity REST routes.

When I worked on commerce editor surfaces, the pain was never “React is hard.” It was two stores disagreeing about the same product id. One store from core-data, one hand-rolled “for convenience.” Convenience lost.

## Block editor store: select surgically

`core/block-editor` is hot. Selecting `getBlocks()` in a frequently rendered component is how you melt the editor. Prefer:

- `getSelectedBlockClientId()`
- `getBlock( clientId )`
- `getBlockName( clientId )`
- attributes via the block’s own `useBlockProps` / attribute bindings

If a sidebar only cares about the selected block’s product attribute, select that attribute path — not the entire block tree.

Same discipline for `core/editor` (post title, save state) and `core/notices` (push failures where merchants look).

## Patterns that survive real plugin reviews

### Loading gates at the boundary

Put resolution UX at the panel root. Child components assume data exists. Optional chaining through five children is how empty states silently disappear.

### Error notices via `core/notices`

```js
yield dispatch( 'core/notices' ).createErrorNotice(
	__( 'Could not save settings. Try again.', 'my-plugin' ),
	{ id: 'my-plugin-settings-save', isDismissible: true }
);
```

Do not invent a toast system for one plugin unless product design demands it.

### Avoid “select everything, filter in render”

Bad:

```js
const records = useSelect( ( select ) =>
	select( 'core' ).getEntityRecords( 'postType', 'product', { per_page: -1 } )
);
const match = ( records || [] ).find( ( p ) => p.id === productId );
```

Better: `getEntityRecord( 'postType', 'product', productId )` and let resolvers fetch the one record.

### Name stores and action types like APIs

Future you will grep production logs and issues. `SET_SETTINGS` is fine. `UPDATE` is not. Prefix custom control types (`MY_PLUGIN_API_FETCH`) if you share a registry with other packages.

## How this differs from ad-hoc React admin apps

Outside Gutenberg I am happy with React Query / SWR / Laravel Inertia props. Inside the block editor, fighting `@wordpress/data` means fighting every other plugin’s assumptions.

| Concern | Ad-hoc React admin | Gutenberg editor |
| --- | --- | --- |
| Server state | React Query cache | Resolvers + entity records |
| Local UI state | `useState` | `useState` or small plugin store slice |
| Cross-plugin coordination | Rare | Constant (toolbar, sidebar, canvas) |
| Save lifecycle | Your form submit | Entities + editor save + autosave |

I still use local React state for pure UI (open/closed, draft text before commit). I promote to a store when a second surface needs the same truth — another sidebar, a pre-publish panel, a block.

## Testing what matters

I do not need a full browser for every store change. I unit-test reducers and selectors with plain actions. I integration-test resolvers with mocked controls. For the truly cursed bugs — selection races, entity edits — I reproduce in the editor with a single fixture post.

The question I ask in PR review: **“If REST is slow, what does the user see?”** If the answer is “nothing special,” the store contract is incomplete.

## Adoption checklist I actually use

1. Namespace the store; register once on a `plugins.loaded`-equivalent editor boot.
2. Prefer `core-data` entities for CPT/post fields.
3. Pair every networked selector with a resolver; kill duplicate `useEffect` fetches.
4. Surface `isResolving` / errors at the panel boundary.
5. Keep `useSelect` maps narrow; list prop dependencies.
6. Invalidate or update after saves so the UI cannot show ghost data.
7. Select surgically from `core/block-editor`.
8. Speak intents in action names; keep transport in controls.

## Closing

`@wordpress/data` is not boilerplate you sprinkle to look “native.” It is the shared language between your plugin, core, and every other extension sharing the canvas. When selectors are narrow, resolvers own the network, and actions describe intent, the editor feels calm even on a slow shop admin.

When those pieces are fuzzy, React looks guilty and merchants blame “the new editor.” I would rather fix the store.

The next sidebar I ship starts with one namespaced store, one resolver-backed read path, and a hard rule: **no parallel cache for something `core-data` already knows.** That single discipline has saved me more debugging hours than any performance trick in the render tree.
