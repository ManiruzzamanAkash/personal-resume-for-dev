---
title: "AWS S3, CloudFront, and IAM patterns I ship with Laravel before overbuilding"
slug: aws-laravel-s3-cloudfront-iam-without-overbuilding
date: 2026-09-25
category: Engineering
excerpt: "Most Laravel teams jump to ECS before they fix IAM, S3, and CloudFront. Here is the AWS baseline I ship first — least-privilege roles, private buckets, signed URLs, and a CDN that does not leak origin pain."
readTime: 14 min
tags: [aws, laravel, s3, cloudfront, iam, rds, php, devops]
---

# AWS S3, CloudFront, and IAM patterns I ship with Laravel before overbuilding

I have watched more Laravel launches stall on AWS than on code. Not because ECS is hard — because someone bolted a public S3 bucket, a root-like IAM user in `.env`, and a CloudFront distribution that still hits the origin for every image resize. The app “works” in staging. Production is a slow leak of credentials, egress cost, and support tickets about broken media.

This is not an AWS catalog tour. It is the **minimum honest stack** I put under a Laravel API or admin before I entertain containers, Auto Scaling groups, or a second region. S3 for durable objects, CloudFront for public reads, RDS (or a managed MySQL you already trust) for state, IAM least privilege for every process that touches AWS. Opinions from shipping product and agency work — not from a certification checklist.

## What I refuse to overbuild on day one

Before architecture diagrams get exciting, I ask whether the product actually needs:

1. **ECS/Fargate or EKS** — only if deploy cadence, multi-service topology, or horizontal scale already hurts on a well-tuned VPS or single EC2.
2. **Multi-AZ everything** — yes for RDS when money is real; no for a marketing API that can tolerate a planned maintenance window.
3. **Custom origin auth theater** — signed cookies, Lambda@Edge, and WAF rules *after* the bucket is private and the IAM policy is boring.

Day-one AWS for most Laravel apps I ship looks like this:

- One **private** S3 bucket for uploads (and often a second for backups/artifacts).
- **CloudFront** in front of public assets (and optionally the app origin later).
- **IAM roles** for the app runtime and for CI — never long-lived access keys in the repo.
- **RDS MySQL/Postgres** (or Aurora) with security groups that only the app can reach.
- Secrets in **Secrets Manager** or SSM Parameter Store, injected at boot — not pasted into host files by hand.

If you cannot explain who can `s3:PutObject` and who can `s3:GetObject` in one breath, you are not ready for ECS.

## Private buckets are the default — public is the exception

The first S3 mistake I still see in Laravel codebases is `AWS_BUCKET` pointed at a bucket whose ACL or bucket policy makes objects world-readable “so the browser can load them.” That couples durability to public exposure. I flip it:

- Bucket **Block Public Access** on.
- Objects private.
- Browsers get either **CloudFront** (OAC/OAI) for stable public assets, or **temporary signed URLs** for user-specific files.

Laravel’s filesystem config stays boring:

```php
// config/filesystems.php
's3' => [
    'driver' => 's3',
    'key'    => env('AWS_ACCESS_KEY_ID'),
    'secret' => env('AWS_SECRET_ACCESS_KEY'),
    'region' => env('AWS_DEFAULT_REGION', 'ap-southeast-1'),
    'bucket' => env('AWS_BUCKET'),
    'url'    => env('AWS_URL'), // CloudFront URL when reading public-ish assets
    'endpoint' => env('AWS_ENDPOINT'),
    'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
    'throw'  => true,
],
```

On EC2/ECS I prefer **instance/task roles** and leave `key`/`secret` empty so the SDK picks up the role credentials. Locally I use a short-lived SSO profile or a dedicated IAM user with a tiny policy — never the same principal as production.

Upload path I actually use:

```php
$path = $request->file('avatar')->store(
    'avatars/'.$user->id,
    ['disk' => 's3', 'visibility' => 'private']
);

// Persist only the key — never a forged public URL in the DB.
$user->forceFill(['avatar_key' => $path])->save();
```

Serving that file later:

```php
return redirect()->away(
    Storage::disk('s3')->temporaryUrl(
        $user->avatar_key,
        now()->addMinutes(15)
    )
);
```

Fifteen minutes is a product decision, not a framework default. Invoices and KYC docs get shorter windows. Marketing hero images do not belong in signed-URL land at all — they belong behind CloudFront with immutable cache headers.

## CloudFront: CDN first, origin second

CloudFront is not “make it faster.” It is **stop the origin from becoming an image server**. Patterns I insist on:

### Origin Access Control for the bucket

The distribution’s S3 origin uses OAC so only CloudFront can `GetObject`. The bucket policy allows that principal and nothing else from the public internet. If someone guesses the S3 URL, they get denied. That single change kills a whole class of “we thought the object was private” incidents.

### Cache behavior that matches Laravel reality

- **Static build assets** (`/build/*`, hashed Vite/Mix files): long `max-age`, `immutable` when filenames are content-hashed.
- **User uploads via CloudFront**: shorter TTL or cache keyed by object version in the path (`avatars/{id}/{uuid}.jpg`) so a replace is a new URL, not a purge lottery.
- **HTML / API origin** (if you put the app behind CloudFront): default *almost never cache* authenticated responses. Cache keys that ignore `Authorization` are how you leak one tenant’s JSON to another.

A Laravel URL helper I keep explicit:

```php
function cdn_url(string $key): string
{
    $base = rtrim(config('filesystems.disks.s3.url'), '/');

    return $base.'/'.ltrim($key, '/');
}
```

`AWS_URL` points at `https://dxxxx.cloudfront.net` (or a custom domain). The app never concatenates raw `s3.amazonaws.com` links in Blade or API Resources.

### Invalidation is not a strategy

I treat invalidation as an incident tool, not a deploy step. Content-hashed assets and versioned object keys remove most “please invalidate `/*`” Slack messages. When I must invalidate, I invalidate **paths**, not the whole distribution, and I log who triggered it.

## IAM least privilege — write the policy before the feature

IAM is where Laravel teams casually recreate root. A classic bad `.env`:

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

paired with a user policy of `Action: *` on `Resource: *`. That key leaks once via a debug dump, a CI log, or a compromised laptop — and the blast radius is the account.

What I ship instead:

### Runtime role (EC2 instance profile or ECS task role)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ObjectReadWriteInAppPrefix",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload"
      ],
      "Resource": "arn:aws:s3:::myapp-prod-uploads/app/*"
    },
    {
      "Sid": "ListOnlyAppPrefix",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::myapp-prod-uploads",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["app/*"]
        }
      }
    }
  ]
}
```

Notes I leave in review:

- **Prefix-scope** `Resource` and `s3:prefix` conditions. The app does not need the whole bucket.
- **No `s3:PutBucketPolicy`**, no IAM mutation, no `*` on secrets.
- Separate statement if the app must call **SES**, **SQS**, or **Secrets Manager** — each with its own ARN list.

### CI role

Deploy pipelines get a **different** role: push to ECR, sync a public assets bucket, run `aws s3 sync` for hashed frontend files, maybe invalidate a known path set. CI does **not** get delete rights on user uploads. Production runtime does **not** get ECR push.

### Humans

Console access via SSO permission sets. Break-glass IAM users are rare, rotated, and alarmed. I do not create “dev” keys that also work in prod.

Laravel side: once the role is attached, delete permanent keys from production env and confirm the SDK resolves credentials from the provider chain. If `Storage::put` fails only in prod with “Unable to locate credentials,” that is a role attachment bug — not a reason to paste keys back into `.env`.

## RDS and security groups — the boring part that saves you

S3 and CloudFront get the blog ink. The outage that wakes you up is often **RDS open to `0.0.0.0/0`** or an app security group that still allows SSH from the world.

Baseline I treat as non-negotiable:

- RDS in **private subnets**.
- Security group ingress **only** from the app security group (and a bastion or SSM Session Manager path for humans).
- Automated backups on; retention matched to how angry finance gets when data vanishes.
- Parameter group tuned for the workload (connections, `max_allowed_packet`, slow query log) — but schema and indexes still matter more than a larger instance class.

Laravel `.env` then holds a hostname that never resolves publicly:

```env
DB_CONNECTION=mysql
DB_HOST=myapp-prod.xxxx.ap-southeast-1.rds.amazonaws.com
DB_PORT=3306
DB_DATABASE=myapp
DB_USERNAME=myapp_app
DB_PASSWORD=... # from Secrets Manager / SSM, not git
```

Application DB users are **not** masters. Migrations in CI or a controlled job use a migration principal with DDL rights; the web/queue workers use DML-only where the org is mature enough to split them. Even a single least-privilege app user beats `root` in the web pool.

## Queues, mail, and “just one more AWS service”

Laravel makes it easy to drip AWS into every config key. I sequence deliberately:

1. **S3 + IAM + (optional) CloudFront** for media and artifacts.
2. **RDS** (or existing managed MySQL) with private networking.
3. **SQS** as the queue driver when I outgrow Redis-on-box or need multi-instance workers without sharing a Redis password via tribal knowledge.
4. **SES** when deliverability and bounce handling matter more than “SMTP through the VPS.”

SQS example that stays honest with Horizon-or-not workers:

```env
QUEUE_CONNECTION=sqs
SQS_PREFIX=https://sqs.ap-southeast-1.amazonaws.com/123456789012
SQS_QUEUE=myapp-prod-default
AWS_DEFAULT_REGION=ap-southeast-1
```

IAM for workers adds `sqs:ReceiveMessage`, `DeleteMessage`, `GetQueueAttributes`, `ChangeMessageVisibility` on those queue ARNs — not on every queue in the account.

I do **not** turn on ElastiCache, OpenSearch, and MSK on the same afternoon “because we might need them.” Each service is another IAM surface, another bill line, another failure mode in the deploy graph.

## A launch checklist I actually run

Before I call an AWS-backed Laravel deploy “ready for real users,” I walk this list:

1. **Bucket public access blocked**; sample object URL from S3 console denied without signing / CloudFront.
2. **CloudFront OAC** attached; direct S3 website endpoint not used for public traffic.
3. **Runtime role** can put/get under `app/*` only; attempt outside prefix fails in a staging test.
4. **No long-lived access keys** in production env; `aws sts get-caller-identity` on the box/task shows the role.
5. **RDS** not reachable from my laptop without SSM/bastion; security group diff reviewed.
6. **Backups** exist and a restore drill has been done at least once (even if to a throwaway instance).
7. **App config** stores object *keys*, not permanent signed URLs that expire in the database.
8. **Cost alarms** on S3 egress, CloudFront, and RDS — surprise bills are operational incidents.

If any item is “we will fix it after launch,” I treat launch as deferred.

## When I *do* graduate to ECS (and when I do not)

Containers are fine. They are not free complexity. I move a Laravel app to ECS/Fargate when:

- I need **identical** runtime across preview and prod more than VPS images give me.
- Horizontal scale of **stateless** HTTP/queue workers is a weekly conversation.
- Deployments must be **task-definition** rollouts with healthchecks, not SSH and hope.

I stay on a hardened single host or small ASG of EC2 when:

- The team is small and operational load matters more than orchestration purity.
- The bottleneck is still **queries and N+1**, not CPU saturation across instances.
- Media and IAM are already correct — because ECS will not fix a public bucket.

Overbuilding compute while underbuilding identity and storage is how you get an expensive architecture that still leaks objects.

## Closing

AWS rewards teams that make **boring, enforceable boundaries**: private buckets, CDN in front of public reads, roles instead of immortal keys, databases that only the app can see. Laravel’s S3 disk and queue drivers make the happy path easy — they also make it easy to paste privileges into `.env` and call it done.

Ship the IAM and S3/CloudFront baseline first. Keep object keys in the database. Sign what must be temporary. Cache what is content-hashed. Add SQS, SES, and containers when a concrete failure mode demands them — not because the architecture diagram looked empty.

That is the AWS shape I trust under a Laravel app before traffic, auditors, or a leaked screenshot of credentials force the redesign.
