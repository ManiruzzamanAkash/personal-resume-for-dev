---
title: "Docker multi-stage builds I trust for PHP and Node apps"
slug: docker-multi-stage-builds-php-node-apps
date: 2026-09-22
category: Engineering
excerpt: "Fat images hide secrets, stretch cold starts, and make local and prod drift. Here is how I design multi-stage Dockerfiles for PHP-FPM and Node so build tools stay out of runtime and healthchecks stay honest."
readTime: 14 min
tags: [docker, multi-stage, php, node, compose, devops, containers, healthchecks]
---

# Docker multi-stage builds I trust for PHP and Node apps

I have inherited more “works on my machine” Docker setups than I care to count. A single `FROM php:8.3-fpm` that also runs Composer, copies `.env`, installs `git` and `unzip` “just for the build,” and then ships that same layer to production. Or a Node image that still contains `node_modules` from a `npm install` that mixed `devDependencies` into the runtime. The container starts. The deploy looks green. Then a CVE scanner lights up, cold start balloons, or a secret from a CI bake leak ends up in an intermediate layer someone can `docker history`.

Multi-stage builds are not a Docker party trick. They are how I keep **build tools out of runtime**, keep **local and prod closer than “similar,”** and make sure the image I push is the image I meant to run. This is the pattern I use for PHP-FPM APIs and Node services — the same shape whether the app is a Laravel companion, a small Express worker, or a static Next export builder that only needs Node at build time.

## What “trust” means for an image

Before I touch a `Dockerfile`, I decide what trust means for that service:

1. **Runtime has only what the process needs** — PHP-FPM + extensions + app code, or Node + production `node_modules` + built assets. No Composer, no npm, no build compilers, no git.
2. **Secrets never bake into layers** — no `COPY .env`, no `ARG` that becomes an `ENV` with a token, no `RUN curl ...?token=$SECRET` that leaves the token in history.
3. **Healthchecks match real readiness** — not “process exists,” but “this port answers the way the load balancer will probe.”
4. **Local Compose and prod share the same Dockerfile stages** — different targets (`dev` vs `runtime`), same file, same base pins.

If any of those four fails, I do not call the image production-ready even if `docker compose up` looks fine on a laptop.

## The stage map I reuse

Almost every PHP or Node service I containerize ends up with four logical stages. Names vary; the boundaries do not:

| Stage | Job | Leaves the final image? |
| --- | --- | --- |
| `base` | OS packages, language runtime, shared config | Sometimes (shared parent) |
| `deps` | Install lockfile dependencies (Composer / npm ci) | No — only `COPY --from` |
| `build` | Compile assets, warm caches, strip dev tools | No |
| `runtime` | Non-root user, app files, healthcheck, CMD | **Yes** |

I also keep an optional `dev` target that starts from `base` (or `deps`) and mounts the source tree. Developers run `docker compose --target dev`. CI and prod build `--target runtime`. One Dockerfile. Two lifestyles. Less “we forgot to install ext-intl on staging.”

## PHP-FPM: Composer stays in `deps`

Here is a Dockerfile shape I trust for a PHP-FPM app (Laravel-style or plain Symfony-ish API). Comments are the parts people usually skip — and then pay for:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM php:8.3-fpm-bookworm AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libicu-dev libzip-dev \
    && docker-php-ext-install -j$(nproc) intl pdo_mysql opcache zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# --- dependency stage: only lockfiles, for layer caching ---
FROM base AS deps

COPY composer.json composer.lock ./
RUN --mount=type=cache,target=/tmp/composer-cache \
    COMPOSER_CACHE_DIR=/tmp/composer-cache \
    composer install \
      --no-dev \
      --no-interaction \
      --no-progress \
      --prefer-dist \
      --no-scripts

# --- build stage: full source + scripts that need the app ---
FROM deps AS build

COPY . .
RUN --mount=type=cache,target=/tmp/composer-cache \
    COMPOSER_CACHE_DIR=/tmp/composer-cache \
    composer install \
      --no-dev \
      --no-interaction \
      --no-progress \
      --prefer-dist \
      --optimize-autoloader \
    && php artisan config:clear || true

# --- runtime: no composer binary, no git, non-root ---
FROM php:8.3-fpm-bookworm AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        libicu72 libzip4 \
    && docker-php-ext-install -j$(nproc) intl pdo_mysql opcache zip \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --create-home appuser

WORKDIR /app

COPY --from=build --chown=appuser:appuser /app /app

USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD SCRIPT_NAME=/ping SCRIPT_FILENAME=/ping REQUEST_METHOD=GET \
      cgi-fcgi -bind -connect 127.0.0.1:9000 || exit 1

CMD ["php-fpm", "-F"]
```

A few opinions baked into that file:

- **`composer:2` is copied as a binary into `base`/`deps`, not into `runtime`.** Runtime never needs Composer. If a deploy “needs composer install on the server,” the image is wrong.
- **Lockfiles copy first.** Changing application PHP should not bust the dependency layer every time.
- **BuildKit cache mounts** for Composer keep CI fast without stuffing the cache into the image.
- **`runtime` reinstalls only runtime `.so` dependencies**, not `git` / `unzip`. Build packages and runtime packages are different lists on purpose.
- **Non-root `USER`.** Running FPM as root in 2026 is a smell I reject in review.

For the healthcheck: classic PHP-FPM does not speak HTTP on 9000. Either expose a tiny sidecar nginx that proxies `/health`, or use `cgi-fcgi` against a ping script your FPM pool serves. A `CMD` that only checks `pidof php-fpm` will stay green while the pool is wedged. I have been burned by that.

## Node: install once, copy the right tree

Node services fail multi-stage in a different way: people `npm install` in the final image, or they copy the whole monorepo into runtime “because TypeScript paths.” The pattern I want:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

FROM base AS build
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build \
 && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN useradd --system --uid 10001 --create-home appuser

COPY --from=build --chown=appuser:appuser /app/package.json ./
COPY --from=build --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/dist ./dist

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
```

Notes I argue for in PRs:

- **`npm ci` with the lockfile**, not `npm install`. Reproducible installs or you are debugging “works in CI” forever.
- **Separate `deps` (prod-only) and `build` (full install)** when the build needs compilers or TypeScript. Then `npm prune --omit=dev` (or copy only `dist` + prod `node_modules`) so runtime stays lean.
- **Copy explicit paths into `runtime`.** `COPY --from=build /app /app` is convenient and often ships `.git`, test fixtures, and local `.env.example` noise. Be deliberate.
- **Healthcheck hits the same `/health` the load balancer uses.** If the app needs a DB for “ready,” decide whether the probe is liveness (process up) or readiness (can serve traffic). I usually expose both and wire the orchestrator correctly — Docker Compose `healthcheck` is closer to readiness for dependency ordering.

For a **static Next export** (the shape this portfolio itself uses), Node belongs only in `build`. Runtime can be `nginx:alpine` or any static file server — no Node in prod at all. That is still multi-stage: the builder is disposable.

## Compose: one file, two targets

Local parity dies when developers run a totally different Dockerfile. I keep Compose pointed at the same file with a `target`:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    env_file:
      - .env.docker
    ports:
      - "8080:8080"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:8080/health"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 20s

  api-dev:
    profiles: ["dev"]
    build:
      context: .
      dockerfile: Dockerfile
      target: base
    volumes:
      - ./:/app
    command: ["php-fpm", "-F"]
    env_file:
      - .env.docker
    depends_on:
      db:
        condition: service_healthy

  db:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: app
      MYSQL_USER: app
      MYSQL_PASSWORD_FILE: /run/secrets/db_password
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_password
    secrets:
      - db_password
      - db_root_password
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "--password=$$(cat /run/secrets/db_root_password)"]
      interval: 5s
      timeout: 5s
      retries: 20

secrets:
  db_password:
    file: ./secrets/db_password.txt
  db_root_password:
    file: ./secrets/db_root_password.txt
```

Practices I enforce:

- **`depends_on` with `condition: service_healthy`**, not bare depends_on. Racey “API started before MySQL accepts connections” bugs are not cute.
- **Secrets as files**, not plaintext in `environment:` blocks committed to git. Compose secrets are imperfect compared with Kubernetes/Doppler, but they beat `.env` in the image.
- **A `dev` profile** that mounts source, so people are not rebuilding runtime layers for every PHP edit — without teaching them a second Dockerfile.

## Secrets: what never belongs in a layer

I review Dockerfiles the way I review payment webhooks: assume the artifact will leak.

**Never:**

- `COPY .env` / `COPY .env.production`
- `ENV DATABASE_URL=postgres://user:pass@...`
- `ARG NPM_TOKEN` followed by `ENV NPM_TOKEN=$NPM_TOKEN` (the ARG still shows in `docker history` for that stage unless you isolate it)
- Baking SSH private keys “temporarily” for a private Composer repo

**Prefer:**

- BuildKit `--mount=type=secret,id=npm,target=/run/secrets/npm` during `npm ci`
- Runtime injection via the orchestrator (Compose secrets, Kubernetes secrets, cloud task env)
- Private package auth only in the `deps`/`build` stage, never in `runtime`

Example for a private npm package during build only:

```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,target=/root/.npm \
    npm ci
```

The secret file is available for that `RUN`. It is not committed into a layer the way `COPY .npmrc` would be.

## Pin bases, shrink attack surface

Floating tags (`node:latest`, `php:8`) make “reproducible builds” a joke. I pin:

- Major.minor language images I have tested (`node:22-bookworm-slim`, `php:8.3-fpm-bookworm`)
- Prefer **slim/bookworm** over fat images when extensions allow
- Re-read changelogs when bumping; do not silent-float in CI

I also delete build packages in the same `RUN` that installs them when I must use a single stage temporarily — but I treat single-stage as technical debt, not a pattern.

Distroless or chainguard-style runtimes are excellent when the app is a static binary or a self-contained Node dist. For PHP-FPM with dynamic extensions, a slim Debian/PHP image is usually the honest choice. Cleverness that breaks `docker-php-ext-install` is not a win.

## Local vs prod: close the gaps that matter

Perfect parity is a myth. Useful parity is not:

| Concern | Local | Prod |
| --- | --- | --- |
| Dockerfile | Same file | Same file |
| Target | `base` / `dev` | `runtime` |
| Code | Bind mount | `COPY` in image |
| Env | `.env.docker` + secrets files | Orchestrator secrets |
| Healthcheck | Same path `/health` | Same path |
| User | Ideally non-root too | Non-root required |

The bugs I still see: local runs as root so file permissions “work,” prod runs as `appuser` and the volume is unwritable; local skips OPcache / `NODE_ENV=production` so performance characteristics never match; local uses published ports while prod uses an internal network and the healthcheck URL diverges.

I fix those in Compose and the Dockerfile together — not with a wiki page that nobody reads after onboarding.

## A short review checklist

Before I merge a Dockerfile PR:

1. **Final stage has no Composer/npm/git/build-essential** unless the product *is* a build tool.
2. **No secrets in `ENV` / `COPY` of env files.**
3. **Lockfiles drive installs** (`composer.lock`, `package-lock.json` / `pnpm-lock.yaml`).
4. **Non-root `USER`** in runtime.
5. **Healthcheck probes the real listen path**, and Compose `depends_on` waits on healthy dependencies.
6. **`.dockerignore`** excludes `.git`, `node_modules`, `vendor`, local env files, and test junk so build context stays small and clean.
7. **Image builds twice in CI** — once as `runtime` for the artifact, optionally once verifying `dev` still builds — so target drift is caught early.

A minimal `.dockerignore` I start from:

```gitignore
.git
.gitignore
node_modules
vendor
.env
.env.*
!.env.example
npm-debug.log
Dockerfile*
docker-compose*.yml
README.md
tests
coverage
```

## Why this still matters on small teams

Multi-stage discipline looks like ceremony when the app is “just a side API.” Then the side API holds payment callbacks, or merchant tokens, or a queue worker with DB credentials. The image becomes the deployment unit. Everything you left in that unit — compilers, tokens, root shells — travels with every replica.

I ship PHP and Node services for product companies where containers are how code reaches Hostinger VPS boxes, CI runners, and cloud workers alike. The Dockerfile is part of the architecture, not an afterthought next to `README.md`. Multi-stage builds are how I keep that architecture honest: **build where you must, run with as little as you can, and make the healthcheck tell the truth.**

When the next service needs a container, I do not start from a blog post’s single-stage example. I start from `base` → `deps` → `build` → `runtime`, wire Compose to the same file, and refuse to merge until secrets and healthchecks survive a cold `docker compose up --build`.
