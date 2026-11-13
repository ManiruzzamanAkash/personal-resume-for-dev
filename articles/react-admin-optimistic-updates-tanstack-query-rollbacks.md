---
title: "React optimistic updates: when to fake it and how to roll back"
slug: react-admin-optimistic-updates-tanstack-query-rollbacks
date: 2026-11-13
category: React & Frontend
excerpt: "Optimistic updates make an admin feel instant, until a failed request leaves the screen showing something the server never saved. Here is how I decide which actions get them in TanStack Query, and how I make every rollback safe."
readTime: 11 min
tags: [react, tanstack-query, optimistic-updates, typescript, admin-ui, dashboards, frontend, saas]
---

# React optimistic updates: when to fake it and how to roll back

> **In short**
> - **The problem:** admin screens that wait for the server on every click feel slow, so teams add "optimistic" updates that show the result before the server confirms it. Done carelessly, a failed save leaves the screen showing a change that never happened, and staff act on it: they tell a customer a ticket is closed, or skip an order they think is already shipped.
> - **What I do about it:** I sort actions by how much a wrong screen would cost. Cheap, reversible actions get optimistic updates with a tested rollback. Anything that touches money, stock, or permissions waits for the server. Every optimistic change is visibly marked as pending until it is confirmed.
> - **Who this is for:** engineers building React admin panels and SaaS dashboards with TanStack Query, and leads deciding how "instant" a back office should feel.

A typical version of this bug looks like this. A support agent works through a queue and clicks "Mark resolved" on six tickets in a row. Each row disappears instantly, which feels great. The third request failed, a validation error on the server, but the error toast showed for three seconds while the agent was already looking at the next ticket. The row never comes back, or it comes back after the next background refetch, by which time the agent has moved on. The customer waits another day.

Nothing in that code was broken in the obvious sense. There was an `onMutate`, a cache write, and an `onError` that restored the snapshot. The failure was a design decision: an action whose result people act on immediately was made optimistic, and nothing on screen told the agent "this is not saved yet."

I covered the general shape of data fetching in [React data-fetching patterns I trust before a dashboard lies](/article/react-data-fetching-patterns-i-trust-before-dashboard-lies/). This post goes deeper on one part of it: optimistic updates, when they are worth it, and how to make the undo path as solid as the happy path.

## Optimistic updates are a product decision, not a performance trick

An optimistic update means the interface shows the result of an action before the server confirms it, and quietly puts things back if the server says no. It is a bet that the request will succeed. The question is never "can we make this faster?" It is "what happens if we are wrong, and who notices?"

I sort admin actions into three groups before writing any code:

1. **Optimistic by default.** Cheap, reversible, low-stakes: starring an item, marking a notification read, toggling a column, reordering a personal list, renaming a draft. If the update is wrong for two seconds, nobody makes a bad decision.
2. **Optimistic with a visible pending state.** Changes other people may act on, but which are easy to undo: assigning a ticket, changing a task's status, editing a tag. The UI shows the new value immediately, but marked as pending (dimmed, a small spinner, disabled controls) until the server confirms.
3. **Never optimistic.** Money, stock, permissions, anything sent to a customer: refunds, captures, inventory adjustments, role changes, "send invoice". These wait for the server, show a clear in-progress state, and render the server's response, not a guess.

This list does more good than any clever code. Most optimistic-update bugs I see are not cache bugs. They are group-three actions that someone moved into group one because the button felt slow.

## The simplest optimistic update never touches the cache

TanStack Query documents two ways to do this, and the first one is underused. Instead of writing a fake value into the cache, you render the pending mutation's `variables` directly in the component while `isPending` is true. If the request fails, there is nothing to roll back, because the cache was never changed.

```tsx
function AddNote({ ticketId }: { ticketId: number }) {
  const queryClient = useQueryClient();

  const addNote = useMutation({
    mutationKey: ['tickets', ticketId, 'add-note'],
    mutationFn: (body: string) => api.addNote(ticketId, body),
    // Returning the promise keeps the mutation pending until the refetch lands,
    // so the real note replaces the pending one without a flicker.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['tickets', ticketId, 'notes'] }),
  });

  return (
    <>
      <NotesList ticketId={ticketId} />
      {addNote.isPending && <NoteRow body={addNote.variables} pending />}
      {addNote.isError && (
        <NoteRow
          body={addNote.variables}
          error="Not saved"
          onRetry={() => addNote.mutate(addNote.variables)}
        />
      )}
    </>
  );
}
```

Two details make this pattern work. Variables are kept after an error, so the failed note stays on screen with a retry button instead of vanishing. And because `onSettled` returns the invalidation promise, the mutation stays pending until fresh data arrives, so the pending row and the real row never appear at the same time.

If another component needs to show the pending note, give the mutation a `mutationKey` and read it with `useMutationState`, filtering on that key and `status: 'pending'`. I use this approach whenever only one or two places on the screen show the result.

## When several screens show the same data, write to the cache and snapshot first

The cache approach is for when the change must show up everywhere at once: the ticket list, the ticket detail panel, and a counter in the sidebar. The order of operations inside `onMutate` is the whole game: cancel, snapshot, write, return the snapshot.

```tsx
type Ticket = { id: number; status: 'open' | 'resolved'; assigneeId: number | null };

function useUpdateTicketStatus(listKey: readonly unknown[]) {
  return useMutation({
    mutationKey: ['tickets', 'update-status'],
    mutationFn: ({ id, status }: Pick<Ticket, 'id' | 'status'>) =>
      api.updateTicket(id, { status }),

    onMutate: async ({ id, status }, context) => {
      // 1. Stop in-flight refetches from overwriting our optimistic write.
      await context.client.cancelQueries({ queryKey: listKey });
      // 2. Snapshot exactly what we are about to change.
      const previous = context.client.getQueryData<Ticket[]>(listKey);
      // 3. Write the optimistic value.
      context.client.setQueryData<Ticket[]>(listKey, (old) =>
        old?.map((t) => (t.id === id ? { ...t, status } : t)),
      );
      // 4. Hand the snapshot to onError.
      return { previous };
    },

    onError: (_error, _vars, onMutateResult, context) => {
      if (onMutateResult?.previous) {
        context.client.setQueryData(listKey, onMutateResult.previous);
      }
    },

    onSettled: (_data, _error, _vars, _result, context) =>
      context.client.invalidateQueries({ queryKey: ['tickets'] }),
  });
}
```

This matches the callback signatures in current TanStack Query v5, where callbacks receive a `context` with the `client` and the value returned from `onMutate` arrives as `onMutateResult`. Older v5 code takes the client from `useQueryClient()` and calls the third argument `context`. The steps are the same either way.

The step people skip is cancellation. Without `cancelQueries`, a background refetch that started before the click can land after your optimistic write and overwrite it with old data. The row flips back, then forward again when the mutation settles.

## Rollback has to restore what you changed, not what you remember

Snapshot-and-restore is correct for one mutation at a time. It breaks when two mutations overlap, which happens constantly in admin work: an agent resolves ticket A, then ticket B, half a second apart.

Walk through it. Mutation A snapshots the list (both open) and marks A resolved. Mutation B snapshots the list (A resolved, B open) and marks B resolved. Now A fails. Its `onError` restores its snapshot: both open. B's optimistic change has been wiped out by A's rollback, even though B is still in flight and may well succeed.

I handle this in one of three ways, depending on the screen:

- **Undo the specific change, not the whole list.** Instead of restoring a snapshot, the rollback reverses only the row that failed: set ticket A's status back to what it was, and leave the rest alone. For per-row edits this holds up best.
- **Serialize related mutations.** TanStack Query v5 has a `scope` option: mutations that share a `scope.id` run one after another, in the order they started. For a drag-to-reorder list, where each change depends on the one before, making them run in sequence is simpler than reasoning about overlap.
- **Invalidate only when the last mutation settles.** If each mutation's `onSettled` triggers a refetch, an early refetch can land while later mutations are still pending and briefly undo their optimistic state. A common fix is to check `queryClient.isMutating({ mutationKey })` in `onSettled` and only invalidate when this is the last one running. The cache then catches up once, with the server's final answer.

Whatever the approach, the rule is the same: **the server's response is the final truth.** The optimistic value is a placeholder. After every settle, success or failure, the screen should end up showing data the server returned.

## Make "pending" visible, or the optimism becomes a lie

The most important line in an optimistic update is not in `onMutate`. It is the visual marker that says "this has not been saved yet."

For group-two actions I keep a small, explicit pending signal: the row is slightly dimmed, the changed field shows a spinner, and the action buttons on that row are disabled so the same change cannot be sent twice. `useMutationState` with `status: 'pending'` gives you the list of in-flight variables, which is enough to compute a set of pending IDs for the table.

Errors need the same care. A toast that disappears after three seconds is not enough when the user is moving fast. I prefer the failure to stay attached to the row ("Couldn't resolve. Retry") until someone deals with it. Retries are off by default for mutations in TanStack Query, which I think is the right default: a status change that silently retries three times can arrive minutes later and surprise everyone.

## Type the optimistic value like a real server response

A quiet source of bugs is an optimistic object that is missing fields the server would have computed: an `updated_at`, an `available_actions` array, a `total` recalculated from line items. The list renders the fake object, a button that should now be disabled is still enabled, and the user clicks it.

Two habits help. First, only patch fields you can compute exactly on the client. Changing `status` is fine; recalculating an order total is not. Second, let TypeScript enforce the shape: type `setQueryData` with the same type your API client returns, so a partial object does not compile. If the optimistic version of an entity needs fields only the server can produce, that is a strong sign the action belongs in group three. The same thinking applies to forms, which I covered in [React form state and TypeScript validation I trust in admin UIs](/article/react-form-state-typescript-validation-i-trust-in-admin-uis/).

## Trade-offs and when not to do this

Optimistic updates cost something, and I skip them more often than I use them.

- **They add code that only runs on failure.** Rollback paths run rarely, so they rot quietly. If a team will not test the error path, it should not ship the optimistic one.
- **They hide slow servers.** An endpoint that takes two seconds to toggle a flag is a backend problem. Masking it on the client means nobody fixes it, and the next screen that cannot be optimistic is still slow.
- **They mislead on shared data.** If several staff members work the same queue, one person's optimistic view can disagree with what another person sees. For collaborative screens, a fast confirmed update often beats an instant guess.
- **They are wrong for money, stock, and permissions.** I don't make exceptions here. A confirmed state with a clear spinner is the honest choice.

If the honest answer to "what if we're wrong?" is "someone takes a real-world action on bad information," wait for the server.

## What I check on a project like this

1. Every mutation is classified: optimistic, optimistic-with-pending, or confirmed only. Money, stock, permissions, and customer-facing actions are never optimistic.
2. Where only one component shows the result, the UI approach (`variables` + `isPending`) is used instead of writing to the cache.
3. Cache-based updates follow cancel, snapshot, write, return, in that order, and `cancelQueries` is never skipped.
4. Rollbacks undo the specific change, or related mutations share a `scope`, so overlapping requests cannot wipe each other out.
5. `onSettled` brings back the server's truth on both success and failure, and invalidation is not run so early that it undoes other pending changes.
6. Pending rows are visibly marked and their actions disabled, and failures stay on the row with a retry, not only in a toast.
7. Optimistic objects are typed as full API responses, and only fields the client can compute exactly are patched.
8. At least one test makes the server fail and asserts the screen returns to the correct state.

Optimistic updates are worth having in a React admin, but only where being briefly wrong is cheap and clearly marked. My default is simple: render pending state from the mutation when I can, write to the cache only when several screens need it, undo exactly what I changed, and let the server have the last word every time. A dashboard that feels a little less instant but never shows a change that did not happen is the one staff learn to trust.
