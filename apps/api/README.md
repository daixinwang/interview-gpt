# InterviewGPT API

FastAPI + LangGraph multi-agent backend for InterviewGPT.

## Develop

```bash
# from repo root
pnpm api:install   # uv sync
pnpm api:dev       # uvicorn with reload on :8000
```

## Endpoints (planned)

- `POST /api/interview/start` — create session
- `GET  /api/interview/stream/{session_id}` — SSE token stream
- `POST /api/interview/answer/{session_id}` — submit answer
- `POST /api/interview/finish/{session_id}` — generate report

All endpoints requiring LLM calls expect the user's Anthropic API key in the `X-Anthropic-Key` header (BYOK).
