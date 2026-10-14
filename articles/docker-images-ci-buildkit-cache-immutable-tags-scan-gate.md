---
title: "Docker images in CI: BuildKit cache, immutable tags, and the scan gate I trust"
slug: docker-images-ci-buildkit-cache-immutable-tags-scan-gate
date: 2026-10-14
category: Engineering
excerpt: "A clean Dockerfile is only half the story. The other half is the pipeline that builds it: cache that actually hits, tags that never move under you, a vulnerability gate people do not learn to ignore, and a deploy that pins a digest instead of hoping latest is the right latest."
readTime: "14 min"
tags: [docker, ci-cd, github-actions, buildkit, containers, security, devops, php, node]
---

# Docker images in CI: BuildKit cache, immutable tags, and the scan gate I trust

I have written about the inside of the image before: multi-stage Dockerfiles that keep Composer and npm out of runtime, and Compose files whose healthchecks and secrets do not lie to you locally. Those two pieces stop at a boundary — the moment the image exists on a laptop.

The bugs I keep meeting live **after** that boundary. In the pipeline that builds the image, names it, scans it, pushes it, and hands it to whatever runs it. A Dockerfile can be perfect and the delivery still be wrong:

- CI builds take nine minutes because the cache never hits, so people stop waiting for them and start merging on yellow.
- Production runs `:latest`, and nobody can say which commit that is without SSHing into the box and running `docker inspect`.
- A vulnerability scanner runs on every build, prints three hundred lines, and has not failed a single job in a year — because someone set `exit-code: 0` during an incident and never reverted it.
- Staging tested one image and production rebuilt "the same" commit an hour later and got a different base layer.

None of these are exotic. They are what happens when the image pipeline is treated as glue instead of as part of the architecture. This is the setup I trust now for PHP and Node services, mostly on GitHub Actions with GHCR, but the ideas transfer to GitLab CI or any registry.

## What I actually want from an image pipeline

Before any YAML, I write down the properties. If a pipeline does not give me these, I do not care how clever it is:

1. **Fast on the common path.** A change to one controller should not reinstall every Composer and npm dependency. If the warm build is not dramatically faster than the cold one, the cache is broken.
2. **Traceable.** Given a running container, I can name the commit, the workflow run, and the base image it was built from in under a minute.
3. **Immutable.** The thing I tested is byte-for-byte the thing I deploy. Not "built from the same SHA" — the *same digest*.
4. **Gated, honestly.** Known-critical vulnerabilities with an available fix block the release. Everything else is reported, triaged, and has an owner and an expiry.
5. **Reversible.** Rollback is "point at the previous digest", not "revert, rebuild, and pray the base image did not move".

Everything below is in service of those five lines.

## Cache keys start in the Dockerfile, not in CI

People reach for CI cache settings first. In my experience, half of all "the cache never hits" complaints are the Dockerfile invalidating its own layers, and no cache backend can fix that.

BuildKit caches a layer when the instruction **and its inputs** are unchanged. For `COPY`, the inputs are the file contents. So the order of copies is your cache key design:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM php:8.3-fpm-bookworm AS base
WORKDIR /var/www/html
RUN apt-get update \
 && apt-get install -y --no-install-recommends libzip-dev libicu-dev \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql zip intl opcache \
 && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
# Only the lockfiles. A controller change must not bust this layer.
COPY composer.json composer.lock ./
RUN --mount=type=cache,target=/root/.composer/cache \
    composer install --no-dev --no-scripts --no-autoloader --prefer-dist

FROM node:22-bookworm-slim AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY resources/ resources/
COPY vite.config.js ./
RUN npm run build

FROM base AS runtime
COPY --from=deps /var/www/html/vendor ./vendor
COPY . .
COPY --from=assets /app/public/build ./public/build
COPY --from=deps /usr/bin/composer /usr/bin/composer
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative \
 && rm /usr/bin/composer \
 && chown -R www-data:www-data storage bootstrap/cache
USER www-data
```

The rules I hold myself to:

- **Lockfiles before source.** `COPY composer.json composer.lock` and `COPY package.json package-lock.json` come before `COPY . .`. A source-only change then rebuilds only the cheap layers.
- **The asset stage copies only what the bundler reads.** If `assets` did `COPY . .`, editing a PHP migration would rebuild the whole frontend.
- **`.dockerignore` is part of the cache key.** If `.git`, `storage/logs`, or `node_modules` leak into the context, `COPY . .` changes every build, and the final layers never hit. I have seen a 400 MB build context caused by one forgotten `coverage/` directory.
- **No timestamps or build numbers in early layers.** An `ARG BUILD_NUMBER` used in the second instruction invalidates everything below it on every run. Metadata belongs in labels at the end, or in the final stage only.

One subtle point that bites people on CI: `--mount=type=cache` directories are **not exported** with the layer cache. They are local to the BuildKit instance. On an ephemeral runner, they start empty every time. They still help on persistent builders and laptops, but on hosted runners the real win comes from layer cache — which is why lockfile ordering matters more than cache mounts there.

## CI cache backends: pick one and understand its limits

With `docker/build-push-action` and Buildx, I use one of two backends.

### `type=gha` for most repositories

The GitHub Actions cache backend is the zero-infrastructure option:

```yaml
cache-from: type=gha,scope=app-${{ github.ref_name }}
cache-to: type=gha,mode=max,scope=app-${{ github.ref_name }}
```

What I have learned to watch:

- **`mode=max` matters for multi-stage builds.** The default (`mode=min`) only exports layers that end up in the final image. Your `deps` and `assets` stages — the expensive ones — are not in the final image, so with `min` they are rebuilt from scratch every time. `max` exports intermediate stages too.
- **Scope per branch, with a fallback to main.** Feature branches should read main's cache so the first build on a new branch is warm, but should not overwrite it:

```yaml
cache-from: |
  type=gha,scope=app-${{ github.ref_name }}
  type=gha,scope=app-main
cache-to: type=gha,mode=max,scope=app-${{ github.ref_name }}
```

- **The repository cache budget is finite.** GitHub evicts least-recently-used entries when you exceed it, and a few `mode=max` multi-stage images across many branches fill it quickly. When builds suddenly go cold for everyone, eviction is the first thing I check.

### `type=registry` when the cache must outlive the CI platform

For larger images, or when several pipelines (CI plus a self-hosted builder) need the same cache, I push cache to the registry as its own artifact:

```yaml
cache-from: type=registry,ref=ghcr.io/acme/shop-api:buildcache
cache-to: type=registry,ref=ghcr.io/acme/shop-api:buildcache,mode=max
```

The cache tag is a separate ref, not a runnable image. I keep it out of retention cleanup rules and never deploy it. The trade-off is that cache traffic now counts against registry storage and pull bandwidth — fine for most teams, worth knowing before it shows up on a bill.

Either way, I measure. The first PR that touches the pipeline gets a note in its description: cold build time, warm build time after a source-only change, warm build time after a lockfile change. If those three numbers are not clearly different, something is invalidating too early.

## Tags: names for humans, digests for machines

This is the part I am most opinionated about, because it is where incidents hide.

A tag is a **mutable pointer**. `:latest`, `:main`, `:staging` — any of them can be moved by the next push. A digest (`sha256:…`) is the content address of the manifest. It cannot move. If two systems agree on a digest, they agree on every byte.

So I separate the two jobs:

| Tag | Mutable? | Who uses it |
| --- | --- | --- |
| `sha-<full commit sha>` | No (by convention, never re-pushed) | CI, audit, rollback lookup |
| `v1.14.2` | No | Release notes, humans |
| `main`, `staging` | Yes | Humans browsing the registry |
| `@sha256:…` | Impossible to move | **Deploys** |

`docker/metadata-action` generates the human tags and OCI labels so I am not hand-rolling string logic in Bash:

```yaml
- id: meta
  uses: docker/metadata-action@v5
  with:
    images: ghcr.io/acme/shop-api
    tags: |
      type=sha,format=long
      type=ref,event=branch
      type=semver,pattern={{version}}
    labels: |
      org.opencontainers.image.title=shop-api
```

It also adds `org.opencontainers.image.revision` and `org.opencontainers.image.source` labels. That is what makes the "which commit is this?" question a one-liner on any box:

```bash
docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' shop-api-web-1
```

What I never do anymore:

- Deploy `:latest`. Not to staging, not "just for this one service".
- Re-push a version tag. If `v1.14.2` was wrong, the fix is `v1.14.3`.
- Let a deploy script resolve a tag at deploy time on each host. Two hosts resolving `:main` thirty seconds apart can end up on different images. Resolve once, in CI, to a digest, and hand the digest down.

## Build once, then scan the exact artifact

The ordering mistake I see most often: build and scan in one job with `load: true`, then build *again* to push. The second build usually hits the cache and produces the same layers — usually. "Usually" is not a property I want between a scanner and production.

My pipeline builds and pushes **once**, under the immutable SHA tag only, then scans that digest straight from the registry, and only then attaches the tags that mean "this is releasable".

```yaml
- id: build
  uses: docker/build-push-action@v6
  with:
    context: .
    target: runtime
    push: true
    tags: ghcr.io/acme/shop-api:sha-${{ github.sha }}
    labels: ${{ steps.meta.outputs.labels }}
    cache-from: |
      type=gha,scope=app-${{ github.ref_name }}
      type=gha,scope=app-main
    cache-to: type=gha,mode=max,scope=app-${{ github.ref_name }}
    provenance: mode=max
    sbom: true
```

The step exposes `steps.build.outputs.digest`. From here on, nothing in the workflow refers to a tag when it means "the artifact".

### A scan gate people do not learn to ignore

Scanners fail in one of two directions. Too strict, and every build is red because of an unfixable CVE in a base library nobody calls — so people disable the gate. Too loose, and it is a log nobody reads. I aim for a narrow, enforced gate plus a broad, reported view:

```yaml
- name: Gate on fixable HIGH/CRITICAL
  env:
    TRIVY_USERNAME: ${{ github.actor }}
    TRIVY_PASSWORD: ${{ secrets.GITHUB_TOKEN }}
  run: |
    trivy image \
      --severity HIGH,CRITICAL \
      --ignore-unfixed \
      --ignorefile .trivyignore.yaml \
      --exit-code 1 \
      ghcr.io/acme/shop-api@${{ steps.build.outputs.digest }}

- name: Full report (never fails the job)
  if: always()
  run: |
    trivy image --format sarif --output trivy.sarif --exit-code 0 \
      ghcr.io/acme/shop-api@${{ steps.build.outputs.digest }}
```

The gate fails only on HIGH or CRITICAL findings **that have a fix available**. That is a finding someone can act on today: bump the base image, bump a package, rebuild. The full report goes to code scanning so the long tail is visible without blocking work.

Exceptions are where gates rot, so exceptions must be written down with a reason and an expiry:

```yaml
# .trivyignore.yaml
vulnerabilities:
  - id: CVE-2026-XXXXX
    statement: "Affects the libxml2 XInclude path; we never parse untrusted XML with XInclude. Revisit on next base bump."
    expired_at: 2026-11-30
```

When `expired_at` passes, the finding comes back and the build fails again. That one field does more for vulnerability hygiene than any dashboard I have seen, because it turns "we'll look at it later" into a date on the calendar.

A rule I enforce in review: **a PR that sets the scanner's exit code to 0, or adds an ignore entry without an expiry, needs a second reviewer.** Gates do not die in one dramatic commit. They die in a "temporary" tweak during an incident.

## SBOM and provenance: cheap now, priceless later

Those two lines in the build step — `provenance: mode=max` and `sbom: true` — attach attestations to the image in the registry. The SBOM lists every package in the image. Provenance records how it was built: source repo, commit, workflow, build arguments.

I did not care about either until the first time a new CVE dropped in a widely used library and someone asked, "Which of our running images contain it?" Without SBOMs, that question means pulling every deployed image and scanning it. With them, it is a query against data you already stored:

```bash
docker buildx imagetools inspect ghcr.io/acme/shop-api@sha256:... \
  --format '{{ json .SBOM }}' | jq '.. | .name? // empty' | sort -u | grep -i libxml
```

Signing with Sigstore cosign is the next step if your deploy targets can verify signatures before running an image. I recommend it once the basics above are boring. I do not recommend starting there while the deploy still pulls `:latest`.

## Promotion is a retag, never a rebuild

Once the digest passes tests and the scan gate, "release to staging" and "release to production" are just new names for the same manifest. `docker buildx imagetools create` writes a new tag that points at an existing digest without pulling or rebuilding anything:

```bash
docker buildx imagetools create \
  -t ghcr.io/acme/shop-api:staging \
  ghcr.io/acme/shop-api@sha256:3f9c...

# later, after staging soaks
docker buildx imagetools create \
  -t ghcr.io/acme/shop-api:v1.14.2 \
  -t ghcr.io/acme/shop-api:production \
  ghcr.io/acme/shop-api@sha256:3f9c...
```

This is the property that removes a whole category of "but it worked on staging" — staging and production are literally running the same digest. If production behaves differently, the difference is configuration, data, or traffic, not the artifact. That narrows a debugging session from hours to minutes.

## Deploy by digest and keep the previous one

On the receiving side — a VPS running Compose, an ECS task definition, a Kubernetes manifest — I pin the digest. With Compose, that is just interpolation:

```yaml
# compose.prod.yml
services:
  web:
    image: ghcr.io/acme/shop-api@${APP_DIGEST:?set APP_DIGEST}
  worker:
    image: ghcr.io/acme/shop-api@${APP_DIGEST:?set APP_DIGEST}
    command: ["php", "artisan", "queue:work", "--max-time=3600"]
```

The `:?` makes Compose refuse to start if the variable is missing — far better than silently falling back to some default tag. The web process and the queue worker share a digest, so they can never disagree about the code or the database schema they expect.

The deploy script records each digest it rolls out:

```bash
#!/usr/bin/env bash
set -euo pipefail

NEW_DIGEST="$1"
STATE_DIR=/srv/shop-api/state

cp "$STATE_DIR/current" "$STATE_DIR/previous" 2>/dev/null || true
echo "$NEW_DIGEST" > "$STATE_DIR/current"

APP_DIGEST="$NEW_DIGEST" docker compose -f compose.prod.yml pull
APP_DIGEST="$NEW_DIGEST" docker compose -f compose.prod.yml up -d --wait
```

`--wait` blocks until the healthchecks pass, so a broken image fails the deploy instead of "succeeding" into a crash loop. Rollback is the same script with the content of `previous`. No rebuild, no revert commit racing through CI while customers watch a 502. Revert the code afterwards, calmly.

## Multi-arch: only when you have a reason

Buildx makes `platforms: linux/amd64,linux/arm64` look free. It is not. On amd64 runners, the arm64 half builds under QEMU emulation, and compiling PHP extensions or native npm modules under emulation can make a two-minute build take twenty.

I build multi-arch when there is a real consumer: arm64 production instances that are cheaper for the workload, or a team on Apple Silicon that pulls CI images for local development. When I do:

- I prefer **native arm64 runners** and merge the per-platform digests into one manifest list, rather than emulating.
- I scan **each platform**, because the arm64 image has different packages and can have different findings.
- I keep cache scopes separate per platform so one architecture does not evict the other.

If nobody runs arm64, I build amd64 only and say so in the README. Unused architectures are just extra build minutes and extra attack surface to scan.

## Base images move — make that a scheduled, visible event

Pinning `php:8.3-fpm-bookworm` keeps the major and minor version stable, but the tag still moves when upstream publishes patch releases and OS security fixes. That is good — you want those patches — but you want them **on purpose**, not as a surprise inside an unrelated feature PR.

Two habits:

1. **Pin the base by digest** and let Renovate or Dependabot open PRs when it moves: `FROM php:8.3-fpm-bookworm@sha256:...`. The bump becomes a reviewable diff with its own CI run and scan result.
2. **A scheduled weekly rebuild of main**, with the cache disabled for the base stage, so images that have not had a code change in a month still pick up OS patches. A service that "has not changed" for six months usually has an image that is six months behind on security fixes.

## Registry hygiene: keep what you might roll back to

Immutable SHA tags pile up fast — every merge to main adds one. Without cleanup, registry storage grows forever. With careless cleanup, the rollback target is gone exactly when you need it.

My retention rules:

- Keep every **semver** tag.
- Keep the last **N SHA tags** from main (I use around 30 for a service that deploys daily).
- Never delete anything referenced by `current` or `previous` on any environment. The deploy state files make this checkable.
- Delete untagged manifests and PR-branch images after a short window.
- Exclude the `buildcache` ref from cleanup if you use registry cache.

## The workflow, assembled

Putting it together, a trimmed version of what I start new services from:

```yaml
name: image

on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:

permissions:
  contents: read
  packages: write
  security-events: write

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      digest: ${{ steps.build.outputs.digest }}
    steps:
      # In real repos, pin third-party actions to full commit SHAs.
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/acme/shop-api
          tags: |
            type=sha,format=long
            type=ref,event=branch
            type=semver,pattern={{version}}

      - id: build
        uses: docker/build-push-action@v6
        with:
          context: .
          target: runtime
          push: true
          tags: ghcr.io/acme/shop-api:sha-${{ github.sha }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: |
            type=gha,scope=app-${{ github.ref_name }}
            type=gha,scope=app-main
          cache-to: type=gha,mode=max,scope=app-${{ github.ref_name }}
          provenance: mode=max
          sbom: true

      - name: Install Trivy
        # Pin a specific Trivy version here in real repos.
        run: |
          curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
            | sh -s -- -b /usr/local/bin

      - name: Scan gate
        env:
          TRIVY_USERNAME: ${{ github.actor }}
          TRIVY_PASSWORD: ${{ secrets.GITHUB_TOKEN }}
        run: |
          trivy image --severity HIGH,CRITICAL --ignore-unfixed \
            --ignorefile .trivyignore.yaml --exit-code 1 \
            ghcr.io/acme/shop-api@${{ steps.build.outputs.digest }}

      - name: Apply human tags
        if: github.event_name != 'pull_request'
        run: |
          args=()
          while read -r tag; do
            [ -n "$tag" ] && args+=(-t "$tag")
          done <<< "${{ steps.meta.outputs.tags }}"
          docker buildx imagetools create "${args[@]}" \
            ghcr.io/acme/shop-api@${{ steps.build.outputs.digest }}
```

Notice where the human tags are applied: **after** the gate, and only outside pull requests. A PR image can exist under its SHA tag for testing, but it never gets a name that looks deployable. The deploy job — a separate workflow with its own environment protection rules — takes `needs.build.outputs.digest` and nothing else.

## The review checklist I use for pipeline PRs

When someone changes the image workflow or the Dockerfile's layer order, I go through this before approving:

1. **Lockfiles are copied before source** in every stage that installs dependencies.
2. **`.dockerignore` excludes** `.git`, `node_modules`, `vendor`, logs, coverage, and local env files.
3. **Multi-stage builds export cache with `mode=max`**, and feature branches read main's scope.
4. **The artifact is built once.** Nothing downstream rebuilds; everything refers to the digest.
5. **The scan runs against that digest** and fails on fixable HIGH/CRITICAL findings.
6. **Every ignore entry has a statement and an expiry.**
7. **Human tags are applied after the gate**, never on PR builds, and version tags are never re-pushed.
8. **Deploys pin a digest**, record the previous one, and wait for healthchecks.
9. **The base image is pinned and bumped by bot PRs**, with a scheduled rebuild for quiet services.
10. **Retention keeps every rollback target.**

## Why I treat this as architecture

It is tempting to see all of this as DevOps ceremony for big teams. I think the opposite is true. On a small team, nobody has time for a two-hour incident caused by "staging and production were not actually the same image", or for an audit question nobody can answer because the registry is a pile of `:latest` overwrites.

The Dockerfile decides what is inside the box. The pipeline decides whether you can **trust the label on the box** — which commit it came from, whether it was checked, and whether the box running in production is the same one you tested. Getting the label right is not polish. It is the difference between a rollback that takes thirty seconds and one that takes an afternoon.

So my default for every new service is the same: lockfile-first layers, `mode=max` cache with a main fallback, one build per commit, a narrow scan gate with expiring exceptions, promotion by retag, and deploys pinned to a digest. None of it is clever. That is the point. When something breaks at 2 a.m., I want the pipeline to be the most boring part of the system.
