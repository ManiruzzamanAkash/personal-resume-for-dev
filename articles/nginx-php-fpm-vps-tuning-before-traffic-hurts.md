---
title: "Nginx and PHP-FPM settings I trust on a VPS before traffic hurts"
slug: nginx-php-fpm-vps-tuning-before-traffic-hurts
date: 2026-09-24
category: Engineering
excerpt: "A cheap VPS can serve a serious PHP app — until worker math, upstream timeouts, and buffering defaults fight you. Here is the Nginx and PHP-FPM baseline I ship before I blame the framework."
readTime: 12 min
tags: [nginx, php-fpm, vps, linux, php, performance, devops, hosting]
---

# Nginx and PHP-FPM settings I trust on a VPS before traffic hurts

I still put production PHP on a VPS more often than marketing decks admit. Not because Kubernetes is wrong — because a single well-tuned box is honest. You see memory pressure. You see queue depth. You see the exact worker that ate the CPU. When a Laravel or WordPress app starts timing out at 200 concurrent users, the first place I look is rarely the framework. It is **Nginx talking to PHP-FPM with defaults that were never meant for your traffic shape**.

This is the baseline I apply on Ubuntu or Debian VPS hosts before I open a PR that “optimizes queries.” Tuning will not fix an N+1. It *will* stop you from calling a perfectly fine app “slow” when the web stack is the bottleneck.

## What “trust” means on a VPS

Before I change `pm.max_children`, I write down four numbers:

1. **RAM available to PHP**, after OS, MySQL/Redis, and headroom (I keep ~20% free).
2. **Average resident size** of one PHP-FPM worker under a warm request (not idle).
3. **p95 latency** of the hottest PHP route on staging with production-like data.
4. **Upstream timeout budget** — how long Nginx is allowed to wait before the client gets a 504.

If those are guesses, I am not tuning. I am gambling with OOM kills.

A rough worker ceiling I use on every box:

```text
max_children ≈ floor( (available_php_ram_mb) / (avg_worker_rss_mb) )
```

On a 4 GB VPS where MySQL takes ~1.2 GB and the OS wants ~400 MB, I might have ~1.8 GB for PHP. If each FPM worker sits around 60–80 MB on a Laravel app, I am looking at **20–28 workers**, not the mythical 50 that copy-paste tutorials recommend.

## PHP-FPM pool: process manager before micro-optimizations

I almost always run a dedicated pool per app (`/etc/php/8.3/fpm/pool.d/app.conf`), not the default `www` pool shared with every random site on the box.

```ini
[app]
user = www-data
group = www-data
listen = /run/php/php8.3-fpm-app.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = dynamic
pm.max_children = 24
pm.start_servers = 6
pm.min_spare_servers = 4
pm.max_spare_servers = 10
pm.max_requests = 500

pm.status_path = /fpm-status
ping.path = /fpm-ping
ping.response = pong

request_terminate_timeout = 60s
request_slowlog_timeout = 5s
slowlog = /var/log/php8.3-fpm-app-slow.log

catch_workers_output = yes
decorate_workers_output = no
```

### Why these knobs, not the defaults

- **`pm = dynamic`** on a VPS that also runs MySQL/Redis. `ondemand` saves RAM but pays a spawn tax on every traffic spike. `static` is great when PHP owns the machine; mixed workloads usually prefer dynamic with a hard `max_children`.
- **`pm.max_requests = 500`** recycles workers before quiet memory leaks (extensions, OpCache edge cases, accidental global state) turn into a Wednesday afternoon mystery.
- **`request_terminate_timeout`** must be **strictly greater** than Nginx `fastcgi_read_timeout`? No — the opposite discipline: I set FPM terminate slightly **above** the Nginx read timeout so Nginx fails the request cleanly while FPM still has a chance to kill the runaway. In practice I align them deliberately (both 60s) and document it. Ambiguity here creates dual timeouts that are hell to debug.
- **Slowlog at 5s** is my early warning. If a route regularly hits the slowlog, that is a product bug, not a hosting bug.

I expose status only on localhost or a private VPN:

```nginx
location = /fpm-status {
    access_log off;
    allow 127.0.0.1;
    deny all;
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    fastcgi_pass unix:/run/php/php8.3-fpm-app.sock;
}
```

`active processes` climbing toward `max_children` under normal load is the alarm. Queue depth rising while CPU is idle usually means **blocking I/O** (DB, HTTP clients, NFS), not “need more workers.”

## Nginx: the reverse proxy that lies by default

A minimal PHP site block I actually ship:

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;
    root /var/www/app/public;
    index index.php;

    client_max_body_size 32m;

    # Security headers belong here, not only in the app
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        try_files $uri =404;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT $realpath_root;
        fastcgi_pass unix:/run/php/php8.3-fpm-app.sock;

        fastcgi_buffers 16 16k;
        fastcgi_buffer_size 32k;
        fastcgi_read_timeout 60s;
        fastcgi_send_timeout 60s;
        fastcgi_connect_timeout 5s;
    }

    location ~* \.(?:css|js|jpg|jpeg|gif|png|svg|webp|woff2)$ {
        expires 7d;
        access_log off;
        try_files $uri =404;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

### Buffering and timeouts that bite under load

Default `fastcgi_buffers` are small. Large JSON API responses or HTML with inline critical CSS can force Nginx to spill to temp files. Under concurrency that becomes disk wait you will misattribute to PHP.

I bump buffers early. I also set:

```nginx
fastcgi_busy_buffers_size 64k;
fastcgi_temp_file_write_size 64k;
```

For APIs that stream or return big payloads, I sometimes disable buffering on a specific location:

```nginx
location /api/export {
    # ... same fastcgi_pass ...
    fastcgi_buffering off;
    fastcgi_read_timeout 120s;
}
```

Only for routes that need it. Globally disabling buffering removes backpressure and can amplify slow-client problems.

### Upstream health is a product feature

I do not hide 502/504 pages behind a cute “something went wrong.” I log them with request id and upstream status:

```nginx
log_format main_ext '$remote_addr - $request_id $status '
                    'rt=$request_time urt=$upstream_response_time '
                    'u=$upstream_status';

access_log /var/log/nginx/app.access.log main_ext;
```

When `$upstream_response_time` spikes while PHP-FPM `listen queue` is empty, I look at MySQL. When the listen queue is full, I look at `max_children` and blocking calls inside PHP — not at buying a bigger VPS first.

## OpCache and realpath: free performance people skip

On every production PHP VPS I enforce:

```ini
; /etc/php/8.3/fpm/conf.d/99-opcache.ini
opcache.enable=1
opcache.memory_consumption=256
opcache.interned_strings_buffer=32
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0
opcache.revalidate_freq=0
opcache.jit=1255
opcache.jit_buffer_size=64M
```

`validate_timestamps=0` means deploys must reload FPM (`systemctl reload php8.3-fpm`). That is intentional. Timestamp validation in production is a tax you pay on every request for the privilege of half-deployed code.

I also pin:

```ini
realpath_cache_size=4096k
realpath_cache_ttl=600
```

Frameworks that resolve many files per request (Laravel, Symfony, some WP plugin stacks) feel this immediately.

## systemd and file descriptors: the boring failures

PHP-FPM dying with `too many open files` at the worst moment is still common. I set limits on the service override:

```ini
# /etc/systemd/system/php8.3-fpm.service.d/override.conf
[Service]
LimitNOFILE=65535
```

Then `systemctl daemon-reload && systemctl restart php8.3-fpm`.

Nginx gets the same treatment if you terminate many keep-alive connections or proxy WebSockets. I also disable transparent huge pages on DB-heavy boxes when latency jitter shows up — that is a separate article, but the VPS is where you notice it.

## Deploy shape that keeps FPM honest

My VPS deploy ritual for PHP apps:

1. Build assets and vendor on CI or a build user — not as `www-data` mid-request.
2. Release into a new directory (`releases/20260924T150000`), symlink `current`.
3. `php artisan migrate --force` (or equivalent) against the new release.
4. `systemctl reload php8.3-fpm` so OpCache picks up new files.
5. Reload Nginx only if the vhost changed.

Zero-downtime on a single VPS is “good enough” with reloads, not magic. What matters is **never editing files in place under `public/` while FPM still holds old OpCache entries**.

For agencies shipping client sites — the same pattern [SquartUp](https://squartup.com) uses when we talk hosting with small product teams — I refuse “FTP overwrite `index.php` and hope.” That workflow is how you get white screens that only happen for users who hit the warm workers.

## What I measure in the first hour after go-live

I keep a short checklist on every new VPS:

| Signal | Healthy | Action if not |
| --- | --- | --- |
| FPM `listen queue` | Usually 0 | Raise workers *or* fix blocking I/O |
| `max_children` saturation | Rare spikes only | Cap concurrency in app / queue work |
| Nginx 5xx rate | Near zero | Correlate `urt` vs PHP slowlog |
| Swap usage | Near zero | Lower `max_children`, not “add swap and pray” |
| Load average vs CPU | Explains itself | I/O wait → disks/DB; CPU → code/JIT |

I scrape FPM status with a tiny cron or node exporter textfile. Fancy APM can wait. If I cannot answer “how many busy workers right now?” from SSH, I do not trust the stack yet.

## Common anti-patterns I reject in review

- **Copying `pm.max_children = 50` onto a 2 GB droplet.** You will OOM. The kernel will pick a victim. It might be MySQL.
- **Putting `try_files` wrong so every static 404 falls through to PHP.** Free DoS.
- **Leaving `cgi.fix_pathinfo=1` puzzles and loose `location ~ \.php`.** Path traversal classics still ship in 2026 tutorials.
- **Terminating TLS at Cloudflare and also misconfiguring real IP headers.** Rate limits and audit logs lie; fix `set_real_ip_from` and `real_ip_header`.
- **Running `composer install` as root in `/var/www` on the live symlink.** Permissions debt compounds forever.

## When to leave the single VPS

I outgrow one box when any of these become true:

1. Horizontal web nodes need a shared session/cache story I already postponed.
2. Deploy risk on one machine exceeds the ops budget of the product.
3. CPU-bound work (image processing, PDF, ML calls) starves request workers even after queues.

Until then, a tuned Nginx + PHP-FPM VPS is not “legacy.” It is a clear contract: **N workers, M megabytes, hard timeouts.** Cloud abstractions that hide those numbers do not remove the math — they invoice you for not doing it.

## Closing baseline

If you take one thing from this post, take the order of operations:

1. Measure worker RSS and available RAM → set `max_children`.
2. Align Nginx FastCGI timeouts with FPM `request_terminate_timeout`.
3. Turn on OpCache properly and reload on deploy.
4. Watch listen queue and slowlog before you rewrite application code.

I have spent years debugging “Laravel is slow” tickets that were actually **24 workers stuck on a 2-second HTTP client call with no timeout**, or Nginx buffering defaults thrashing disk. The framework deserved better. The VPS deserved a checklist.

Ship the checklist first. Then optimize the queries.
