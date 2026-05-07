<div align="center">

# 🎯 InterviewGPT

**有人格的 AI 面试官 —— 你的求职模拟面试陪练。**

一个会追问、会质疑、会挖坑的多 Agent AI 面试官，给你结构化评估报告。基于 Claude 构建。

简体中文 · [English](./README.md)

[![部署到 Vercel](https://vercel.com/button)](https://vercel.com/new) [![部署到 Railway](https://railway.app/button.svg)](https://railway.app/new)

</div>

---

> ⚠️ **当前状态：** MVP 开发中，README 和演示素材完善中。

## 为什么是 InterviewGPT

市面上的 AI 面试工具大多是客气的聊天机器人。**InterviewGPT 扮演真正的面试官** —— 会追问、会质疑空泛的回答、会像资深工程师一样把你逼到墙角。

**差异化**
- 🎭 **真实面试官人格** —— 追问、质疑、深挖弱点
- 🎯 **岗位精准** —— JD 驱动的题库检索
- 🤖 **多 Agent 架构**（LangGraph）—— Orchestrator / Interviewer / Evaluator / Reporter
- 📊 **结构化反馈** —— 技术深度 · 表达逻辑 · STAR 完整度

## 架构

```
Next.js 14 (web)  ──SSE──►  FastAPI + LangGraph (api)  ──►  ChromaDB
                                          ↓
                                Claude 4.6 Sonnet (BYOK)
```

- **前端：** Next.js 14（App Router）· TypeScript · Tailwind · shadcn/ui
- **后端：** Python 3.11 · FastAPI · LangGraph · Anthropic SDK
- **向量库：** ChromaDB（嵌入式 PersistentClient）
- **流式：** Server-Sent Events
- **认证：** 无 —— 匿名 + 浏览器 localStorage
- **API Key：** 用户自带（BYOK）

## 快速开始

```bash
# 1. 安装依赖
pnpm install
pnpm api:install

# 2. 启动后端（首次启动自动 seed ChromaDB）
pnpm api:dev

# 3. 启动前端（另开一个终端）
pnpm dev --filter web

# 4. 打开 http://localhost:3000，按提示填入你的 Anthropic API Key。
```

## License

MIT
