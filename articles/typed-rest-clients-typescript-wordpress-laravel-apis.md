---
title: Typed REST clients in TypeScript for WordPress and Laravel APIs
slug: typed-rest-clients-typescript-wordpress-laravel-apis
date: 2026-11-22
category: React & Frontend
excerpt: "When a React app talks to a WordPress or Laravel API through scattered fetch calls, a renamed field breaks screens silently. Here is how I build one typed client per API so drift fails loudly in development, not quietly in production."
readTime: 9 min
tags: [typescript, react, wordpress, laravel, rest-api, zod, openapi, frontend, saas]
---

# Typed REST clients in TypeScript for WordPress and Laravel APIs

> **In short**
> - **The problem:** a React front end calls a WordPress or Laravel API from dozens of places, each with its own `fetch`, its own guess at the response shape, and its own error handling. When the backend renames a field or changes an error format, screens break quietly: blank totals, a "Save" button that does nothing, a dashboard showing zero orders. Users notice before the team does.
> - **What I do about it:** I put every call to an API behind one small typed client. It owns the base URL, auth, error shape and pagination, and it checks responses at runtime where the backend can drift. Components never call `fetch` directly.
> - **Who this is for:** engineers building React admin screens, headless storefronts or SaaS dashboards on top of WordPress or Laravel, and leads who keep losing afternoons to "the API changed and nobody told us."

The failure I see most often does not look like a failure. A backend developer changes `total` to `total_amount` in an order response because the new name is clearer. Their tests pass. The front end still compiles, because the order type was declared by hand in a component file six months ago and nobody connected it to the API. The order list now renders `undefined`, which React prints as nothing, so every row has an empty total column. It ships on a Friday.

The other version is errors. One screen expects `{ message }`, another expects `{ error }`, a third checks `res.ok` and nothing else. A validation failure from the server shows up as a generic "Something went wrong," and support asks engineering what the user did wrong.

Neither of these is a TypeScript problem. TypeScript was there the whole time. The problem is that the types described what someone hoped the API returned, in many places, with nothing checking the hope. I have built React front ends on both stacks, from the REST scaffolding in my open-source [WP React Kit](https://github.com/ManiruzzamanAkash/wp-react-kit) starter to headless storefront APIs at SureCart and Laravel-backed React apps earlier in my career, and the fix that has held up is always the same shape.

## A typed client is one module, not a pattern sprinkled across components

The rule is simple: components and hooks import functions like `orders.list()` and `orders.update(id, input)`. They never see a URL, a header or a raw `Response`. Everything about talking to the API lives in one folder:

```
src/api/
  http.ts        // base request, auth, error normalization
  errors.ts      // ApiError type
  schemas.ts     // runtime schemas where the backend can drift
  orders.ts      // one file per resource
  customers.ts
```

This sounds like ceremony until the first backend change. With one client, a renamed field is a one-file fix, and the type change ripples to every screen that used it as a compile error. Without it, you search the codebase for the string `total` and hope.

It also gives code review a place to look. A pull request that touches `src/api/` is a contract change, and I review it differently from a button tweak.

## Errors need one shape before they reach a component

WordPress and Laravel disagree about what an error looks like, and the client is where that disagreement ends.

A WordPress REST error comes back as JSON with `code`, `message` and `data.status`, the serialized form of a `WP_Error`. Laravel's validation failures come back as HTTP 422 with `message` and an `errors` object keyed by field name, each value an array of strings, with nested fields flattened to dot notation like `items.0.quantity`. Other Laravel errors depend on how the app's exception handler renders them.

I normalize both into one type:

```ts
// errors.ts
export type ApiError = {
  status: number;          // HTTP status, 0 for network failures
  code: string;            // 'rest_forbidden', 'validation_failed', 'network_error'
  message: string;         // safe to show a user
  fields: Record<string, string[]>; // per-field messages, empty if none
};

export function toApiError(status: number, body: unknown): ApiError {
  const b = (body ?? {}) as Record<string, any>; // untrusted JSON, narrowed below

  // Laravel validation: { message, errors: { field: string[] } }
  if (status === 422 && b.errors && typeof b.errors === 'object') {
    return { status, code: 'validation_failed', message: String(b.message ?? 'Please check the form.'), fields: b.errors };
  }

  // WordPress: { code, message, data: { status } }
  if (typeof b.code === 'string' && typeof b.message === 'string') {
    return { status, code: b.code, message: b.message, fields: {} };
  }

  return { status, code: `http_${status}`, message: 'The server could not complete this request.', fields: {} };
}
```

Components now handle one thing. A form maps `fields` onto inputs, which is the approach I described in [React form state and TypeScript validation I trust in admin UIs](/article/react-form-state-typescript-validation-i-trust-in-admin-uis/). A toast shows `message`. A 401 handler redirects to login. Nobody parses error JSON in a component again.

## The base request owns auth, and auth is different on each stack

The base `request` function is the only place that knows how to authenticate.

On WordPress, for screens inside wp-admin or a logged-in front end, I use `@wordpress/api-fetch` rather than raw `fetch`, because it already handles the REST nonce. You register the nonce and root URL once with `apiFetch.use( apiFetch.createNonceMiddleware( nonce ) )` and `apiFetch.use( apiFetch.createRootURLMiddleware( rootURL ) )`, then call it with a `path` relative to the REST root. For the client I usually pass `parse: false`, so I get the raw response back and can read status and headers myself instead of letting each call site guess.

On Laravel with a separate SPA, auth is usually either cookie-based through Sanctum, where the browser sends the session cookie and a CSRF token, or a bearer token for API-only clients. Either way, it is a few lines in `http.ts` and zero lines in components.

```ts
// http.ts (fetch-based variant)
export async function request<T>(path: string, init: RequestInit = {}): Promise<{ data: T; headers: Headers }> {
  let res: Response;
  try {
    res = await fetch(`${API_ROOT}${path}`, {
      ...init,
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...authHeaders(), ...init.headers },
    });
  } catch {
    throw { status: 0, code: 'network_error', message: 'You appear to be offline.', fields: {} } satisfies ApiError;
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body);
  return { data: body as T, headers: res.headers };
}
```

That `as T` is the honest weak point. It tells TypeScript to trust the server. The next section is about when that trust is earned.

## Pagination is part of the contract, so the client should return it typed

Both stacks paginate, in different places. WordPress core collection endpoints put totals in response headers, `X-WP-Total` and `X-WP-TotalPages`, and return a bare array as the body. Laravel paginated API resource collections return a body with `data`, `links` and `meta`, where `meta` carries `current_page`, `last_page`, `per_page` and `total`.

If each screen reads these itself, you get one screen that forgets the headers and shows "page 1 of 1" forever. So the client returns one shape:

```ts
export type Page<T> = { items: T[]; page: number; totalPages: number; total: number };

// WordPress: totals live in headers
export async function wpList<T>(path: string, page = 1): Promise<Page<T>> {
  const { data, headers } = await request<T[]>(`${path}${path.includes('?') ? '&' : '?'}page=${page}`);
  return {
    items: data,
    page,
    total: Number(headers.get('X-WP-Total') ?? data.length),
    totalPages: Number(headers.get('X-WP-TotalPages') ?? 1),
  };
}

// Laravel: totals live in the body
type LaravelPage<T> = { data: T[]; meta: { current_page: number; last_page: number; total: number } };

export async function laravelList<T>(path: string, page = 1): Promise<Page<T>> {
  const { data } = await request<LaravelPage<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}`);
  return { items: data.data, page: data.meta.current_page, totalPages: data.meta.last_page, total: data.meta.total };
}
```

One detail that trips people on Laravel: a single resource is wrapped in a `data` key by default. `JsonResource::withoutWrapping()` removes the outer wrapper for single resources, but paginated responses still keep `data`. The client is where that inconsistency gets absorbed once.

## Where the types come from decides how much you can trust them

There are three honest sources for response types, and I pick per API, not per project.

**Generated from an OpenAPI spec.** If the backend publishes an OpenAPI document, I generate types from it with `openapi-typescript` (`npx openapi-typescript ./openapi.yaml -o ./src/api/schema.d.ts`) and call it through `openapi-fetch`, where `createClient<paths>({ baseUrl })` gives typed methods like `client.GET("/orders/{id}", { params: { path: { id } } })` that return `{ data, error, response }`. Laravel teams can produce the spec from their code with a documentation generator such as Scramble, so the spec follows the code instead of a wiki page. This is the strongest option when the spec is generated in CI, and the weakest when someone edits YAML by hand and forgets.

**Validated at runtime with a schema.** For APIs I do not control, or WordPress endpoints whose shape changes with plugins, I write a schema with a library like Zod and parse the response at the edge. The type comes from the schema with `z.infer`, so the declared type and the check can never disagree:

```ts
import { z } from 'zod';

export const Order = z.object({
  id: z.number(),
  status: z.enum(['pending', 'processing', 'completed', 'refunded']),
  total: z.string(),      // money as a decimal string, never a float
  currency: z.string(),
});
export type Order = z.infer<typeof Order>;

export async function getOrder(id: number): Promise<Order> {
  const { data } = await request<unknown>(`/orders/${id}`);
  const parsed = Order.safeParse(data);
  if (!parsed.success) {
    reportDrift('/orders/:id', parsed.error); // send to error tracking
    throw { status: 200, code: 'contract_mismatch', message: 'This order could not be displayed.', fields: {} } satisfies ApiError;
  }
  return parsed.data;
}
```

The renamed-field bug from the opening fails here, on the first request in development or staging, with an error that names the field. That is the whole point.

**Hand-written types.** Fine for a small, stable internal endpoint owned by the same person who writes the front end. I still keep them in `src/api/`, never in a component file.

I covered the general argument for runtime parsing at the edge in [React data-fetching patterns I trust before a dashboard lies](/article/react-data-fetching-patterns-i-trust-before-dashboard-lies/). The client is what makes it practical, because the parse lives in one function per endpoint instead of in every hook.

## The backend half of the contract matters just as much

A typed client cannot fix a sloppy API. On WordPress, routes that declare `args` and a schema, return consistent shapes, and use proper status codes make the client small. I wrote about that side in [WordPress REST API routes I trust in production](/article/wordpress-rest-api-routes-i-trust-in-production/). On Laravel, API Resources do the same job: one class decides what an order looks like in JSON, instead of controllers returning models directly and leaking whatever columns exist this week.

When I join a project, the quickest win is often on the backend: make one resource class or one WordPress schema the source of truth, and generate or validate against it.

## Trade-offs and when not to do this

- **Runtime validation costs bytes and a little CPU.** Parsing a list of 500 rows on every refetch is measurable on slow devices. I validate detail endpoints and anything involving money fully, and for large lists I either validate a sample in production or validate fully only in development.
- **Strict schemas can break on harmless additions.** A schema that rejects unknown keys will fail the day the backend adds a field. I let unknown keys pass by default and fail only on missing or wrongly typed fields the screen actually uses.
- **Generated types are only as good as the spec.** A hand-maintained OpenAPI file that lags the code gives false confidence, which is worse than none. If the spec is not generated or checked in CI, I treat it as documentation, not types.
- **A client for a two-screen prototype is overkill.** If the app has three endpoints and will be rewritten after the demo, a typed helper function is enough. I add the full structure when a second developer joins or a second screen reads the same data.
- **Do not wrap `@wordpress/core-data` for no reason.** Inside the block editor, core entities like posts and users already have a typed, cached data layer. My client is for custom endpoints, not a replacement for what WordPress already provides.

## What I check on a project like this

1. No component or hook calls `fetch`, `axios` or `apiFetch` directly; all requests go through `src/api/`.
2. Every error reaching the UI has one shape, with per-field messages mapped from Laravel 422s and WordPress error codes.
3. Auth (nonce, CSRF cookie or bearer token) is set in exactly one place.
4. Paginated endpoints return one `Page<T>` shape, whether totals come from headers or from `meta`.
5. Each endpoint's types have a named source: generated from a CI-built spec, inferred from a runtime schema, or hand-written and owned.
6. Money and anything a user acts on is validated at runtime, and contract mismatches are reported to error tracking.
7. Schemas fail on missing or wrong fields, not on new ones.
8. Changes to `src/api/` are reviewed as contract changes, ideally alongside the backend change that caused them.

A typed REST client is not about clever generics. It is about deciding that the contract between a React front end and a WordPress or Laravel backend lives in one place, is checked where it can drift, and fails loudly when it breaks. My default is one client module per API, one error shape, one pagination shape, and types that come from a source someone can point to. The payoff is unglamorous and large: the next renamed field becomes a red build or a clear error in staging, not an empty column a customer finds first.
