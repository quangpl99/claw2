# ShipFast Docs ⚡

> *Give users instant answers from your docs. One JS snippet. No more support tickets.*

[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

**ShipFast Docs** is an AI-powered documentation Q&A platform. Upload your docs, get an embeddable widget that answers user questions in plain English — powered by GPT-4o and trained only on YOUR content.

## 🎯 Why ShipFast Docs?

- **For developers:** Reduce support tickets by 80%. Let AI answer FAQs.
- **For users:** Get instant answers instead of searching through docs.
- **For businesses:** Your docs become a 24/7 support agent.

## ✨ Features

- **Trained on YOUR content** — Answers come only from your docs. No hallucinations.
- **Drop-in widget** — One `<script>` tag. Works on any website.
- **Sub-second responses** — GPT-4o powered, optimized for speed.
- **Semantic search** — Finds relevant passages even when questions are phrased differently.
- **Usage analytics** — See what questions users ask most.
- **Privacy first** — We never train on your data. Ever.

## 🚀 Quick Start

```bash
git clone https://github.com/quangpl99/claw2.git
cd claw2
npm install
cp .env.example .env  # Add your OPENAI_API_KEY
npm start
```

Visit http://localhost:3000

## 📖 API Reference

### Upload a document

```bash
curl -X POST http://localhost:3000/api/v1/docs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Getting Started", "url": "https://example.com/docs.md"}'
```

### Chat with a document

```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"doc_id": "DOC_ID", "question": "How do I install this?"}'
```

### Embed the widget

```html
<script src="https://your-domain.com/api/v1/embed/YOUR_DOC_ID.js"></script>
```

## 💰 Pricing

| Plan | Price | Docs | Chats/mo |
|------|-------|------|----------|
| **Free** | $0 | 1 | 100 |
| **Starter** | $12/mo | 5 | 5,000 |
| **Pro** | $29/mo | Unlimited | 25,000 |

## 🏗️ Architecture

```
claw2/
├── server/
│   ├── index.js           # Express entry point
│   ├── routes/
│   │   ├── docs.js        # Document CRUD
│   │   ├── chat.js        # AI chat endpoint
│   │   ├── embed.js       # Widget generator
│   │   ├── webhooks.js    # Stripe webhooks
│   │   └── plans.js       # Pricing plans
│   └── lib/
│       ├── db.js          # SQLite database
│       └── openai.js      # OpenAI client
├── widget/
│   └── embed.js           # Client-side widget
├── public/
│   ├── dashboard/         # Admin dashboard
│   └── landing/          # Marketing site
└── tests/                # Unit tests
```

## 🔧 Configuration

Create a `.env` file:

```env
OPENAI_API_KEY=sk-...          # Required
STRIPE_SECRET_KEY=sk-...        # For billing
STRIPE_WEBHOOK_SECRET=whsec_...# Stripe webhook验证
STRIPE_PRICE_STARTER=price_... # Stripe price IDs
STRIPE_PRICE_PRO=price_...
PORT=3000
BASE_URL=https://your-domain.com
```

## 📦 Deploy

Deploy to any Node.js host:

```bash
# Railway
railway init
railway add

# Render
render deploy

# Fly.io
fly launch
fly deploy
```

## 🧪 Tests

```bash
npm test
```

## 📄 License

MIT © Iron ⚡