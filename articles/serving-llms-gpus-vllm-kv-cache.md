---
title: "Serving LLMs: GPUs, model servers, and the cache that makes chat fast"
slug: serving-llms-gpus-vllm-kv-cache
date: 2026-09-19
category: Engineering
excerpt: "What actually runs behind a chat box: GPU memory, model servers, tokens, KV-cache, batching, and why sticky routing matters more than fancy load balancers."
readTime: 14 min
tags: [ai-infrastructure, llm-serving, gpus, vllm, kv-cache, kubernetes, batching, devops]
---

# Serving LLMs: GPUs, model servers, and the cache that makes chat fast

I spend most of my week in WordPress plugins, Laravel services, and React admin UIs. Chat boxes look like a different planet until you peel the UI off. Underneath, serving a large language model is still **servers, memory, caching, and routing** — the same instincts that keep a WooCommerce checkout fast and a Laravel queue honest.

This is the mental model I use when someone asks, “what actually runs behind that chat box?” No ML math. Just the path from “user hits Send” to “tokens stream back,” and why GPU RAM, the KV-cache, and sticky sessions decide whether the product feels snappy or expensive.

## 1. A model is mostly weights that must live in GPU VRAM

A trained LLM is not magic code that “thinks.” It is a giant pile of numbers — **weights** — plus a runtime that multiplies those numbers against the user’s input over and over.

Those weights want to live in **GPU VRAM** (the fast memory on the graphics card), not only in normal system RAM. Why? Matrix math on a GPU is what makes generation usable. If the weights do not fit in VRAM, the runtime spills to slower memory or refuses to load. Either way you feel it as latency or “out of memory.”

Think of it like loading a huge PHP opcode cache or a Redis working set: if the hot data is not in the fast tier, every request pays a tax. For LLMs the fast tier is VRAM, and the “working set” is the whole model (plus room for the conversation scratchpad we will talk about later).

Rough shape, not a product claim:

- Small open models: a few GB of VRAM may be enough.
- Mid-size models: you start caring about 24 GB, 40 GB, 80 GB cards.
- Bigger models: one GPU is not enough; you split across several.

The exact GB depends on model size, precision (how many bits per weight), and how much free VRAM you leave for the cache. The ops takeaway is simple: **capacity planning starts with “does this fit, with headroom?”**

## 2. A one-off script vs a model server that stays online

There are two ways people first “run” a model:

**One-off script.** Load weights, send one prompt, print the answer, exit. Fine for experiments. Terrible for a product. Every request pays the full load cost. Concurrent users fight each other. There is no shared cache between turns.

**Model server.** A long-lived process keeps the weights in VRAM and listens for HTTP (or gRPC). Clients send prompts; the server returns completions. Same idea as keeping PHP-FPM or a Laravel Octane worker warm instead of booting PHP from scratch on every hit.

Once you have a server, the chat UI becomes boring infrastructure again: a backend calls an API, streams the response, stores the conversation id. The hard part moves to memory and scheduling on the GPU machine.

## 3. OpenAI-shaped HTTP APIs (vLLM-style servers)

Most production stacks do not invent a custom protocol. They expose something close to the familiar chat-completions shape:

```http
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "my-local-model",
  "messages": [
    {"role": "user", "content": "Explain KV-cache like Redis."}
  ],
  "stream": true
}
```

Servers in the vLLM family (and similar runtimes) sit in that niche: load a model once, keep it hot, speak an OpenAI-like HTTP API, and optimize the GPU schedule underneath. You do not need to marry one brand. You need the pattern:

1. Weights stay loaded.
2. Clients speak JSON over HTTP.
3. Streaming is a first-class option.
4. The server owns batching and memory, not your Next.js route handler.

From a Laravel or WordPress plugin perspective, this is just another upstream API with timeouts, retries, and idempotency keys — except the “database” behind it is VRAM.

## 4. Tokens — answers come one piece at a time

Models do not emit finished essays in one shot. They emit **tokens**: small chunks of text (sometimes a word, sometimes part of a word, sometimes punctuation).

A typical flow:

1. Your prompt is turned into tokens.
2. The model predicts the next token.
3. That token is appended.
4. Repeat until a stop condition.

When the UI “types” the answer, it is usually showing tokens as they arrive over a stream (SSE or chunked HTTP). That is why the first word can appear before the full answer exists — same UX instinct as progressive rendering in React, just driven by the model loop.

Token count is also how you get billed and how you hit context limits. Long chats mean more tokens in, more tokens out, more memory for the scratchpad.

## 5. Prefill (pause) vs decode (stream)

Two phases matter more than the marketing slides:

**Prefill** — read the whole prompt (system message, history, latest user turn) and build the internal state the model needs before it can start answering. The user often sees a short pause here. Prefill is heavy parallel work: lots of math over many tokens at once.

**Decode** — generate the answer one token at a time. This is the streaming phase. Each new token depends on what came before, so it feels more sequential.

Diagram in words:

```
[ user sends message ]
        |
        v
   PREFILL (pause)  ----> build state from full prompt
        |
        v
   DECODE (stream)  ----> token, token, token, ...
        |
        v
   [ done / stop ]
```

If prefills are huge (long docs pasted into chat), time-to-first-token climbs even when “tokens per second” later looks fine. If decode is slow, the answer crawls after it starts. Product feel is the mix of both.

## 6. KV-cache: the model’s scratchpad (and why reuse matters)

While the model works through a conversation, it keeps intermediate values often called the **KV-cache** — a scratchpad of “what I’ve already computed for this prompt/history.”

Without reuse, every new user message would force the server to re-read the entire chat from scratch. With reuse, the server can keep the scratchpad for that conversation and only process the new turn. That is the difference between a chat product and a one-shot completion toy.

Map it to instincts you already trust:

| Familiar idea | LLM serving cousin |
|---|---|
| Redis / object cache for hot rows | KV-cache for hot conversation state |
| Sticky sessions to the app server that holds session data | Route the next chat turn to the pod that holds that KV-cache |
| Cache miss = recompute from DB | KV miss = re-prefill the history (slow + expensive) |

KV-cache eats VRAM. Long context × many concurrent chats = memory pressure. Eviction is real: if you drop a conversation’s cache to free space, the next message pays a full re-prefill tax. Same tradeoff as sizing Redis versus accepting stampedes.

## 7. Batching many users on one GPU (and the memory ceiling)

A GPU is expensive if it serves one user at a time. Model servers **batch**: while user A is waiting on the next decode step, fold in work for users B and C on the same GPU.

Batching raises **throughput** (tokens per second across everyone). It also raises **memory use**, because each active conversation wants its own KV scratchpad. Hit the ceiling and the server queues, rejects, or evicts.

Ops picture:

```
          +------------------+
  users ->|  model server    |-> GPU VRAM
          |  - weights       |   (fixed-ish)
          |  - KV for chat1  |   (grows with length)
          |  - KV for chat2  |
          |  - KV for chatN  |
          +------------------+
```

This is capacity planning, not mysticism: how many concurrent chats, how long the histories, what precision, what batch size. The failure mode looks familiar — like MySQL connections or PHP-FPM workers exhausting under a sale traffic spike.

## 8. Throughput vs how fast one user’s answer feels

Two metrics get mixed up constantly:

- **Throughput** — how much total work the GPU finishes (e.g. tokens/second across all users). Great for cost per token.
- **Interactivity** — how fast *one* user’s stream feels (time to first token, tokens/second for that stream).

Aggressive batching can make the cluster look efficient while every individual chat feels slightly laggy — classic “p99 latency vs average utilization” tension. I treat it like CDN and origin tuning: you can maximize cache hit ratio and still make the storefront feel slow if every page waits on a cold path.

When I read a dashboard, I want both: cluster tokens/sec **and** user-facing TTFT / tokens-per-second. Optimizing only one will lie to you.

## 9. When one GPU isn’t enough — split across GPUs

If the weights alone do not fit, or you need more parallel capacity, you split:

- **Tensor / model parallel** — one model sharded across GPUs (the layers/weights are cut up; GPUs talk to each other during a forward pass).
- **Replica parallel** — full copies of the model on different GPUs/nodes; a load balancer picks a replica.

Replicating is the easy mental model (more pods, more capacity). Sharding is what you do when a single copy will not fit. Both change failure domains: a bad node can take down a shard group, not just one replica.

From a deploy view this is still “service topology.” Kubernetes (or bare VMs) place GPU workloads; health checks restart bad pods; you watch VRAM the way you watch disk and RSS on app servers.

## 10. Why naive round-robin wastes cache for chat

Here is the footgun that bites web engineers first.

You have three identical model pods. A load balancer round-robins HTTP requests. Chat turn 1 lands on pod A and builds a fat KV-cache. Chat turn 2 lands on pod B. Pod B does not have that cache. It re-prefills the whole history. Turn 3 hits pod C. Same tax again.

You just turned sticky conversational state into a distributed cache-miss machine.

Round-robin is fine for **stateless** completions (“summarize this one email”). It is hostile to **multi-turn chat** unless every request carries enough context to rebuild cheaply — which long chats do not.

Same lesson as sticky sessions in front of PHP apps that store session files locally, or pinning a user to the Redis shard that holds their cart.

## 11. Smarter routing: cache-aware pods, optional prefill/decode split, Kubernetes

What “smarter” looks like in practice:

**Session-aware / cache-aware routing.** Hash the conversation id (or a prefix of the prompt) and send follow-ups to the pod that already holds that KV-cache. On a miss, pick a pod with free VRAM and accept a cold prefill. This is sticky sessions with an explicit cache story.

**Prefix reuse.** System prompts and shared templates can be cached once and reused across users when the runtime supports it — similar to fragment caching a shared header in WordPress instead of rebuilding it per request.

**Optional split of prompt-reading vs answer-writing.** Some stacks specialize machines for prefill (ingest long prompts) and others for decode (stream tokens). You pay networking and scheduling complexity to keep each GPU doing the shape of work it is good at. You do not need this on day one; you need it when profiles show prefills blocking interactive decode.

**Kubernetes pods.** Typical shape:

```
Ingress / API gateway
        |
        v
  router (conversation-aware)
        |
   +----+----+----+
   |    |    |    |
  pod  pod  pod  pod   <- each: model server + GPU (+ local KV)
```

Each pod is a replica (or a shard member) with a GPU resource request. You still do the boring things: readiness probes that mean “weights loaded,” disruption budgets so you do not evict every cache at once, horizontal scaling when queue depth climbs, and alerts on VRAM saturation — not only CPU.

If you have ever designed Action Scheduler batches so checkout stays light while heavy work runs elsewhere, you already understand the spirit: **keep the interactive path protected; put bulk work where it belongs.**

## 12. Closing: your existing ops skills still apply

Strip the buzzwords and LLM serving is a stack you already know how to reason about:

1. **Memory hierarchy** — weights and KV-cache in VRAM; spilling hurts.
2. **Warm processes** — model servers beat one-off scripts the way Octane / FPM beat cold boots.
3. **APIs** — OpenAI-like HTTP, streaming, timeouts, backpressure.
4. **Incremental output** — tokens as progressive response.
5. **Two-phase work** — prefill vs decode; measure both.
6. **Scratchpad reuse** — KV-cache is the chat performance cliff.
7. **Multi-tenant packing** — batching under a hard memory ceiling.
8. **Latency vs utilization** — one user’s feel vs cluster throughput.
9. **Scale-out topology** — replicas and shards when one GPU is not enough.
10. **Routing with state in mind** — round-robin is not free for chat.
11. **Platform glue** — cache-aware routers, optional prefill/decode pools, Kubernetes discipline.

I did not need a new personality to learn this layer. I needed to map it onto caching, sticky sessions, queue isolation, and capacity planning — the same craft that keeps WordPress, Laravel, and React products honest under real traffic.

If you can debug why a cart fragment cache miss makes checkout feel slow, you can debug why a KV-cache miss makes a chat turn feel dead. The chips are different. The engineering is not.

