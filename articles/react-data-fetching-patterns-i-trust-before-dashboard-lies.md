---
title: "React data-fetching patterns I trust before a dashboard lies"
slug: react-data-fetching-patterns-i-trust-before-dashboard-lies
date: 2026-09-27
category: Engineering
excerpt: "A React admin that shows stale totals after a mutation is worse than a slow spinner. Here is how I shape TanStack Query, cache keys, and mutation boundaries so dashboards stay honest under real traffic."
readTime: 14 min
tags: [react, tanstack-query, typescript, data-fetching, admin-ui, performance, hooks, frontend]
---

# React data-fetching patterns I trust before a dashboard lies

I have shipped React admin screens that looked finished in a demo and lied the week a merchant clicked **Refund** twice. The mutation succeeded. The toast said success. The order table still showed `paid` for thirty seconds because someone treated `useEffect` + `fetch` as a cache, and nobody invalidated the right key.

That is the failure mode I care about more than bundle size. A dashboard that is slow but truthful is annoying. A dashboard that is fast and **wrong** destroys trust — support tickets, double refunds, “the UI said it worked.” This article is not a TanStack Query install tour. It is the data-fetching shape I insist on before I call a React admin or product UI production-ready: query keys that mean something, stale vs fresh policy you can explain, mutations that own invalidation, and loading states that do not paper over races.

I build these UIs beside Laravel and WordPress APIs for years — LaraDashboard-style admin work, client SaaS consoles, plugin settings screens that grew into real apps. The framework on the server changes. The honesty problem does not.

## What “trust” means for client data

Before I pick a library, I write down four rules for every screen that shows money, inventory, or permissions:

1. **The UI never invents state the server did not confirm.** Optimistic updates are allowed only when rollback is trivial and the user can see a pending marker.
2. **Every list and detail view has a stable cache identity.** Same entity, same key. No “fetch in `useEffect` and stuff into `useState`” that nobody else can invalidate.
3. **A mutation that changes a resource also owns how related views refresh.** Success toast without invalidation is a bug.
4. **Loading and error are first-class.** Empty array is not “still loading.” A 403 is not “no rows.”

TanStack Query (React Query) is the tool I reach for when those rules matter. You can reinvent parts of it. You will reinvent the hard parts badly under concurrency.

## Start with query keys, not with hooks

Most teams start with `useQuery({ queryFn })` and invent keys later. I invert that. The key is the API contract of the cache.

```ts
// lib/query-keys.ts
export const queryKeys = {
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters: OrderFilters) =>
      [...queryKeys.orders.lists(), filters] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.orders.details(), id] as const,
  },
  merchants: {
    detail: (id: string) => ['merchants', 'detail', id] as const,
  },
};
```

Why the nesting? Because after `POST /orders/:id/refund` I want:

```ts
await queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(id) });
```

Not a blanket `invalidateQueries()` that refetches the whole app. Not a stringly-typed `'orders'` that collides with a different feature’s key. Hierarchical keys let me invalidate a prefix without hunting every screen.

If two components fetch “the same” order with different keys — `['order', id]` vs `['orders', id]` — you have two caches and one source of bugs. I review key factories in PR the way I review Eloquent eager loads.

## `staleTime` is a product decision

Default `staleTime: 0` means every mount considers data stale and may refetch. That is honest for a trading desk. It is noisy for a settings form the user opened twice in one minute.

I set defaults per **domain**, not globally to “make it feel fast”:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (count, error) => {
        if (isClientError(error)) return false; // 4xx: do not thrash
        return count < 2;
      },
      refetchOnWindowFocus: true,
    },
  },
});
```

Then override where truth matters more than calm:

```ts
useQuery({
  queryKey: queryKeys.orders.detail(orderId),
  queryFn: () => api.orders.get(orderId),
  staleTime: 0, // money path: prefer fresh
});

useQuery({
  queryKey: ['feature-flags'],
  queryFn: api.flags.list,
  staleTime: 5 * 60_000, // flags change rarely in a session
});
```

`refetchOnWindowFocus` has saved me more than it has annoyed me. A merchant alt-tabs back from Stripe. The order detail refetches. They see the status the server has now — not the one from ten minutes ago. If focus refetch is too aggressive for a huge list, raise `staleTime` on that query instead of disabling focus globally.

## One query per screen concern — not one mega-fetch

I still see dashboards that do:

```ts
const { data } = useQuery({
  queryKey: ['dashboard'],
  queryFn: () => api.dashboard.everything(),
});
```

Then every widget waits on the slowest backend join. A failed metrics endpoint blanks the whole page. Mutations cannot invalidate “just the open orders widget.”

Prefer **composed queries**:

```tsx
function OrdersDashboard() {
  const open = useQuery({
    queryKey: queryKeys.orders.list({ status: 'open' }),
    queryFn: () => api.orders.list({ status: 'open' }),
  });
  const revenue = useQuery({
    queryKey: ['metrics', 'revenue', 'today'],
    queryFn: () => api.metrics.revenueToday(),
  });

  return (
    <>
      <RevenueCard query={revenue} />
      <OpenOrdersTable query={open} />
    </>
  );
}
```

Each card owns its loading and error UI. The revenue card can spin while the table already shows rows. That is how real ops consoles feel — not a single full-page skeleton forever.

When the backend truly needs one round-trip, expose a BFF endpoint — but keep **client cache entries split** if the UI invalidates them separately. Sometimes that means the BFF returns a bundle and I `setQueryData` into multiple keys in `queryFn`. Rare, but cleaner than one immortal blob.

## Mutations that own the aftermath

`useMutation` without a plan for the cache is how dashboards lie. My checklist after every successful write:

1. Update or invalidate the **detail** of the entity you changed.
2. Invalidate **lists** that might include it (filters make this non-obvious).
3. Invalidate **aggregates** (counts, badges, revenue) that derived from it.
4. Only then show the success toast.

```ts
const refund = useMutation({
  mutationFn: (input: RefundInput) => api.orders.refund(input),
  onSuccess: async (_data, variables) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.detail(variables.orderId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.lists(),
      }),
      queryClient.invalidateQueries({
        queryKey: ['metrics', 'revenue'],
      }),
    ]);
  },
});
```

I prefer `invalidateQueries` over clever `setQueryData` for anything that touches money or permissions. Patching local cache feels fast until a field you forgot (`refunded_at`, `available_actions`) stays stale. Optimistic UI is fine for “mark notification read.” It is a liability for “capture payment” unless you have exhaustive types and a rollback path you have tested.

For list reorder or checkbox toggles where latency matters, I still optimistic-update — but I keep a `pendingIds` Set in component state so the row shows a spinner and disables the button. Silent optimism on financial rows is how double-submit bugs hide.

## Race conditions: the cancel and the id check

Two classic lies:

1. User switches from order A to order B quickly. Response for A arrives last and paints over B.
2. User filters a table; an older filter response overwrites the newer one.

TanStack Query keys fix most of this because each `orderId` or filter object is a different cache entry, and the hook tracks the active key. If you roll your own `useEffect`, you must cancel or ignore stale responses:

```ts
useEffect(() => {
  const controller = new AbortController();
  let active = true;

  api.orders
    .get(orderId, { signal: controller.signal })
    .then((order) => {
      if (active) setOrder(order);
    })
    .catch((err) => {
      if (err.name !== 'AbortError' && active) setError(err);
    });

  return () => {
    active = false;
    controller.abort();
  };
}, [orderId]);
```

I would rather not maintain that. Query libraries exist so every screen does not relearn abort controllers. If you must hand-roll (tiny widget, no provider), the `active` flag + `AbortController` pair is the minimum I accept in review.

## TypeScript: type the transport, not just the component

A typed component with `data: any` from `fetch` is cosplay. I type the API boundary once:

```ts
type Order = {
  id: string;
  status: 'pending' | 'paid' | 'refunded';
  total_cents: number;
  currency: string;
};

async function getOrder(id: string): Promise<Order> {
  const res = await apiFetch(`/api/orders/${id}`);
  return OrderSchema.parse(await res.json()); // zod — fail loud
}
```

Then:

```ts
const { data } = useQuery({
  queryKey: queryKeys.orders.detail(id),
  queryFn: () => getOrder(id),
});
// data is Order | undefined — status switches are exhaustive
```

Runtime parse at the edge catches backend drift before the UI renders `undefined.toFixed`. That has paid for itself more times than prettier generics on the button props.

## Loading UX that does not erase context

`isLoading` (no data yet) and `isFetching` (request in flight, maybe with cached data) are different. I use them differently:

- **First paint, no cache:** skeleton or structured placeholder matching layout.
- **Background refetch with cache:** keep showing previous data; optional subtle indicator (`isFetching && data`).
- **Mutation in flight:** disable the action; do not unmount the whole table.

```tsx
function OrderDetail({ id }: { id: string }) {
  const q = useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => getOrder(id),
  });

  if (q.isPending) return <OrderSkeleton />;
  if (q.isError) return <QueryError error={q.error} onRetry={q.refetch} />;

  return (
    <section aria-busy={q.isFetching}>
      {q.isFetching ? <RefreshHint /> : null}
      <OrderHeader order={q.data} />
    </section>
  );
}
```

Blanking the page on every refetch trains users to ignore the UI. Keeping stale pixels without a hint trains them to act on ghosts. The middle path — show data, mark freshness — is what I ship.

## Pagination and filters belong in the key

Cursor or page number in React state but **not** in the query key is how you get “page 2 content under page 1 chrome.”

```ts
useQuery({
  queryKey: queryKeys.orders.list({ status, page, q }),
  queryFn: () => api.orders.list({ status, page, q }),
  placeholderData: keepPreviousData, // smooth page flips
});
```

`keepPreviousData` (or `placeholderData: keepPreviousData` depending on version) keeps the previous page visible while the next loads — again, with `isFetching` for honesty. I avoid infinite scroll in admin tables unless the product truly needs it; page numbers are debuggable in support (“look at page 3”).

## When I skip a query library

I do not wrap every decorative fetch. Marketing page testimonials? Static props or a single `useEffect` is fine. A public docs site with no mutations? Same.

I reach for TanStack Query when:

- Multiple components share server state
- Mutations must refresh related views
- Focus/reconnect refetch matters
- I need deduping of identical in-flight requests

If the app is a thin form posting to one endpoint with a full navigation after save, `useState` + `fetch` is enough. Do not bring a cache to a page that never reuses data.

## Testing the honesty, not the mock theater

My minimum tests for a refund button:

1. Click refund → `mutationFn` called with the right payload.
2. On success → `invalidateQueries` ran for detail + lists (spy on `QueryClient`).
3. On error → previous cache still shown; error surface visible; button re-enabled.

I care less about snapshotting the spinner SVG. I care that the cache contract holds. MSW or a thin API mock is enough; I do not mock TanStack Query itself into a fake that cannot catch invalidation bugs.

## A note on Server Components

Next.js App Router server components change the default for **first paint**. I still use client query caches for dashboards that stay open, mutate often, and need focus refetch. Pattern I like:

- Server Component loads the initial order (or list) and passes it as `initialData` / dehydrated state.
- Client `QueryClientProvider` takes over for interactivity.

That avoids a loading waterfall on first visit without giving up mutation-driven invalidation. For a fully static marketing site — including this portfolio — you do not need any of this. For an ops console that sits open all afternoon, you do.

## Production checklist I actually use

Before I merge a React admin feature:

- Query keys live in one module; no ad-hoc string arrays in components
- Money and permission paths use low `staleTime` or explicit invalidate-after-mutation
- Mutations invalidate detail, lists, and aggregates — verified in a test or a manual script
- Errors distinguish 401/403/404/5xx in the UI copy
- Double-click on destructive actions is disabled while `isPending`
- No `any` on `queryFn` return types for domain entities
- Focus refetch left on unless a measured reason says otherwise

When I help teams untangle “the dashboard said paid but Stripe said refunded” — the same class of honesty problems that show up when agencies grow client consoles and product UIs around stacks we discuss at [SquartUp](https://squartup.com) — the fix is rarely a new chart library. It is cache identity, mutation boundaries, and refusing to toast success until the views that matter agree with the server.

## Closing

React is excellent at rendering. It will happily render a lie if you feed it one. Data-fetching architecture is how you stop feeding it lies: stable keys, deliberate freshness, mutations that clean up after themselves, and loading states that respect what the user already knows.

Ship the spinner if you must. Never ship a confident wrong number.
