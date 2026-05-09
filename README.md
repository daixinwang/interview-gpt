<div align="center">

# 🎯 InterviewGPT

**Your AI Mock Interviewer — asks, probes, challenges, then gives you a structured report.**

A multi-agent AI interview coach built with FastAPI + LangGraph on the backend and Next.js on the frontend. Bring your own API key from any OpenAI-compatible provider.

[简体中文](./README.zh-CN.md) · English

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdaixinwang%2Finterview-gpt&env=NEXT_PUBLIC_API_URL&envDescription=Public%20URL%20of%20your%20deployed%20API%20backend&project-name=interview-gpt&root-directory=apps%2Fweb)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https%3A%2F%2Fgithub.com%2Fdaixinwang%2Finterview-gpt)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)

</div>

---

## ✨ Why InterviewGPT

Most AI interview tools are polite chatbots that pat you on the back. **InterviewGPT plays a real interviewer** — it follows up on vague answers, challenges hand-wavy claims, and pushes you the way a senior engineer would in a real loop.

**What makes it different**

- 🎭 **Real interviewer persona** — sharp, direct, follows up when you're vague
- 🎯 **Role-aware** — paste a JD, get questions tuned to that exact stack; add or remove preset roles
- 🌐 **Any OpenAI-compatible provider** — OpenAI, Anthropic, DeepSeek, Zhipu, Kimi, Doubao, OpenRouter, Ollama, and more
- 🤖 **Multi-agent architecture (LangGraph)** — Orchestrator → Interviewer → Evaluator → Reporter
- 📊 **Bilingual structured feedback** — full zh/en report that matches your UI language, covering technical depth · communication · project ownership · curiosity
- 🔒 **BYOK + zero data retention** — your API key stays in your browser, the server never persists it

## 🖥 UI Highlights

- **ChatGPT-style layout** — persistent sidebar with interview history; click any past session to continue or view its report
- **Settings dropdown** — click the "InterviewGPT" title to configure API key, provider, model, and base URL; settings survive page reloads
- **Inline role management** — click any role chip to select it; hover to reveal a × and remove it; use "+ Add" to create custom roles
- **Interview chat** — auto-growing pill input with a circular send button; hover any bubble to reveal a copy button (and a skip button on the latest question)

## 🎬 How It Works

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│   Next.js Web   │SSE─►│         FastAPI + LangGraph          │
│  (App Router)   │     │                                      │
└─────────────────┘     │  Orchestrator  →  Interviewer        │
        ▲               │       ↑              │               │
        │               │       │              ▼               │
        │               │  Evaluator  ←   (candidate answer)   │
        │               │                                      │
        │               │  Reporter (final markdown report)    │
        │               └──────────────────────────────────────┘
        │                              │             │
        │                              ▼             ▼
        │                         ChromaDB     Any OpenAI-compat
        │                        (question      LLM  (BYOK)
        │                          bank)
        └──────────────── Markdown report ◄──────────┘
```

The **Orchestrator** is a pure-Python state machine that decides the next move (ask / follow-up / evaluate / report). The **Interviewer** streams a question back to the browser. The **Evaluator** scores each answer and flags weaknesses to probe. The **Reporter** writes the final Markdown report in your UI language once the interview ends.

## 🛠 Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 · TypeScript · Tailwind · shadcn/ui | App Router for streamed pages, no extra UI framework lock-in |
| Backend | Python 3.11 · FastAPI · LangGraph | Mature async, clean DI, LangGraph for agent orchestration |
| LLM | Any OpenAI-compatible provider (Claude, GPT-4o, DeepSeek, …) | BYOK — user supplies the key and picks the model in the settings dropdown |
| Vector store | ChromaDB (embedded) | Zero-ops, ships with the API process |
| Streaming | Server-Sent Events | Unidirectional, simpler than WebSocket, plays well with serverless |
| Auth | None (anonymous) | localStorage holds session history; no DB |
| Secrets | BYOK via `X-API-Key` header | Never logged, never persisted |

## 🚀 Quick Start (Local)

**Prerequisites:** Node 20+, pnpm 10+, Python 3.11+ (auto-managed via [`uv`](https://docs.astral.sh/uv/) if installed).

```bash
# 1. Clone & install
git clone https://github.com/daixinwang/interview-gpt.git
cd interview-gpt
pnpm install
pnpm api:install         # creates .venv via uv

# 2. (optional) Copy env template
cp .env.example .env

# 3. Start the API (auto-seeds ChromaDB on first run)
pnpm api:dev
# → http://localhost:8000

# 4. In a second terminal, start the web app
pnpm --filter @interview-gpt/web dev
# → http://localhost:3000
```

Open http://localhost:3000, click **InterviewGPT** in the top bar to open the settings dropdown, enter your API key and choose a provider/model. Then pick a role, paste a JD + resume, and start.

## 📦 Deploy

| Component | Recommended platform | Notes |
|---|---|---|
| `apps/web` | **Vercel** | Set `NEXT_PUBLIC_API_URL` to your deployed API origin |
| `apps/api` | **Railway / Fly.io / Render** | Mount a volume on `/app/chroma_data` for persistent vectors |

The Vercel/Railway buttons at the top of this README do most of the wiring for you.

### Session Store

Interview state lives in a pluggable session store, picked via `SESSION_STORE_BACKEND`:

| Mode | When to use | Trade-off |
|---|---|---|
| `memory` (default) | `pnpm dev`, smoke tests, quick demos | Zero deps, but every backend restart drops in-flight interviews |
| `redis` | Any real deployment | Survives `uvicorn --reload` and redeploys; needs a Redis instance |

`docker compose up` defaults to `redis` and ships a Redis service with AOF persistence. For self-hosted production, set `SESSION_STORE_BACKEND=redis` and point `SESSION_REDIS_URL` at your instance. `SESSION_TTL_SECONDS` controls how long an idle session lives (sliding window — refreshed on every read/write).

## 🧪 Tests

```bash
cd apps/api
uv run pytest -v       # agents, RAG, routes, Redis session store
```

The frontend has typed API clients but no Jest tests yet (PRs welcome).

## 📁 Repository Layout

```
interview-gpt/
├── apps/
│   ├── web/              Next.js 14 frontend
│   └── api/              FastAPI + LangGraph backend
├── packages/
│   └── shared-types/     TS types shared by the web app
├── data/seeds/           Hand-curated question bank (5 roles × 6 questions)
├── scripts/              One-shot Claude-powered seed expander
└── docker-compose.yml    Local one-command bring-up (with Redis)
```

## 🤝 Contributing

Issues and PRs are welcome — especially question-bank contributions for new roles, prompt-engineering improvements, and UI polish. Please open an issue first for anything that touches the agent graph so we can align on the design.

## 📄 License

[MIT](./LICENSE)

---

<div align="center">

If InterviewGPT helps you land an offer, ⭐ the repo and tell a friend.

</div>
