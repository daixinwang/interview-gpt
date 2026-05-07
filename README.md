<div align="center">

# 🎯 InterviewGPT

**Your AI Mock Interviewer — with personality.**

A multi-agent AI interview coach that asks, probes, challenges, and gives you a structured report. Built with Claude.

[简体中文](./README.zh-CN.md) · English

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new) [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

</div>

---

> ⚠️ **Status:** Early MVP under active development. README and demo assets coming soon.

## Why InterviewGPT

Most AI interview tools are polite chatbots. **InterviewGPT plays a real interviewer** — it follows up, challenges vague answers, and pushes you the way a senior engineer would.

**Differentiators**
- 🎭 **Real interviewer persona** — probes, questions, digs into weak answers
- 🎯 **Role-aware** — JD-driven question selection from a curated bank
- 🤖 **Multi-agent architecture** (LangGraph) — Orchestrator / Interviewer / Evaluator / Reporter
- 📊 **Structured feedback** — technical depth · communication · STAR completeness

## Architecture

```
Next.js 14 (web)  ──SSE──►  FastAPI + LangGraph (api)  ──►  ChromaDB
                                          ↓
                                Claude 4.6 Sonnet (BYOK)
```

- **Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui
- **Backend:** Python 3.11 · FastAPI · LangGraph · Anthropic SDK
- **Vector store:** ChromaDB (embedded PersistentClient)
- **Streaming:** Server-Sent Events
- **Auth:** None — anonymous + browser localStorage
- **API key:** BYOK (Bring Your Own Key)

## Quick Start

```bash
# 1. Install
pnpm install
pnpm api:install

# 2. Run backend (auto-seeds ChromaDB on first run)
pnpm api:dev

# 3. Run frontend (in another terminal)
pnpm dev --filter web

# 4. Open http://localhost:3000 — paste your Anthropic API key when asked.
```

## License

MIT
