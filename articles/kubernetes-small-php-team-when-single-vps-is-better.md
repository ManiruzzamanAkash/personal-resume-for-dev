---
title: "Kubernetes for a small PHP team: when a single VPS is the better call"
slug: kubernetes-small-php-team-when-single-vps-is-better
date: 2026-11-21
category: DevOps & Cloud
excerpt: "Kubernetes solves real problems, but a three-person PHP team often buys them a year early. Here is how I decide between one well-run VPS, a few boxes, and a cluster, and what has to be true before Kubernetes pays for itself."
readTime: 10 min
tags: [kubernetes, vps, devops, laravel, wordpress, php, infrastructure, startup, saas]
---

# Kubernetes for a small PHP team: when a single VPS is the better call

> **In short**
> - **The problem:** small teams move their Laravel or WordPress app to Kubernetes because it sounds like the grown-up choice, then spend their engineering hours running the platform instead of building the product. The bill goes up, deploys get slower to debug, and nobody on the team fully understands how production works.
> - **What I do about it:** I start from the problems the team actually has today (downtime, slow deploys, traffic spikes, many services) and pick the smallest setup that solves them. For most small PHP products, that is one or two well-run servers with containerized builds, not a cluster.
> - **Who this is for:** founders and tech leads of PHP products with one to five engineers, deciding where the next year of infrastructure effort should go.

The conversation usually starts after a scare. The site went down during a launch, or a deploy left the app half-broken for ten minutes, and someone says, "We need to move to Kubernetes so this never happens again."

It is a reasonable instinct. Kubernetes is very good at keeping a declared number of copies of an app running, replacing ones that die, and rolling out new versions gradually. But the outage that triggered the conversation was rarely caused by the lack of a scheduler. It was a deploy script that ran `git pull` on a live server, a PHP-FPM pool sized for a quiet Tuesday, or a database with no backups anyone had tested.

Kubernetes doesn't fix those. It moves them into YAML and adds a few new ones.

## Kubernetes is an answer to scale and many services, not to reliability on its own

It helps to say plainly what Kubernetes does. It is a system for running containers across a pool of machines. You describe what you want ("three copies of the web app, two of the queue worker, restart anything that fails"), and the control plane keeps reality matching that description. It handles rolling deploys, service discovery between apps, and spreading work across nodes.

That is valuable when you have the problems it was built for:

- **Many services** that need to find each other, deploy independently and scale separately.
- **Uneven load** where you genuinely need to add and remove capacity through the day.
- **Several teams** sharing the same infrastructure and needing guardrails between them.
- **A platform person**, or a budget for a managed platform, whose job includes the cluster.

A typical small PHP product has one web app, one queue worker, a scheduler, MySQL and Redis. That is one deployable unit with a few process types. The orchestration problem is small enough that a process supervisor and a deploy script solve it completely.

## Most small-team outages come from habits that a VPS can fix in a week

When I look at why a small PHP product goes down, the failures I see most often are boring:

- **Non-atomic deploys.** Code changes underneath running requests, so some users get a mix of old and new files.
- **Migrations that break the running code.** A column is renamed while the old release is still serving traffic.
- **Untuned PHP-FPM.** Too few workers, so requests queue during a spike, or too many, so the box swaps and everything slows down.
- **Queue workers running stale code** for hours after a deploy.
- **No tested restore.** The backup exists but nobody has ever restored it.

Every one of these has a fix on a single server. Atomic release folders with a symlink switch, expand-then-contract migrations, a sized FPM pool, a worker restart in the deploy, and a monthly restore drill. I wrote up the deploy side in detail in [zero-downtime Laravel deploys on a small VPS](/article/zero-downtime-laravel-deploys-small-vps-atomic-releases/), and the server side in [Nginx and PHP-FPM settings I trust on a VPS](/article/nginx-php-fpm-vps-tuning-before-traffic-hurts/).

Moving to Kubernetes without these habits gives you the same failures with more moving parts. A migration that breaks old code breaks it just as hard during a rolling update, because Kubernetes runs old and new pods side by side on purpose.

## The real cost of a cluster is attention, not the invoice

The direct cost is easy to look up. On Amazon EKS, the control plane is billed per cluster per hour: $0.10 while your Kubernetes version is in standard support, and $0.60 once it moves into extended support. That is before nodes, load balancers, storage and data transfer. Other providers price the control plane differently, and some don't charge for it at all.

The cost that hurts small teams is the attention a cluster asks for:

- **Upgrades never stop.** Each Kubernetes minor release is supported by the community for roughly 14 months. On EKS, a version gets 14 months of standard support, then extended support at the higher price. In practice that means a cluster upgrade, with its deprecated APIs and add-on compatibility checks, roughly once a year at minimum.
- **Add-ons are part of your app now.** An ingress controller, cert-manager, a metrics stack, a secrets integration, maybe an autoscaler. Each one has its own release cycle and its own breaking changes. A good example: the community Ingress NGINX controller, one of the most common ways to route traffic into a cluster, was retired in March 2026. Existing installs keep working, but there are no more releases or security fixes, and the project recommends migrating to Gateway API. A team that adopted the default choice a couple of years ago now has a migration on its roadmap that has nothing to do with its product.
- **Debugging has more layers.** "The site is slow" can now mean the pod, the node, the network policy, the ingress, the service mesh, or the database. On a VPS, it is usually one of three things, and `htop` and the Nginx error log find it.
- **Knowledge concentrates.** On a small team, one person usually becomes "the Kubernetes person." When they are on holiday, nobody else wants to touch production.

None of this is a reason Kubernetes is bad. It is the price of a powerful tool, and a three-person team pays it from the same hours it needs for features.

## Containers are worth adopting long before a cluster is

The good parts of the Kubernetes world don't require Kubernetes. The most useful one is the container image as the unit you deploy.

Building a single image in CI, scanning it, tagging it immutably and running that exact image in staging and production removes a whole class of "works on my machine" problems. It also keeps your options open. An app that ships as a well-built image can move to a managed container service or a cluster later with far less work than one deployed by SSH and `composer install` on the server.

So my usual path for a growing PHP product looks like this:

1. **One server, done properly.** Atomic deploys, a sized FPM pool, Supervisor or systemd for workers, managed or well-backed-up MySQL, monitoring and alerts.
2. **Container images in CI.** The same image runs everywhere. Docker Compose on the server is fine at this stage. I covered the build side in [Docker multi-stage builds for PHP and Node apps](/article/docker-multi-stage-builds-php-node-apps/).
3. **Split the stateful parts out.** Move the database to a managed service and sessions, cache and queues to managed Redis. Now the app servers hold no state that matters.
4. **Two or more app servers behind a load balancer.** With stateless app servers, this gives you redundancy and room for traffic spikes. Deploys roll one server at a time.
5. **A managed container platform or Kubernetes**, when the signals below show up.

Step 3 is the one people skip, and it is the one that actually unlocks scaling. A PHP app that writes uploads to local disk or keeps sessions in files can't run as multiple copies, whether on Kubernetes or anywhere else.

## The signals that Kubernetes is starting to pay for itself

I start recommending a cluster, usually a managed one, when several of these are true at once:

- **You run more than a handful of independently deployed services**, owned by different people, and the deploy scripts have started to diverge.
- **Load varies enough that fixed servers waste real money**, or you have regular spikes that a fixed fleet can't absorb.
- **You need per-customer or per-environment isolation** that is painful to do with plain servers, such as spinning up preview environments for every pull request.
- **Someone owns the platform.** Either a dedicated person, or a team that has decided to spend a fixed share of its time on it and has the skills.
- **Compliance or a customer contract** asks for controls (network policies, audit logging, workload identity) that a cluster gives you in a standard way.

One of these alone is rarely enough. Preview environments, for example, can be done with a single server and Docker Compose for a while. When three or four show up together, the platform work stops being overhead and starts saving time.

## Trade-offs: where the "just use a VPS" advice breaks

The single-server path has its own failure modes, and I want to be clear about them.

- **A single VPS is a single point of failure.** If the machine dies, you are down until you restore. Good backups and a scripted rebuild shorten that window, but they don't remove it. If an hour of downtime costs more than a second server, run two.
- **Hand-configured servers drift.** A box set up by hand over two years becomes its own legacy system. Configuration management or at least a rebuild script, kept in the repository, is part of doing the VPS route properly.
- **Some teams already know Kubernetes well.** If two of your three engineers have run clusters before and like it, the attention cost is much lower. A managed cluster with a small, boring set of add-ons can be the simpler choice for that team.
- **Managed container platforms sit in between.** Services that run a container image for you, without a cluster to upgrade, give much of the benefit (image-based deploys, multiple instances, health checks) with less operating work. They are often the right step 5 for a PHP product before full Kubernetes.
- **WordPress has extra constraints.** Plugins that write to disk, update themselves or expect a persistent `wp-content/uploads` folder need object storage and a locked-down deploy before running multiple copies works at all. That is solvable, but it is work that sits in front of any container platform.

The mistake I try to prevent is not "choosing Kubernetes." It is choosing it to fix problems it doesn't fix, before the team has the habits that make any platform reliable.

## What I check on a project like this

1. **Why now:** the specific incidents or limits behind the request, written down, with the actual cause of each.
2. **Deploy safety:** releases are atomic, migrations are backward compatible, and workers restart on deploy.
3. **State location:** database, sessions, cache, queues and uploads all live off the app server, or there is a plan to move them.
4. **Restore drill:** a backup has been restored end to end recently, and the time it took is known.
5. **Build artifact:** the app ships as one immutable image built in CI, the same one used in staging.
6. **Load profile:** real traffic graphs show whether capacity needs to change through the day, or whether a fixed fleet is fine.
7. **Ownership:** a named person or a fixed share of team time is assigned to the platform, whatever it is.
8. **Upgrade budget:** for any cluster or add-on, the team knows the support window and has a date for the next upgrade.

My verdict: for a small PHP team, Kubernetes is usually the right answer to a question you will have in a year or two, not the one you have today. One or two well-run servers, container images built in CI and state moved off the app servers solve most of the outages that start this conversation, and they keep the path to a cluster open. When you have many services, uneven load and someone to own the platform, make the move deliberately, preferably to a managed service, and carry the deploy habits with you.
