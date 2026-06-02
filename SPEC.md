# ShipFast Docs — AI-Powered Documentation Q&A

> *Give users instant answers from your docs. No more searching, no more support tickets.*

## Vision

ShipFast Docs is a drop-in AI layer for your documentation. Upload your docs once, get an embeddable widget that answers user questions in plain English — trained only on YOUR content. Developers embed a snippet, users get instant answers.

**Pain point:** Developers waste time answering the same questions. Users waste time searching docs. Support gets flooded. ShipFast Docs solves both.

**Revenue model:** Pay-per-document pricing with a free tier. $0 for 1 doc, $12/mo for 5 docs, $29/mo for unlimited.

## Technical Stack

- **Runtime:** Node.js 20+ with Express
- **Database:** SQLite (file-based, zero infra needed for MVP)
- **AI:** OpenAI GPT-4o (cost-effective, fast)
- **Frontend:** Vanilla HTML/JS (no framework needed for MVP)
- **Embedding:** OpenAI `text-embedding-3-small` for vector storage
- **Hosting:** Any Node.js host (Railway, Render, Fly.io)

## Architecture

```
shipfast-docs/
├── server/
│   ├── index.js           # Express server entry
│   ├── routes/
│   │   ├── docs.js        # Document CRUD
│   │   ├── chat.js        # AI chat endpoint
│   │   ├── embed.js       # Widget snippet generator
│   │   └── webhooks.js    # Stripe webhooks
│   ├── lib/
│   │   ├── openai.js      # OpenAI client
│   │   ├── embed.js       # Document embedding
│   │   ├── vector.js      # Vector store (SQLite fts5)
│   │   └── stripe.js      # Stripe billing
│   └── middleware/
│       └── auth.js        # API key auth
├── widget/
│   └── embed.js           # Embeddable widget (script tag)
├── public/
│   ├── dashboard/         # Admin dashboard
│   └── landing/           # Landing page
├── tests/
│   ├── chat.test.js
│   ├── embed.test.js
│   └── docs.test.js
├── package.json
└── README.md
```

## Core Features

### v1.0 — MVP
1. **Document upload** — POST markdown/text/url, store in SQLite
2. **AI embedding** — Chunk + embed with OpenAI, store vectors in FTS5
3. **Chat endpoint** — POST question, retrieve relevant chunks, answer with GPT-4o
4. **Embed snippet** — Generate `<script>` widget for any website
5. **API key auth** — Each account has an API key for all requests
6. **Pricing page** — 3 tiers with Stripe checkout links
7. **Webhook handling** — Track successful payments, upgrade accounts

### v1.1 — Polish
- Dashboard to view usage, manage docs
- Better chunking strategy (headers, paragraphs)
- Rate limiting per API key

### v2.0 — Scale
- PostgreSQL + pgvector for production
- Multiple plan tiers (team, enterprise)
- Analytics dashboard

## API Design

```
POST /api/v1/docs
  Body: { url, title, content }
  Auth: Bearer <api_key>
  Response: { id, title, chunk_count }

POST /api/v1/chat
  Body: { question, doc_id }
  Auth: Bearer <api_key>
  Response: { answer, sources: [{ chunk, score }] }

GET /api/v1/embed/<doc_id>.js
  Response: JavaScript widget code (self-executing)
```

## Pricing Tiers

| Plan | Price | Docs | Chats/mo | Support |
|------|-------|------|----------|---------|
| **Free** | $0 | 1 | 100 | Community |
| **Starter** | $12/mo | 5 | 5,000 | Email |
| **Pro** | $29/mo | Unlimited | 25,000 | Priority |

## ShipFast Logs — Cancelled Idea

Originally considered "ShipFast Logs" (AI error monitoring). Rejected because:
- Datadog/New Relic have massive moats with infrastructure integrations
- Log ingestion is infrastructure-heavy
- Indie devs already use free tiers of Sentry/DataDog

## Why This Wins

1. **Drop dead simple** — One JS snippet to embed, works on any docs
2. **Clear ROI** — Reduces support tickets, improves user experience
3. **Network effects** — Docs improvements benefit all users
4. **No direct competition** — Generic AI chatbots vs specific doc-trained bots
5. **Viral growth** — Every user embeds it, driving more signups