---
title: "Docker Compose healthchecks and secrets I trust before local lies to prod"
slug: docker-compose-healthchecks-secrets-parity-i-trust
date: 2026-09-29
category: Engineering
excerpt: "A green docker compose up is not parity. Here is how I shape Compose healthchecks, secrets, overlays, and profiles for PHP and Node stacks so local and prod stop drifting in the ways that hurt."
readTime: 13 min
tags: [docker, compose, healthchecks, secrets, devops, php, node, laravel, containers, mysql, redis]
---

# Docker Compose healthchecks and secrets I trust before local lies to prod

I already wrote about multi-stage Dockerfiles — how I keep Composer and npm out of runtime, how BuildKit secrets stay out of layers, how a `runtime` target differs from a `dev` mount. That article stops at the image boundary. Most of the pain I still debug lives **one layer up**: in `docker-compose.yml`.

Someone runs `docker compose up`, the API container exits once because MySQL was still initializing, they add a `sleep 10` in an entrypoint, ship it, and six months later staging flakes every cold deploy. Or the app reads `DB_PASSWORD` from a committed `.env.docker` while production injects a different secret through the host — until someone copies the wrong file into a backup. Or Redis is “healthy” because the process exists, while the app connects to a passworded instance that rejects `PING` without `AUTH`.

Compose is not “local Docker.” For a lot of the PHP and Node services I ship, Compose **is** the local orchestrator and the template for how prod will wire networks, readiness, and secrets. This is the Compose discipline I want before I trust a stack.

## What I refuse to call “parity”

Parity does not mean identical files on a laptop and in production. It means the **failure modes match**:

1. **Readiness is real.** App containers do not accept traffic until dependencies they need are actually usable — not merely started.
2. **Secrets stay out of git and out of images.** Local may use file-backed Compose secrets; prod may use a vault or host env. Neither path bakes credentials into a layer or a committed YAML value.
3. **Service names and ports inside the network stay stable.** `mysql:3306`, `redis:6379`, `app:9000` should mean the same thing in every environment that uses Compose-shaped networking.
4. **Workers, schedulers, and one-shot migrators are first-class services**, not “run this SSH command after up.”
5. **The same Compose project can target `dev` (bind mount) and `prod-like` (image target) without a second undocumented stack.**

If local skips healthchecks “because it’s faster” and prod depends on them, you do not have a shared model — you have two systems that occasionally look alike.

## The file layout I start from

I almost never maintain one giant compose file forever. I start with a small family:

```text
compose.yaml                 # services, networks, volumes, secrets (no host-specific paths if I can help it)
compose.override.yaml        # local defaults Compose auto-loads: bind mounts, published ports, dev targets
compose.prod.yaml            # image digests / runtime targets, restart policies, no published DB ports
secrets/                     # gitignored local secret files for Compose `file:` secrets
.env.example                 # non-secret knobs documented for humans
```

Compose merges `compose.yaml` + `compose.override.yaml` automatically for local `docker compose up`. CI and prod-like runs use explicit files:

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
```

That split matters more than clever YAML anchors. Local needs published ports and bind mounts. Prod-like needs the opposite. Fighting that with one file full of comments is how overrides get copy-pasted wrong.

## A PHP + Node stack that tells the truth

Here is a shape I trust for a Laravel-style API (PHP-FPM + Nginx) with a small Node sidecar (Vite build in dev, or a realtime/worker helper), MySQL, and Redis. The Dockerfile multi-stage story lives elsewhere; Compose’s job is wiring.

```yaml
# compose.yaml
services:
  nginx:
    image: nginx:1.27-alpine
    depends_on:
      php:
        condition: service_healthy
    ports:
      - "8080:80"
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    networks: [appnet]

  php:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    env_file:
      - path: .env.docker
        required: false
    environment:
      DB_HOST: mysql
      DB_PORT: 3306
      DB_DATABASE: app
      DB_USERNAME: app
      REDIS_HOST: redis
      REDIS_PORT: 6379
    secrets:
      - db_password
      - app_key
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "php -r '$$f=@fsockopen(\"127.0.0.1\",9000); exit($$f?0:1);'",
        ]
      interval: 10s
      timeout: 3s
      retries: 6
      start_period: 20s
    networks: [appnet]

  queue:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    command: ["php", "artisan", "queue:work", "--sleep=1", "--tries=3", "--max-time=3600"]
    env_file:
      - path: .env.docker
        required: false
    secrets:
      - db_password
      - app_key
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks: [appnet]

  mysql:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: app
      MYSQL_USER: app
      MYSQL_PASSWORD_FILE: /run/secrets/db_password
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_password
    secrets:
      - db_password
      - db_root_password
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "mysqladmin ping -h 127.0.0.1 -uroot --password=\"$$(cat /run/secrets/db_root_password)\" --silent",
        ]
      interval: 5s
      timeout: 5s
      retries: 20
      start_period: 30s
    networks: [appnet]

  redis:
    image: redis:7.4-alpine
    command:
      [
        "redis-server",
        "--requirepass",
        "/run/secrets/redis_password",
        "--appendonly",
        "yes",
      ]
    # Prefer redis.conf that reads requirepass from a file, or an entrypoint
    # that exports REDISCLI_AUTH. The point: AUTH must match the app.
    secrets:
      - redis_password
    volumes:
      - redis_data:/data
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "REDISCLI_AUTH=\"$$(cat /run/secrets/redis_password)\" redis-cli ping | grep -q PONG",
        ]
      interval: 5s
      timeout: 3s
      retries: 10
    networks: [appnet]

  node:
    profiles: ["frontend"]
    build:
      context: .
      dockerfile: Dockerfile.node
      target: dev
    working_dir: /app
    command: ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
    volumes:
      - ./resources/js:/app/resources/js
      - ./package.json:/app/package.json:ro
      - ./package-lock.json:/app/package-lock.json:ro
    ports:
      - "5173:5173"
    networks: [appnet]

networks:
  appnet:
    driver: bridge

volumes:
  mysql_data:
  redis_data:

secrets:
  db_password:
    file: ./secrets/db_password.txt
  db_root_password:
    file: ./secrets/db_root_password.txt
  redis_password:
    file: ./secrets/redis_password.txt
  app_key:
    file: ./secrets/app_key.txt
```

A few opinions baked into that sketch:

- **`queue` is a sibling of `php`**, not an afterthought. If Horizon or `queue:work` is how prod runs jobs, local must feel that shape.
- **`node` sits behind a Compose profile** (`frontend`). API-only work does not drag a Vite process online.
- **MySQL and Redis are not published to the host by default** in the base file. Local override can publish them for GUI clients; prod-like must not.
- **Secrets are files under `./secrets/`**, gitignored, documented in README with `cp secrets.example/* secrets/`.

## Healthchecks: the part people fake

Bare `depends_on: [mysql]` only waits for the container to start. MySQL’s process can be up while InnoDB is still recovering. Redis can accept TCP before it loads AOF. PHP-FPM can be listening while `vendor/` is missing because a volume wiped it.

I treat healthchecks as **contracts**:

| Service | Bad check | Check I actually want |
| --- | --- | --- |
| MySQL | `CMD mysqladmin ping` without auth that matches reality | `mysqladmin ping` with the same secret file the server uses |
| Redis | TCP connect only | `redis-cli ping` **with** the password the app will use |
| PHP-FPM | `pgrep php-fpm` | Socket/port accept, or a tiny `php-fpm-healthcheck` against the pool |
| HTTP app | `curl localhost` that hits a static file | `curl -fsS http://127.0.0.1/health` that touches DB/redis **cheaply** or reports degraded honestly |
| Nginx | process exists | Upstream can proxy to a healthy PHP upstream |

### `start_period` is not optional

Cold MySQL on a laptop with a large volume needs grace. Without `start_period`, Compose burns retries during legitimate boot and marks the service unhealthy. I set `start_period` from observed cold-start times, not from a blog default.

### App-level `/health` vs process-level checks

For the PHP container behind Nginx, I often keep **two** layers:

1. **Container healthcheck** — “FPM is accepting connections.”
2. **HTTP readiness** — Nginx or the load balancer probes `/health` / `/up` that returns 200 only when the app can see MySQL (and optionally Redis).

Do not make `/health` run a twenty-join dashboard query. A `SELECT 1` plus a Redis `PING` is enough. If you need deep dependency graphs, expose `/ready` and `/live` separately and document which one gates deploys.

### `depends_on` with `condition: service_healthy`

This is non-negotiable for app and worker services:

```yaml
depends_on:
  mysql:
    condition: service_healthy
  redis:
    condition: service_healthy
```

If a teammate removes it “to make boot faster,” I put it back. Racey boots are slower than waiting five seconds for a real ready signal.

## Secrets: Compose’s awkward but useful middle ground

Compose secrets are not Kubernetes secrets. On a single host they are mostly bind-mounted files under `/run/secrets/...`. That is still better than:

```yaml
environment:
  DB_PASSWORD: "super-secret"   # now it is in git history forever
```

Rules I enforce in review:

1. **No plaintext passwords in committed compose files.** Ever.
2. **Prefer `*_FILE` environment variables** when the image supports them (`MYSQL_PASSWORD_FILE`, and app code that reads `DB_PASSWORD_FILE` if you control the entrypoint).
3. **`.env` / `.env.docker` hold non-secret config** (hostnames, feature flags, log level). Real credentials live in `secrets/*.txt` or the host’s secret store.
4. **`secrets/` is gitignored.** Ship `secrets.example/` with empty or dummy values and a setup script.
5. **Production does not reuse the laptop secret files.** Prod overlay swaps `file:` secrets for external ones, or stops using Compose secrets and injects via the platform.

For Laravel specifically, I often make the entrypoint map files into env vars before `php-fpm` starts:

```sh
# docker/php/entrypoint.sh (sketch)
set -euo pipefail
if [ -f /run/secrets/db_password ]; then
  export DB_PASSWORD="$(cat /run/secrets/db_password)"
fi
if [ -f /run/secrets/app_key ]; then
  export APP_KEY="$(cat /run/secrets/app_key)"
fi
exec docker-php-entrypoint "$@"
```

That keeps secret material out of the image and out of `compose.yaml`, while the framework still sees normal `env()` keys.

## Local override: bind mounts without lying

`compose.override.yaml` is where local convenience lives:

```yaml
# compose.override.yaml — auto-merged for local
services:
  php:
    build:
      target: base   # or a dedicated `dev` stage with Composer available
    volumes:
      - ./:/app
    user: "${UID:-1000}:${GID:-1000}"
    environment:
      APP_ENV: local
      APP_DEBUG: "true"

  mysql:
    ports:
      - "3306:3306"

  redis:
    ports:
      - "6379:6379"
```

The traps I watch for:

- **Root in the container, non-root UID on the host** → files owned by root clutter the tree. Align UIDs or use a documented `user:`.
- **Bind-mounting over `/app/vendor`** after the image already built vendor → empty vendor, mysterious class-not-found. Either mount carefully (named volume for `vendor/`) or accept that local `composer install` runs on the host/container intentionally.
- **`APP_DEBUG=true` leaking into prod overlay** — prod file must set debug false and never inherit the override file.

## Prod-like overlay: close the ports, pin the target

```yaml
# compose.prod.yaml
services:
  nginx:
    restart: unless-stopped
    ports:
      - "80:80"

  php:
    build:
      target: runtime
    restart: unless-stopped
    environment:
      APP_ENV: production
      APP_DEBUG: "false"
    # no bind mounts

  queue:
    restart: unless-stopped

  mysql:
    # deliberately no host ports
    restart: unless-stopped

  redis:
    restart: unless-stopped
```

When I say “prod-like Compose,” I mean a smoke environment on a VPS or CI service job — not a claim that Compose replaces Kubernetes for every scale. For small Laravel apps on a single VPS, this overlay **is** often production. Treat it with the same seriousness.

## One-shot migrators beat “migrate in the web entrypoint”

I do not run `php artisan migrate --force` on every web container start in a multi-replica world. Racey migrations are a classic outage. In Compose I prefer a profiled one-shot:

```yaml
services:
  migrate:
    profiles: ["migrate"]
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    command: ["php", "artisan", "migrate", "--force"]
    secrets:
      - db_password
      - app_key
    depends_on:
      mysql:
        condition: service_healthy
    networks: [appnet]
    restart: "no"
```

Deploy sequence becomes intentional:

```bash
docker compose -f compose.yaml -f compose.prod.yaml run --rm migrate
docker compose -f compose.yaml -f compose.prod.yaml up -d
```

Local can still use the same service when schema changes. The web container stays dumb: serve requests, do not own schema.

## Networks and DNS: keep names boring

I keep one user-defined bridge (`appnet`) for app traffic. Service DNS names are short and stable: `mysql`, `redis`, `php`, `nginx`. I do not rename them per environment. When a config says `DB_HOST=mysql`, that string should work in every Compose-shaped deploy.

Published ports are a **host concern**, not an identity. Inside the network, MySQL remains `3306` even if the host maps `3307:3306` for a conflicting local install.

## Resource limits and restart policy before the first incident

Compose lets you postpone cgroup limits until the laptop fans scream. I still set a baseline in prod-like files:

```yaml
services:
  php:
    mem_limit: 512m
    cpus: "1.0"
    restart: unless-stopped
  mysql:
    mem_limit: 1g
    restart: unless-stopped
```

Exact numbers depend on the box. The point is to fail loudly when a leak grows, not to OOM-kill the whole host with no clues. `restart: unless-stopped` on long-running workers; `restart: "no"` on migrators.

## A review checklist I actually use

Before I merge a Compose PR for a PHP/Node app:

1. **Every datastore the app needs has a healthcheck that uses the same credentials the app will use.**
2. **App and workers use `depends_on` with `condition: service_healthy`.**
3. **No secrets in committed YAML or tracked `.env*` files.**
4. **`secrets/` (or equivalent) is gitignored; examples exist.**
5. **Local override and prod overlay are separate; `docker compose config` is readable in both modes.**
6. **Migrations are a one-shot (profile/service), not a hidden side effect of web boot.**
7. **Queue/scheduler processes are declared services**, matching how prod runs jobs.
8. **MySQL/Redis are not published on prod-like configs.**
9. **`start_period` reflects real cold starts** on the target disk, not wishful thinking.
10. **A cold `docker compose down -v && docker compose up --build` reaches healthy without manual sleeps.**

That last one is the exam. If a new hire cannot bring the stack up from zero without reading Slack lore, the Compose file is unfinished.

## How this sits next to the Dockerfile work

Multi-stage builds answer: *what is inside the image?* Compose answers: *how do those images become a system?* I want both documents in the repo — and I want them to agree on service names, health endpoints, and where secrets enter the process.

When local “works” with a bind-mounted `.env` and a `sleep 15`, and prod “works” with a different secret injection path and no healthchecks, you do not have Docker adoption. You have two staging lies with the same logo.

I ship PHP APIs, queue workers, and small Node companions on Compose-shaped hosts often enough that I stopped treating `compose.yaml` as scaffolding. It is part of the architecture: **honest healthchecks, boring DNS names, secrets as files or platform injections, overlays instead of tribal knowledge, and migrations that run once on purpose.**

If your stack still boots on hope and `sleep`, fix the Compose contracts before you buy a more complicated orchestrator. Complexity does not heal a readiness model you never wrote down.
