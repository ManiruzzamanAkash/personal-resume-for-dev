---
title: "Zero-downtime Laravel deploys on a small VPS: atomic releases I trust"
slug: zero-downtime-laravel-deploys-small-vps-atomic-releases
date: 2026-10-10
category: Engineering
excerpt: "A git pull on a live server is not a deploy strategy. Here is how I ship Laravel to a single VPS with atomic release folders, a symlink switch, safe migrations, graceful PHP-FPM and queue reloads, and a rollback I can run half asleep."
readTime: 12 min
tags: [laravel, deployment, vps, nginx, php-fpm, github-actions, ci-cd, zero-downtime, devops]
---

# Zero-downtime Laravel deploys on a small VPS: atomic releases I trust

Most small Laravel products I have seen start their life with a deploy that looks like this: SSH into the server, `cd /var/www/app`, `git pull`, `composer install`, `php artisan migrate`, and hope. It works for a while. Then one day Composer takes forty seconds to resolve, a user hits a page while half the vendor folder is new and half is old, and you get a white screen with a class-not-found error in the logs. Or a migration fails halfway and the code is already on the new version.

I like big platforms, but a lot of real products live on one honest VPS with Nginx and PHP-FPM. That box can deploy without downtime. It just needs a bit of discipline. This is the setup I trust: atomic release folders, a single symlink switch, migrations that respect the old code, graceful reloads, and a rollback that is one command.

## What "zero downtime" actually means here

I want to be precise, because people mean different things by it.

- **No request ever sees a half-written codebase.** The code a request runs is either fully the old release or fully the new one.
- **No 502s during the switch.** PHP-FPM workers finish in-flight requests before they pick up new code.
- **Database changes never break the release that is still serving traffic.** For a short window, old code and new schema coexist.
- **Queue workers do not keep running stale code for hours.** They restart cleanly after the switch.
- **Rollback is fast and boring.** Point the symlink back, reload, done.

It does not mean a multi-region failover. On one VPS, if the machine dies, you are down. That is a different problem and you solve it with backups and a second box, not with a deploy script.

## The folder layout

Everything hinges on this structure:

```text
/var/www/app/
├── current -> /var/www/app/releases/20261010T091500
├── releases/
│   ├── 20261009T151200/
│   └── 20261010T091500/
└── shared/
    ├── .env
    └── storage/
        ├── app/
        ├── framework/
        └── logs/
```

Nginx points at `/var/www/app/current/public`. Each deploy builds a brand new folder under `releases/`. Things that must survive between deploys, like `.env`, uploaded files, and logs, live in `shared/` and are symlinked into each release.

The magic moment is a single `ln -sfn` followed by `mv -T`, which is an atomic rename on Linux. Until that rename happens, production keeps running the old folder untouched. After it happens, new requests resolve the new path.

```bash
ln -s /var/www/app/releases/$RELEASE /var/www/app/current_tmp
mv -Tf /var/www/app/current_tmp /var/www/app/current
```

I use the temp-link-then-rename pattern instead of `ln -sfn current` directly, because `ln -sfn` is actually an unlink plus a create. There is a tiny window where `current` does not exist. On a busy box you will eventually hit it.

## Nginx and the realpath trap

There is one subtle thing that bites almost everyone. PHP-FPM and OPcache cache file paths. If Nginx passes `SCRIPT_FILENAME` using the symlinked path, OPcache may keep serving the old release's compiled files after the switch, because from its point of view the path `/var/www/app/current/public/index.php` did not change.

The fix is to resolve the symlink at the Nginx level:

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    root /var/www/app/current/public;

    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT $realpath_root;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }
}
```

`$realpath_root` gives PHP the real release path, like `/var/www/app/releases/20261010T091500/public`. Each release has unique paths, so OPcache treats them as new files. Old workers finishing old requests keep using the old release's files, which still exist on disk. Nothing gets mixed.

With that in place I still reload PHP-FPM after the switch, mainly to drop the old OPcache memory, but correctness no longer depends on it.

## Build the release before it touches the server's live path

The rule I follow: every expensive or risky step happens before the symlink switch. If anything fails, `current` was never touched, and users never noticed.

Here is the deploy script I keep at `scripts/deploy.sh` in the repo. It runs on the server, called from CI.

```bash
#!/usr/bin/env bash
set -euo pipefail

APP=/var/www/app
RELEASE=$(date -u +%Y%m%dT%H%M%S)
DIR="$APP/releases/$RELEASE"
ARCHIVE="$1"   # path to the uploaded build tarball
KEEP=5

mkdir -p "$DIR"
tar -xzf "$ARCHIVE" -C "$DIR"

# Shared state
rm -rf "$DIR/storage"
ln -s "$APP/shared/storage" "$DIR/storage"
ln -s "$APP/shared/.env" "$DIR/.env"

cd "$DIR"

# Caches are built per release, never shared
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Safe migrations run against the live DB while old code still serves
php artisan migrate --force --isolated

# Atomic switch
ln -s "$DIR" "$APP/current_tmp"
mv -Tf "$APP/current_tmp" "$APP/current"

# Graceful reloads
sudo systemctl reload php8.3-fpm
php artisan queue:restart

# Prune old releases
ls -1dt "$APP"/releases/* | tail -n +$((KEEP + 1)) | xargs -r rm -rf

echo "Deployed $RELEASE"
```

A few choices in there are deliberate.

### Composer and npm do not run on the server

The tarball already contains `vendor/` and built frontend assets. I build in CI, where a slow network or a broken npm package fails the pipeline instead of the production box. The VPS does not even need Node installed. That also keeps a 2 GB RAM VPS from swapping itself to death during `npm run build`.

### Caches are per release

`config:cache` writes `bootstrap/cache/config.php` inside the release folder. If you share `bootstrap/cache` between releases, a new deploy can overwrite the cached config that old workers are still reading. Keep it inside the release.

### `--isolated` on migrations

`php artisan migrate --isolated` takes a cache lock so two deploys triggered close together cannot run migrations at the same time. On a single server this sounds paranoid, until someone merges two PRs in a row and two pipelines race.

## Migrations that respect the old code

This is the part most guides skip, and it is where real downtime comes from. The migration runs while the old release is still serving traffic. So for a short window, old code runs against the new schema. Then, after a rollback, maybe new schema runs with old code for much longer.

So I write migrations to be backwards compatible with the previous release. In practice that means the expand and contract pattern:

1. **Expand.** Add the new column as nullable or with a default. Add the new table. Never drop or rename in the same deploy that starts using the new shape.
2. **Migrate code.** Ship code that writes to both old and new columns, and reads from the new one with a fallback.
3. **Backfill.** Move old data in a queued job or chunked command, not inside the migration.
4. **Contract.** A later deploy, after you are sure nothing reads the old column, drops it.

A rename is the classic trap. This migration will break the running release immediately:

```php
Schema::table('orders', function (Blueprint $table) {
    $table->renameColumn('total', 'total_cents');
});
```

The old code still does `$order->total` and suddenly gets null, or the query errors. The safe version is spread across deploys:

```php
// Deploy 1: expand
Schema::table('orders', function (Blueprint $table) {
    $table->unsignedBigInteger('total_cents')->nullable()->after('total');
});
```

```php
// Deploy 1: model writes both
protected static function booted(): void
{
    static::saving(function (Order $order) {
        if ($order->isDirty('total')) {
            $order->total_cents = (int) round($order->total * 100);
        }
    });
}
```

```php
// Deploy 1: chunked backfill command, run after the deploy
Order::whereNull('total_cents')
    ->chunkById(1000, function ($orders) {
        foreach ($orders as $order) {
            $order->updateQuietly([
                'total_cents' => (int) round($order->total * 100),
            ]);
        }
    });
```

Deploy 2 switches reads to `total_cents`. Deploy 3, a week later, drops `total`. It is more steps, but none of them can take the site down.

### Watch out for table locks

On MySQL 8, many `ALTER TABLE` operations are online, but not all. Adding an index on a large table, changing a column type, or adding a column in the middle of a huge table can still hold locks long enough to queue up every request. For big tables I check the plan first and, when needed, add `ALGORITHM=INPLACE, LOCK=NONE` through a raw statement so MySQL refuses instead of silently locking:

```php
DB::statement('ALTER TABLE orders ADD INDEX orders_status_created_idx (status, created_at), ALGORITHM=INPLACE, LOCK=NONE');
```

If MySQL cannot do it without a lock, the migration fails before it hurts anyone, and I schedule that change for a quiet hour instead.

## PHP-FPM reload, not restart

`systemctl restart php8.3-fpm` kills workers mid-request. Users in the middle of a checkout get a 502. `systemctl reload` sends `SIGUSR2`, which makes the master spawn fresh workers and lets old ones finish their current request.

To make that graceful, set this in the pool or global config:

```ini
; /etc/php/8.3/fpm/php-fpm.conf
process_control_timeout = 20s
```

Without `process_control_timeout`, the default is zero, which means old workers can be killed immediately on reload. Twenty seconds covers almost every normal web request. If you have requests that run longer than that, they probably belong on a queue anyway.

The deploy user needs permission to reload without a password prompt. I give exactly that one command, nothing more:

```text
# /etc/sudoers.d/deploy
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl reload php8.3-fpm
```

## Queue workers and scheduled tasks

Queue workers are long-running PHP processes. They loaded the old code when they started, and they will keep running it forever unless told otherwise. `php artisan queue:restart` sets a cache flag; each worker finishes its current job and exits, and Supervisor or systemd starts it again from the `current` symlink.

Two details matter:

- The Supervisor program must point at `current`, not a specific release, so restarted workers pick up new code.
- Your cache driver must be shared and persistent, like Redis or the database, because `queue:restart` uses the cache to signal workers. With the `array` driver it silently does nothing.

```ini
[program:app-worker]
command=php /var/www/app/current/artisan queue:work redis --sleep=1 --tries=3 --max-time=3600
user=deploy
numprocs=2
autostart=true
autorestart=true
stopwaitsecs=120
stdout_logfile=/var/www/app/shared/storage/logs/worker.log
```

`stopwaitsecs` should be longer than your longest job, so Supervisor does not kill a worker in the middle of charging a card. If you run Horizon, use `php artisan horizon:terminate` instead of `queue:restart`. I covered more of that in my piece on [Laravel Horizon production patterns](/article/laravel-horizon-production-patterns-i-trust/).

For the scheduler, the cron entry also points at `current`:

```text
* * * * * cd /var/www/app/current && php artisan schedule:run >> /dev/null 2>&1
```

Long scheduled commands should use `withoutOverlapping()` and `onOneServer()`, so a deploy in the middle of a run does not start a second copy.

## The CI side with GitHub Actions

The pipeline builds a tarball, uploads it, and runs the script. Tests run first; if they fail, nothing ships.

```yaml
name: deploy

on:
  push:
    branches: [main]

concurrency:
  group: production-deploy
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
      - run: npm ci && npm run build
      - run: php artisan test

      - name: Package
        run: |
          tar --exclude=.git --exclude=node_modules --exclude=tests \
              --exclude=storage -czf release.tgz .

      - name: Upload and deploy
        env:
          SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          HOST: ${{ secrets.DEPLOY_HOST }}
        run: |
          install -m 600 /dev/null key && echo "$SSH_KEY" > key
          scp -i key -o StrictHostKeyChecking=accept-new release.tgz deploy@$HOST:/tmp/release.tgz
          ssh -i key deploy@$HOST 'bash /var/www/app/current/scripts/deploy.sh /tmp/release.tgz'
```

Note that tests run with dev dependencies normally; in a real pipeline I run tests in a separate job with `composer install` including dev packages, and only build the `--no-dev` artifact after tests pass. I kept it in one job above so the shape is readable.

The `concurrency` block is the quiet hero. Two merges in a row queue up instead of running two deploys at the same time on one box.

One more practical point: the very first deploy has no `current/scripts/deploy.sh` yet. I bootstrap the server once by hand, copying the script to `/var/www/app/bin/deploy.sh`, and many teams just keep it there permanently, outside of any release. Either works; just be consistent.

## Health check before you call it done

A deploy that switched the symlink but serves 500s is not a success. After the reloads I hit a lightweight health route and roll back automatically if it fails.

```php
// routes/web.php
Route::get('/up', function () {
    DB::select('select 1');
    Cache::store()->get('health-probe');

    return response('ok');
});
```

Laravel 11+ ships a `/up` route by default; I extend it to touch the database and cache, because "PHP runs" is not the same as "the app works".

```bash
if ! curl -fsS --max-time 5 https://example.com/up > /dev/null; then
  echo "Health check failed, rolling back"
  PREV=$(ls -1dt "$APP"/releases/* | sed -n 2p)
  ln -s "$PREV" "$APP/current_tmp"
  mv -Tf "$APP/current_tmp" "$APP/current"
  sudo systemctl reload php8.3-fpm
  php "$APP/current/artisan" queue:restart
  exit 1
fi
```

## Rollback that is actually one command

Because old releases stay on disk, rollback is the same symlink switch in reverse. I keep it as a separate script, `scripts/rollback.sh`, and I have run it at two in the morning more than once. It does not touch the database. That is exactly why the expand and contract rule matters: if your last migration was backwards compatible, the previous release runs fine against the current schema.

If a migration was not backwards compatible, a code rollback alone will not save you, and you need `migrate:rollback` plus luck. I would rather never be in that position, so I review every migration with one question: would the previous release still work if this ran right now?

## Things that still cause downtime with this setup

I want to be honest about the gaps.

- **Running out of disk.** Five releases with vendor folders add up on a 25 GB VPS. Prune, and alert on disk usage.
- **Session or cache key format changes.** If a new release changes how something is serialized in Redis, old workers and new web requests can disagree for a moment. Version your cache keys when you change shapes.
- **Frontend asset hashes.** A user with an old page open requests `app-abc123.js`, which no longer exists in the new release. Vite hashed filenames help, but serving assets from the release folder means old ones vanish. For busy apps I upload built assets to S3 or a CDN and keep a few versions around.
- **Long requests past the FPM timeout.** Export endpoints that run for two minutes will get cut on reload. Move them to queues.

## When to graduate from this

This setup has carried products with real paying users on a single VPS with very little drama. When I help small teams through [SquartUp](https://squartup.com), it is often the first thing I put in place, because it removes the fear from shipping, and teams that are not afraid to deploy ship smaller, safer changes more often.

You outgrow it when you need more than one app server. At that point the same ideas carry over: immutable builds, health checks, backwards compatible migrations, and graceful worker restarts. Only the switch changes, from a symlink to a load balancer target group or a container rollout.

## Final checklist

- Nginx uses `$realpath_root` for `SCRIPT_FILENAME` and `DOCUMENT_ROOT`.
- Build `vendor/` and assets in CI, ship a tarball.
- New release folder per deploy, shared `.env` and `storage`.
- Per-release config, route, view, and event caches.
- `migrate --force --isolated`, and every migration is backwards compatible with the previous release.
- Atomic switch with temp symlink plus `mv -T`.
- `reload` PHP-FPM with `process_control_timeout` set.
- `queue:restart` or `horizon:terminate`, workers pointing at `current`.
- Health check with automatic rollback.
- Prune old releases and watch disk.

None of this is fancy. It is just the set of small habits that turned deploys, for me, from a held breath into something I do on a Friday afternoon without thinking twice.
