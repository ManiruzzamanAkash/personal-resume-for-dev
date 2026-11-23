---
title: "RAG over your own docs: a small, honest architecture"
slug: rag-over-your-own-docs-small-honest-architecture
date: 2026-11-23
category: AI Engineering
excerpt: "Most chat-with-your-docs projects fail on retrieval, not on the model: the right paragraph never reaches the prompt. Here is the small RAG architecture I build, with Postgres, citations, a refusal path and an eval set."
readTime: 10 min
tags: [ai, rag, llm, pgvector, embeddings, postgres, laravel, saas, architecture]
---

# RAG over your own docs: a small, honest architecture

> **In short**
> - **The problem:** an assistant that answers questions from your documentation, catalog or help center sounds confident even when it is wrong, so customers get bad answers and support ends up cleaning up after it.
> - **What I do about it:** keep the system small (one Postgres database, one pipeline that prepares the documents, one place that answers), make every answer cite its sources, let the assistant say "I don't know", and measure retrieval with a fixed set of real questions before trusting it.
> - **Who this is for:** founders, product teams and engineers adding a docs or support assistant to an existing SaaS, plugin or store.

The demo always works. Someone loads the help center into a vector database, asks "how do I issue a refund?", and the model writes a clean, friendly answer. Everyone agrees it is ready.

Then real customers ask real questions. "Does the yearly plan include the tax add-on?" gets an answer stitched together from an old pricing page and a forum post. "How do I connect Mollie?" returns steps for Stripe, because the two pages look alike. Nothing in the system knows it got it wrong, so it says it just as confidently.

RAG, short for retrieval-augmented generation, means finding the relevant pieces of your own content and handing them to the model with the question, so it answers from your material and not from memory. When it fails, the model is rarely the cause. The right paragraph never made it into the prompt. So the architecture I build is mostly about retrieval, and it is smaller than most people expect.

## The model is the easy part; retrieval decides the answer

A model can only be as correct as the text it was given. If the top five chunks returned for a question don't contain the answer, no prompt wording will rescue it. If they do, even a small, cheap model usually answers well.

That changes where the effort goes. I spend most of the time on three things: how documents are cut into pieces, how pieces are found, and how I find out whether the right piece came back. The generation step is a short prompt and a model call through the same gateway I use for every AI feature (more on that in [adding AI features without a surprise API bill](/article/adding-ai-features-saas-without-surprise-api-bill/)).

## One Postgres database is enough for most teams

You do not need a dedicated vector database to start. If the app already runs on Postgres, the `pgvector` extension adds a `vector` column type, distance operators and approximate-nearest-neighbor indexes. That is the setup I used when I embedded a WooCommerce store's product catalog and support tickets into pgvector so a small RAG agent could answer pre-sale questions on the storefront. On the pilot store, first-response time went from about four hours to under 90 seconds, mostly because the questions that used to wait for a human were ones the catalog already answered.

Keeping vectors next to the rest of the data has practical benefits. Chunks can be joined to the documents, products and permissions they came from. Backups, migrations and access control are the ones you already have. And a WHERE clause on tenant or language is a normal WHERE clause.

A minimal schema:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE doc_chunks (
    id           bigserial PRIMARY KEY,
    tenant_id    bigint      NOT NULL,
    document_id  bigint      NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    heading_path text        NOT NULL,   -- "Payments > Mollie > Webhooks"
    content      text        NOT NULL,
    content_hash char(64)    NOT NULL,   -- skip re-embedding unchanged text
    embedding    vector(1536) NOT NULL,
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX doc_chunks_embedding_idx
    ON doc_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX doc_chunks_tenant_idx ON doc_chunks (tenant_id);
```

Two numbers there are worth knowing. OpenAI's `text-embedding-3-small` returns 1,536 dimensions by default, and its embedding endpoint accepts a `dimensions` parameter to return shorter vectors. And pgvector's indexes on the plain `vector` type support up to 2,000 dimensions, so a larger embedding model may need shortening or a different column type before it can be indexed.

## Chunk by structure, not by character count

Splitting every document into fixed 500-character slices is the default in many tutorials and the source of most bad answers I see. It cuts a setup guide in the middle of step four and separates a table from its header row.

I split on the structure the author already gave the content:

- **Docs and help articles:** one chunk per section under a heading, split further only if a section is very long.
- **Product data:** one chunk per product, built from the fields that matter (name, short description, key attributes, price rules), not the raw HTML.
- **Support tickets:** the resolved question and the accepted answer, not the whole thread with greetings and signatures.

Every chunk carries its heading path, like `Payments > Mollie > Webhooks`, prepended to the text before embedding. That one line does a lot: a chunk that says "set the webhook URL to…" now knows which gateway it belongs to, which is exactly the Stripe-versus-Mollie confusion from the opening.

## Hybrid search beats pure vector search on product words

Vector search finds text with similar meaning. That is great for "how do I get my money back" matching a page titled "Refunds". It is weaker on exact tokens: plan names, error codes, SKUs, function names like `wc_get_orders`. Two chunks about two gateways can sit very close in meaning and differ only in the name that matters.

So I run two searches and merge them: a vector search, and a plain keyword search using Postgres full-text search. A simple way to merge is reciprocal rank fusion: each chunk scores by how high it ranks in each list, and the combined order wins. It needs no tuning to start and handles the "exact name" questions that vector search fumbles.

```sql
-- $1 = query embedding, $2 = tenant, $3 = raw question text
WITH vec AS (
    SELECT id, row_number() OVER (ORDER BY embedding <=> $1) AS r
    FROM doc_chunks WHERE tenant_id = $2
    ORDER BY embedding <=> $1 LIMIT 30
),
kw AS (
    SELECT id, row_number() OVER (
        ORDER BY ts_rank(to_tsvector('english', content),
                         plainto_tsquery('english', $3)) DESC) AS r
    FROM doc_chunks
    WHERE tenant_id = $2
      AND to_tsvector('english', content) @@ plainto_tsquery('english', $3)
    LIMIT 30
)
SELECT id, SUM(1.0 / (60 + r)) AS score
FROM (SELECT * FROM vec UNION ALL SELECT * FROM kw) both_lists
GROUP BY id
ORDER BY score DESC
LIMIT 6;
```

In production I would store the `tsvector` in its own indexed column instead of computing it per row, but the shape stays the same. If retrieval is still not good enough after this, a reranking step on the top results is the next lever, before touching the model.

## Permissions are filtered in the query, never in the prompt

The quietest RAG bug is a leak. Internal runbooks, another customer's tickets, or draft docs get embedded alongside public content, and the assistant happily quotes them. Telling the model "do not reveal internal documents" is not a control; it is a hope.

The rule I follow: the retrieval query only returns chunks the current user is allowed to read. Tenant ID, visibility and audience go into the WHERE clause, the same way they would for any other list in the app. If a chunk never reaches the prompt, the model cannot leak it. The same narrow-access thinking is behind [building an MCP server for a WordPress site safely](/article/building-mcp-server-wordpress-site-safely/).

## Every answer cites its sources, and "I don't know" is a feature

The prompt gives the model numbered chunks, each with its title and URL, and asks it to answer only from them and to cite the numbers it used. The UI turns those numbers into links. That does two things. Customers can check the answer in one click. And when the answer is wrong, the team can see whether retrieval failed (wrong chunks) or generation failed (right chunks, wrong summary), which are different fixes.

The other instruction that matters is permission to refuse. If none of the chunks answer the question, the assistant should say so and offer the next step: a link to search, or a handoff to a human with the question already filled in. A clear "I couldn't find this in our docs" is far cheaper than a confident wrong answer about billing.

I also check the scores before calling the model at all. If the best match is weak, I skip generation and go straight to the fallback. That saves a model call and avoids inviting the model to improvise.

## Ingestion is a pipeline with hashes, not a one-off script

Docs change. Products change price. A RAG system built from a one-time import script is accurate on launch day and slowly wrong after that.

Ingestion runs as a queued job, triggered when a document is saved or deleted, plus a nightly sweep to catch anything missed. Each chunk stores a hash of its text, so unchanged chunks are skipped and only changed ones are re-embedded. Deleted documents cascade their chunks away. In a Laravel app this is a model observer that dispatches a job, and a scheduled command for the sweep; in WordPress it is a `save_post` hook that schedules the same work in the background instead of doing it during the save request.

If you ever change the embedding model, every vector must be regenerated, because vectors from different models are not comparable. I store the model name next to each embedding so a partial migration is visible instead of silently mixing the two.

## A fixed question set tells you if a change helped

Without measurement, every tweak to chunking or prompts is a guess. Before launch I collect forty or fifty real questions, from support inboxes, search logs or pre-sale chats, and for each one note which document should answer it.

Two checks run against that set after every change:

1. **Retrieval:** is the right document in the top results? This is cheap, needs no model judging, and catches most regressions.
2. **Answers:** for a sample, is the answer correct, cited, and does it refuse when it should? This can be a human pass or a model grading against the expected source.

Then I add questions from production. Every thumbs-down and every handoff to a human is a candidate for the set.

## When RAG is the wrong tool

- **Small, stable content.** If the whole knowledge base fits comfortably in a prompt, put it in the prompt, use the provider's prompt caching, and skip the retrieval system.
- **Questions about live data.** "Where is my order?" is a database lookup or a tool call, not a document search. Embedding order rows produces stale, risky answers.
- **Answers that must be exact.** Prices, legal terms and contract clauses should come from the source system and be shown as-is, with the model at most choosing which record to show.
- **Content nobody maintains.** RAG makes outdated docs louder. If the help center is wrong, fix the help center first.
- **No one to own the eval set.** Without someone adding real questions and reviewing failures, quality drifts and nobody notices until customers do.

## What I check on a RAG project like this

1. **Where does the content live, and who keeps it current?** No owner, no launch.
2. **Is chunking based on headings and records,** with the heading path included in each chunk?
3. **Is search hybrid,** so plan names, SKUs and error codes match exactly?
4. **Are permissions applied in the retrieval query,** with tenant and visibility filters tested?
5. **Does every answer cite sources,** and is there a clear refusal and human handoff path?
6. **Is ingestion incremental,** with content hashes, deletes handled, and the embedding model recorded per vector?
7. **Is there a fixed question set,** run after every change, with retrieval and answer checks?
8. **Do model calls go through the shared AI gateway,** with per-feature cost and limits?

My verdict: a good docs assistant is a search problem first and a language problem second. Keep it in the database you already run, cut content along its own structure, search by meaning and by exact words, filter by permission before anything reaches the model, and make the system cite or refuse. Measure retrieval with real questions, and the model you choose matters far less than it seemed in the demo.
