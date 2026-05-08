<div align="center">

# 🎯 InterviewGPT

**有人格的 AI 面试官 —— 你的求职模拟面试陪练。**

一个会追问、会质疑、会挖坑的多 Agent AI 面试官，给你结构化评估报告。基于 Claude 构建。

简体中文 · [English](./README.md)

[![部署到 Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdaixinwang%2Finterview-gpt&env=NEXT_PUBLIC_API_URL&envDescription=Public%20URL%20of%20your%20deployed%20API%20backend&project-name=interview-gpt&root-directory=apps%2Fweb)
[![部署到 Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https%3A%2F%2Fgithub.com%2Fdaixinwang%2Finterview-gpt)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)

</div>

---

## ✨ 为什么是 InterviewGPT

市面上的 AI 面试工具大多是客气的聊天机器人，给你一些虚的鼓励。**InterviewGPT 扮演一个真正的面试官** —— 它会追问空泛的回答、会质疑你的判断、会像一个资深工程师在真实面试里那样把你逼到墙角。

**核心差异化**

- 🎭 **真实面试官人格** —— 直接、有压力、答得空就追问
- 🎯 **岗位精准** —— 粘贴 JD，按岗位栈检索题库
- 🤖 **多 Agent 架构（LangGraph）** —— Orchestrator → Interviewer → Evaluator → Reporter
- 📊 **结构化反馈** —— 技术深度 · 表达逻辑 · 项目主理感 · 临场推理，附可执行下一步
- 🔒 **BYOK + 零数据留存** —— API Key 仅存于你的浏览器，服务端永不持久化

## 🎬 工作原理

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│   Next.js Web   │SSE─►│         FastAPI + LangGraph          │
│  (App Router)   │     │                                      │
└─────────────────┘     │  Orchestrator  →  Interviewer        │
        ▲               │       ↑              │               │
        │               │       │              ▼               │
        │               │  Evaluator  ←   (候选人回答)         │
        │               │                                      │
        │               │  Reporter（最终 Markdown 报告）      │
        │               └──────────────────────────────────────┘
        │                              │             │
        │                              ▼             ▼
        │                         ChromaDB     Claude 4.6 Sonnet
        │                         （题库）       （BYOK 头）
        └──────────────── Markdown 报告 ◄────────────┘
```

**Orchestrator** 是纯 Python 状态机，决定下一步（提问 / 追问 / 评估 / 出报告）。**Interviewer** 把问题流式吐到浏览器。**Evaluator** 给每个回答打分并标出值得追问的弱点。**Reporter** 在面试结束时生成最终 Markdown 报告。

## 🛠 技术栈

| 层 | 选择 | 理由 |
|---|---|---|
| 前端 | Next.js 14 · TypeScript · Tailwind · shadcn/ui | App Router 友好支持流式，shadcn 不锁框架 |
| 后端 | Python 3.11 · FastAPI · LangGraph | 异步成熟、依赖注入清爽、Agent 编排利器 |
| LLM | Claude 4.6 Sonnet | 长上下文推理 + JSON 模式都顶 |
| 向量库 | ChromaDB（嵌入式） | 零运维，跟 API 一个进程 |
| 流式 | Server-Sent Events | 单向、比 WebSocket 简单、Serverless 友好 |
| 认证 | 无（匿名） | 历史在 localStorage，不连 DB |
| Secrets | `X-Anthropic-Key` 头部 BYOK | 不写日志、不入库 |

## 🚀 本地快速开始

**前置条件：** Node 20+、pnpm 10+、Python 3.11+（推荐安装 [`uv`](https://docs.astral.sh/uv/) 自动管理 Python）、一个 Anthropic API Key。

```bash
# 1. 克隆与安装
git clone https://github.com/daixinwang/interview-gpt.git
cd interview-gpt
pnpm install
pnpm api:install         # 通过 uv 创建 .venv

# 2. 复制环境变量模板（可选）
cp .env.example .env

# 3. 启动后端（首次启动自动 seed ChromaDB）
pnpm api:dev
# → http://localhost:8000

# 4. 另开一个终端，启动前端
pnpm --filter @interview-gpt/web dev
# → http://localhost:3000
```

打开 http://localhost:3000，按提示粘入你的 Anthropic API Key，选岗位，粘贴 JD 和简历，开始。

## 📦 部署

| 组件 | 推荐平台 | 备注 |
|---|---|---|
| `apps/web` | **Vercel** | 设置 `NEXT_PUBLIC_API_URL` 指向部署后的 API 域名 |
| `apps/api` | **Railway / Fly.io / Render** | 挂卷到 `/app/chroma_data` 持久化向量库 |

README 顶部的 Vercel/Railway 按钮已经预填好大部分参数。

### 会话存储（Session Store）

会话状态通过 `SESSION_STORE_BACKEND` 选择后端：

| 模式 | 适用场景 | 取舍 |
|---|---|---|
| `memory`（默认） | `pnpm dev` / 冒烟 / 快速演示 | 零依赖，但后端一重启就丢全部进行中的面试 |
| `redis` | 任何真实部署 | 可挺过 `uvicorn --reload` 与 redeploy；需要一个 Redis 实例 |

`docker compose up` 默认走 `redis`，并自带一个开了 AOF 的 Redis 服务。自托管生产环境建议设置 `SESSION_STORE_BACKEND=redis` 并用 `SESSION_REDIS_URL` 指向你的 Redis。`SESSION_TTL_SECONDS` 控制空闲会话存活时长（滑动窗口，每次读写都会续期）。

## 🧪 测试

```bash
cd apps/api
uv run pytest -v       # 27 个测试：agents / RAG / 路由
```

前端目前只有类型化 API 客户端，未加 Jest，欢迎 PR。

## 📁 仓库结构

```
interview-gpt/
├── apps/
│   ├── web/              Next.js 14 前端
│   └── api/              FastAPI + LangGraph 后端
├── packages/
│   └── shared-types/     前端共享 TS 类型
├── data/seeds/           手工题库（5 岗位 × 6 题）
├── scripts/              一次性的 Claude 题库扩写脚本
└── docker-compose.yml    本地一键起服务
```

## 🤝 贡献

欢迎 Issue / PR——尤其是新增岗位题库、prompt 调优、UI 改进。改 Agent 图相关的请先开 issue 对齐设计。

## 📄 协议

[MIT](./LICENSE)

---

<div align="center">

如果 InterviewGPT 帮你拿到 offer，给个 ⭐ 然后告诉一个朋友。

</div>
