---
title: "Laravel policies, gates, and Form Requests I trust before controllers grow secret ifs"
slug: laravel-policies-gates-form-requests-i-trust-before-secret-ifs
date: 2026-09-30
category: Engineering
excerpt: "Controllers full of ownership ifs are how authorization drifts. Here is how I shape Laravel policies, gates, and Form Request ownership so admins, teams, and API clients stay honest under real product pressure."
readTime: 12 min
tags: [laravel, php, authorization, policies, gates, form-requests, security, api, saas]
---

# Laravel policies, gates, and Form Requests I trust before controllers grow secret ifs

I can smell a Laravel app that grew authorization in the controller. It starts innocent: one `$project->user_id === $user->id` check in `update`, then a second one in `destroy`, then a special case for “admins can do anything,” then a teammate who can edit if they are in `project_user`, then a JSON endpoint that forgot the check entirely. Six months later, every write action has a slightly different story about who is allowed to touch the row.

Policies and gates are not ceremony. They are how I keep **one authorization truth** that controllers, Form Requests, Blade, and API resources can all ask. This is the shape I trust before I let a SaaS controller accumulate secret `if` trees.

## What I refuse to call “secured”

A green feature test that hits a happy path as the owner is not an authorization model. Before I call a write endpoint done, I want:

1. **A named ability** (`update`, `delete`, `inviteMember`) that lives on a policy or gate — not a private controller method reused by copy-paste.
2. **The same denial path for web and API** — `403` with a consistent body, not a redirect for Blade and a silent `404` for JSON unless I chose that on purpose.
3. **Ownership and role rules that are testable without booting the whole HTTP stack** — policy unit tests, plus a few HTTP tests for wiring.
4. **Form Requests that authorize before they validate** — so a malicious payload never reaches domain code just because the JSON looked valid.
5. **No “admin bypass” sprinkled as `|| $user->isAdmin()` in twelve places** — admins go through the same policy method, usually with an early return that is still named and logged when it matters.

If authorization is only “we check `user_id` in the controller,” you do not have a policy — you have a habit that will miss the next endpoint.

## Policies for resource shape, gates for app-wide verbs

I split the two tools by **what they answer**:

| Tool | Question it answers | Typical home |
| --- | --- | --- |
| **Policy** | “Can this user perform this action on **this model**?” | `ProjectPolicy`, `InvoicePolicy` |
| **Gate** | “Can this user perform this **app-wide** action?” | `viewHorizon`, `accessBilling`, `impersonate` |
| **Form Request** | “Is this HTTP payload allowed **and** valid for this action?” | `UpdateProjectRequest` |

Policies attach to Eloquent models. Gates attach to verbs that are not one model instance — or to ops tools that should stay out of `UserPolicy`. Form Requests are the HTTP front door: they call `$this->user()->can(...)` (or `$this->authorize(...)`) so controllers stay thin.

When a teammate asks “where do I add the rule that only billing owners can export invoices?”, I should be able to point at **one method**, not a grep across controllers.

## The policy I start with on every owned resource

Assume a multi-tenant-ish project board: a `Project` belongs to an owner, has members, and has statuses that lock edits. This is the skeleton I reach for first:

```php
<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

class ProjectPolicy
{
    public function viewAny(User $user): bool
    {
        return true; // listing is filtered in the query; see below
    }

    public function view(User $user, Project $project): bool
    {
        return $this->isMember($user, $project);
    }

    public function create(User $user): bool
    {
        return $user->can('projects.create'); // gate or permission package
    }

    public function update(User $user, Project $project): bool
    {
        if ($project->isArchived()) {
            return false;
        }

        return $this->isOwnerOrEditor($user, $project);
    }

    public function delete(User $user, Project $project): bool
    {
        return $this->isOwner($user, $project);
    }

    public function inviteMember(User $user, Project $project): bool
    {
        return $this->isOwnerOrEditor($user, $project)
            && ! $project->isArchived();
    }

    private function isOwner(User $user, Project $project): bool
    {
        return (int) $project->owner_id === (int) $user->id;
    }

    private function isMember(User $user, Project $project): bool
    {
        if ($this->isOwner($user, $project)) {
            return true;
        }

        return $project->members()->where('user_id', $user->id)->exists();
    }

    private function isOwnerOrEditor(User $user, Project $project): bool
    {
        if ($this->isOwner($user, $project)) {
            return true;
        }

        return $project->members()
            ->where('user_id', $user->id)
            ->whereIn('role', ['editor', 'owner'])
            ->exists();
    }
}
```

A few opinions baked in:

- **Archive is a hard deny for writes**, not a soft UI hide. Policies are where “the resource state forbids mutation” belongs.
- **`viewAny` is rarely where I filter the list.** Listing scopes belong on the query (`Project::query()->visibleTo($user)`). The policy answers “may they hit the index at all?”; the query answers “which rows?”
- **Custom abilities** (`inviteMember`) beat stuffing every product verb into `update`. Controllers and Form Requests stay readable when the ability name matches the product language.

Register it the boring way — Laravel’s auto-discovery usually finds `Project` → `ProjectPolicy`. If I ever hand-register, I do it in `AuthServiceProvider` once and never again in a controller constructor.

## Controllers that ask, then act

The controller I trust looks almost empty on authorization:

```php
public function update(UpdateProjectRequest $request, Project $project)
{
    $project->fill($request->validated())->save();

    return new ProjectResource($project->fresh());
}

public function destroy(Project $project)
{
    $this->authorize('delete', $project);

    $project->delete();

    return response()->noContent();
}
```

`UpdateProjectRequest` owns the `update` ability. `destroy` can use `$this->authorize` directly when there is no body to validate. What I do **not** want:

```php
// The pattern I delete on sight.
if ($project->owner_id !== auth()->id() && ! auth()->user()->isAdmin()) {
    abort(403);
}
```

That `if` will be reimplemented wrong in the next action. Put the admin rule in the policy (or a `before` hook — carefully) so every ability inherits it on purpose.

### `before` hooks: powerful, easy to regret

```php
public function before(User $user, string $ability): ?bool
{
    if ($user->hasRole('super-admin')) {
        return true;
    }

    return null; // fall through to the ability method
}
```

I use `before` for a **narrow** break-glass role, not for “every staff user.” Super-admin bypass that skips `delete` on legal holds is how you get a compliance incident with a clean audit log that says “policy said yes.” Prefer ability-specific admin checks when the domain has irreversible actions.

## Form Requests as the ownership gate for writes

Validation without authorization is how attackers probe for field mass-assignment while your policy sits unused in a controller that never got called the way you imagined. My default Form Request:

```php
<?php

namespace App\Http\Requests;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;

class UpdateProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var Project $project */
        $project = $this->route('project');

        return $this->user()->can('update', $project);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['required', 'in:active,paused'],
        ];
    }

    protected function prepareForValidation(): void
    {
        // Normalize — never authorize here.
        $this->merge([
            'name' => trim((string) $this->input('name')),
        ]);
    }
}
```

Notes I enforce in review:

- **`authorize()` runs before `rules()`** in Laravel’s Form Request lifecycle. Good — keep it that way in your head when debugging.
- **Route model binding gives you the instance.** Do not re-query by an untrusted `project_id` from the body for the auth check.
- **Never put ownership rules only in `rules()` with a fancy `Rule::exists`.** Exists checks are not authorization. A row can exist and still be none of your business.

For create endpoints, `authorize()` often maps to `create` on the policy with the class name:

```php
return $this->user()->can('create', Project::class);
```

## Gates for verbs that are not one model

Horizon’s `viewHorizon` gate, billing portal access, “can impersonate,” “can run dangerous artisan from the UI” — those are gates. Example:

```php
use Illuminate\Support\Facades\Gate;

Gate::define('accessBilling', function (User $user) {
    return $user->isOwnerOfCurrentTeam()
        || $user->tokenCan('billing:read'); // Sanctum ability if token auth
});

Gate::define('impersonate', function (User $user) {
    return $user->hasRole('support') && $user->mfa_confirmed_at !== null;
});
```

I keep gates **small and boring**. When a gate starts loading five relationships and interpreting a JSON permissions column, I promote that logic into a dedicated action or a policy on a `Team` model. Gates that become mini-ORMs are how authorization becomes undebuggable.

## Query scopes so list endpoints cannot leak

Authorization on `show`/`update` is useless if `index` returns every row in the table. I pair policies with a scope:

```php
// app/Models/Project.php
public function scopeVisibleTo($query, User $user)
{
    return $query->where(function ($q) use ($user) {
        $q->where('owner_id', $user->id)
          ->orWhereHas('members', fn ($m) => $m->where('user_id', $user->id));
    });
}

// controller
public function index(Request $request)
{
    $this->authorize('viewAny', Project::class);

    $projects = Project::query()
        ->visibleTo($request->user())
        ->latest()
        ->paginate(20);

    return ProjectResource::collection($projects);
}
```

If someone removes the scope, tests must fail. I treat “index without `visibleTo`” as a security bug, not a style nit.

## API tokens and policies: same abilities, different actor

With Sanctum (or Passport), the actor is still a `User` (or a tokenable model), but **token abilities** are an extra dimension. I do not replace policies with `tokenCan` alone. I compose them:

```php
public function update(User $user, Project $project): bool
{
    if ($user->currentAccessToken()
        && ! $user->tokenCan('projects:write')) {
        return false;
    }

    return $this->isOwnerOrEditor($user, $project);
}
```

Or keep token ability checks at the route middleware (`ability:projects:write`) and let the policy stay about **ownership and state**. Pick one layering and document it — mixing “middleware checks token” with “policy also checks token differently” is how mobile clients get mysterious 403s after a scope rename.

## Blade and Inertia: hide buttons, still enforce on the server

I use `@can` / `<Authorize>` to hide UI. I never trust the UI:

```blade
@can('update', $project)
    <a href="{{ route('projects.edit', $project) }}">Edit</a>
@endcan
```

A disabled button is not a security boundary. The Form Request and policy are. When I ship admin UIs for products — including agency work I have done around shipping calendars and client portals for teams like [SquartUp](https://squartup.com) — the same rule holds: the browser can lie; the policy must not.

## Tests I require before merge

Minimum set for a new ability:

```php
public function test_owner_can_update_project(): void
{
    $owner = User::factory()->create();
    $project = Project::factory()->for($owner, 'owner')->create();

    $this->assertTrue($owner->can('update', $project));
}

public function test_member_viewer_cannot_update_project(): void
{
    $viewer = User::factory()->create();
    $project = Project::factory()->create();
    $project->members()->attach($viewer->id, ['role' => 'viewer']);

    $this->assertFalse($viewer->can('update', $project));
}

public function test_update_endpoint_returns_403_for_viewer(): void
{
    $viewer = User::factory()->create();
    $project = Project::factory()->create();
    $project->members()->attach($viewer->id, ['role' => 'viewer']);

    $this->actingAs($viewer)
        ->patchJson(route('projects.update', $project), ['name' => 'Nope', 'status' => 'active'])
        ->assertForbidden();
}

public function test_index_does_not_leak_foreign_projects(): void
{
    $user = User::factory()->create();
    Project::factory()->create(); // someone else's
    $mine = Project::factory()->for($user, 'owner')->create();

    $this->actingAs($user)
        ->getJson(route('projects.index'))
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $mine->id);
}
```

Policy unit assertions are cheap. The HTTP 403 test proves the Form Request (or `authorize` call) is actually wired. The index leak test is the one that saves you when a junior removes a scope “to make the test pass.”

## Anti-patterns I delete in review

1. **`$request->user()->id === $model->user_id` in the controller** after a policy already exists for that model.
2. **Authorizing in a service class with `abort(403)`** buried three layers down — prefer throwing `AuthorizationException` or returning a domain result, but decide authorization at the edge (Form Request / controller) when you can.
3. **`findOrFail` by body id, then policy on a different route model** — classic IDOR setup.
4. **Policies that query the world** without caching membership for the request — N policy checks × N membership queries. Use `$project->setRelation('members', ...)` or a request-scoped membership checker when a page authorizes many children.
5. **“Soft” authorization** — returning empty data instead of 403 for write attempts. Soft-hide is fine for list filtering; for `DELETE`, I want a hard deny.

## A practical rollout for a messy legacy controller

If you inherit the secret-`if` style, do not rewrite the universe in one PR:

1. **Add the policy** with methods that mirror today’s controller rules (even if ugly).
2. **Point one Form Request at it** and delete the inline `if`.
3. **Add the three tests** (allow, deny, index leak if relevant).
4. **Move the next action** — `delete`, then `invite`, then the JSON sibling routes.
5. **Only then** refactor membership helpers and admin `before` hooks.

Authorization refactors that change behavior without tests are how you lock out the founder on a Friday.

## What I want in `CODEOWNERS` and PR templates

For apps where money or private data move, I ask for:

- Every new write route names a **policy ability** or **gate** in the PR description.
- Controllers stay free of ownership comparisons.
- At least one **deny** test per new ability.

That sounds heavy until the first IDOR ticket. Then it feels cheap.

## Closing

Laravel gives you a clear stack: **gates for app verbs, policies for model verbs, Form Requests for HTTP write entry, query scopes for lists**. Controllers should look like they trust that stack — because they do. When I open a codebase and every `update` method re-explains who the owner is, I do not blame the junior who added the fifth `if`. I blame the missing policy.

Ship the policy first. Make the controller boring. Let the tests prove that “viewer” still means viewer after the next feature lands.
