---
title: "Laravel multi-tenancy: one database, schemas, or one per tenant?"
slug: laravel-multi-tenancy-single-database-schema-or-database-per-tenant
date: 2026-11-11
category: Laravel
excerpt: "How you separate customer data in a Laravel SaaS decides your hosting bill, your migrations and your worst-case data leak. Here is how I choose between one shared database, schema-per-tenant, and database-per-tenant."
readTime: 10 min
tags: [laravel, multi-tenancy, saas, architecture, mysql, postgresql, founders]
---

# Laravel multi-tenancy: one database, schemas, or one per tenant?

> **In short**
> - **The problem:** every SaaS has to keep one customer's data away from another's. The way you do it is chosen in week one and is very expensive to change later. Pick wrong and you either pay for infrastructure you don't need or ship a bug that shows customer A's invoices to customer B.
> - **What I do about it:** I default to one shared database with a tenant ID enforced in code and tests, and move to separate schemas or databases only when a specific customer, regulation or workload needs it.
> - **Who this is for:** founders and tech leads starting a Laravel SaaS, or deciding whether their current setup will survive the next big customer.

The failure I see most often is not a bad choice of tenancy model. It is a choice nobody made on purpose. The first version of the app adds a `team_id` column to a few tables, someone remembers to filter by it in most controllers, and the product ships. A year later a report query, a queued job or an admin export forgets the filter, and a customer sees rows that belong to somebody else.

The opposite failure is quieter. A team reads that "real" SaaS gives every customer their own database, builds that from day one, and then spends its time on migration runners, connection switching and backups for three hundred databases that each hold a few megabytes of data.

Both are avoidable. There are three common models, and each one fits a different kind of business.

## The three models differ in where the wall between customers sits

"Tenant" here means one paying customer account: a company, a team, a store. The question is where the boundary between tenants lives.

- **Single database, shared tables.** Every tenant's rows sit in the same tables with a `tenant_id` column. The wall is in your application code.
- **Schema per tenant.** One database server and one database, but each tenant gets its own set of tables in a separate schema (a namespace for tables). The wall is in the database's name resolution. In practice this is a PostgreSQL pattern: in MySQL, "schema" and "database" mean the same thing, so this collapses into the third model.
- **Database per tenant.** Each tenant has its own database, sometimes on its own server. The wall is a separate connection and separate credentials.

Moving down that list buys stronger isolation and costs more operational work. Everything else in this article is about when that trade is worth it.

## One shared database is the right default for most SaaS products

For a product with many small and mid-sized customers, a shared database wins on almost every practical measure:

- **One migration run.** A schema change is applied once, not once per tenant.
- **Cross-tenant reporting is just a query.** Usage dashboards, billing reconciliation and support tooling don't need to loop over hundreds of connections.
- **Normal Laravel.** Eloquent, queues, caching and testing work the way the documentation describes. New engineers are productive on day one.
- **Cheap tenants.** A free-trial signup costs one row, not a new database.

The real cost is that isolation depends on every query remembering the tenant. So the job is to make forgetting impossible, or at least loud.

## Make the tenant filter impossible to forget

I don't rely on developers writing `where('tenant_id', ...)` by hand. I put the filter in one place, a global scope applied by a shared trait, and set the tenant once per request or job.

```php
// app/Support/Tenancy/BelongsToTenant.php
trait BelongsToTenant
{
    protected static function bootBelongsToTenant(): void
    {
        static::addGlobalScope('tenant', function (Builder $query) {
            $tenantId = app(CurrentTenant::class)->id();

            // No tenant resolved means a bug, not "show everything".
            if ($tenantId === null) {
                throw new MissingTenantException();
            }

            $query->where($query->getModel()->qualifyColumn('tenant_id'), $tenantId);
        });

        static::creating(function (Model $model) {
            $model->tenant_id ??= app(CurrentTenant::class)->id();
        });
    }
}
```

Three details matter more than the code itself:

1. **Fail closed.** If no tenant is set, throw. A scope that silently returns all rows when the tenant is missing turns a small bug into a data leak.
2. **Set the tenant in jobs, not just requests.** Middleware resolves the tenant from the subdomain or the logged-in user. A queued job runs later, in another process, with no request. The job has to carry the tenant ID and restore it before it touches a model. This is the gap I see most often.
3. **Know where the scope does not apply.** Global scopes cover Eloquent queries. Raw `DB::table()` calls, `DB::select()` and `withoutGlobalScopes()` skip them. I keep those rare, and I flag them in code review.

The last line of defense is a test that tries to cross the wall: create two tenants, act as the first, and assert that every important endpoint and export returns nothing from the second. If that test exists and runs in CI, the shared model is safe enough for most products.

On PostgreSQL you can add row-level security as a second wall, so the database itself refuses rows from the wrong tenant even when the application forgets. It adds setup and makes some debugging harder, so I treat it as an upgrade for sensitive data, not a default.

I touched on settling this early in [structuring a Laravel SaaS for its first three engineers](/article/structuring-laravel-saas-codebase-first-three-engineers/), and on keeping authorization in one consistent place in [Laravel policies, gates and form requests](/article/laravel-policies-gates-form-requests-i-trust-before-secret-ifs/). Tenancy is the same idea one level down: one owner, one check, tested.

## Database per tenant is for contracts, regulations and very uneven customers

Separate databases are worth their cost when a business reason demands it, not when they merely feel cleaner. The reasons I take seriously:

- **A customer's contract or regulator requires it.** Some enterprise buyers ask for their data to be physically separate, held in a specific region, or deletable as a unit. A database per tenant makes "delete everything for this customer" a single command and a clean answer on a security questionnaire.
- **A few tenants are much larger than the rest.** If one customer has more data than all the others combined, their heavy queries slow everyone down in a shared database. Their own database, possibly on their own server, isolates that load.
- **Per-tenant restore.** Restoring one customer's data to yesterday without touching anyone else is simple with separate databases and painful with shared tables.

The cost is real and mostly operational:

- **Migrations run N times.** A deploy has to migrate every tenant database, handle the one that fails halfway, and keep going. Your deploy goes from seconds to however long the slowest tenant takes.
- **Connections multiply.** Queue workers and long-running processes have to switch connections per job, reliably, and never leak the previous tenant's connection into the next job.
- **Cross-tenant questions get hard.** "How many active users do we have?" becomes a loop or a separate reporting pipeline.
- **Onboarding is slower.** Signup now creates a database, runs migrations and seeds it before the customer can log in. That has to be a queued step with a progress state, not a blocking request.

Packages carry a lot of this. Tenancy for Laravel (`stancl/tenancy`) and Spatie's `laravel-multitenancy` both support single-database and multi-database setups, handle tenant identification, and switch connections and other services when a tenant becomes active. I would use one of them rather than write connection switching by hand. They still don't remove the need to understand what happens in your queues, cache keys and file storage when the tenant changes.

## Schema per tenant is a middle ground that mostly suits PostgreSQL shops

On PostgreSQL, giving each tenant its own schema in one database gets you separate tables without separate servers or connection pools. Switching tenants is a matter of changing the `search_path` for the connection, and backups still cover one database.

I reach for it rarely. It keeps the "migrations run N times" cost of database-per-tenant, while only partly delivering its benefits: tenants still share one server's CPU, memory and disk, so a noisy tenant still hurts the others. Large numbers of schemas can also slow down tooling that inspects the whole catalog. It fits a team that is already on PostgreSQL, needs stronger separation than a column, and has a moderate number of tenants. On MySQL, it isn't really an option.

## Hybrid setups are where most mature products end up

The choice doesn't have to be global. A pattern that works well is a shared database for the long tail of small customers, plus dedicated databases for the few enterprise accounts that pay for it. A central "landlord" database holds the list of tenants and which connection each one uses.

This only stays sane if the application code doesn't care which kind of tenant it is serving. The models, scopes and jobs should behave the same way; only the connection differs. If you design the shared model with a clear `CurrentTenant` service from the start, adding dedicated databases later is a contained project rather than a rewrite.

## Trade-offs, and when not to do this

- **Don't build database-per-tenant for an MVP.** Until a real customer asks for it, it is cost without revenue. Build the shared model well, with a single tenant service, so the door stays open.
- **Don't use a package to avoid understanding tenancy.** Packages solve identification and switching. They can't decide what your cache keys, filesystem paths, scheduled commands and search indexes should do per tenant. You still have to.
- **Don't treat the shared model as "less secure" by default.** A shared database with enforced scopes, fail-closed behavior and cross-tenant tests is safer than separate databases with a connection switch that leaks between queued jobs.
- **Don't forget the non-database state.** Redis keys, uploaded files, search indexes and outgoing webhooks all need the tenant in them. Most leaks I'd worry about in a mature app come from these, not from SQL.
- **Changing models later is a migration project, not a refactor.** Moving from shared tables to separate databases means moving data for every tenant with no downtime and no lost writes. Plan it like a launch.

## What I check on a project like this

1. Is the tenancy model written down, with the reason it was chosen?
2. Is there exactly one service that knows the current tenant, and do models get it from there?
3. Does a missing tenant throw an error instead of returning every row?
4. Do queued jobs, scheduled commands and event listeners carry and restore the tenant?
5. Are raw queries and `withoutGlobalScopes()` calls rare and reviewed?
6. Is there a CI test that tries to read one tenant's data as another, across key endpoints and exports?
7. Do cache keys, file paths and search indexes include the tenant?
8. If databases are per tenant, does the deploy handle one tenant's migration failing without stopping the rest?

My default for a new Laravel SaaS is one shared database, a fail-closed tenant scope, tenant-aware jobs and caches, and a test that proves the wall holds. That covers most products for a long time and keeps the team on ordinary Laravel. I move a customer to their own database when a contract, a regulation or their sheer size makes the case, and I keep the code shaped so that move touches the connection, not the business logic. The model matters less than whether anyone decided it on purpose and tested it.
