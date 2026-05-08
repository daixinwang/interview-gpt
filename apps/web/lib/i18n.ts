/**
 * Tiny in-memory i18n for the MVP. We intentionally avoid `next-intl`'s
 * routing-based setup because the whole app is a 3-page SPA-ish flow and
 * the user's preferred language lives in localStorage.
 */

export type Lang = "zh" | "en";

type Dict = Record<string, string>;

const ZH: Dict = {
  "app.title": "InterviewGPT",
  "app.tagline": "AI 面试官，会追问、会挖坑、会给你结构化反馈",
  "home.cta.start": "开始模拟面试",
  "home.section.job": "目标岗位",
  "home.section.job.custom": "自定义",
  "home.placeholder.job.custom": "例：高级 iOS 工程师 / SRE / 量化研究员……",
  "home.error.job.custom": "请填写自定义岗位名称",
  "home.section.jd": "岗位 JD（粘贴 100-2000 字最佳）",
  "home.section.resume": "你的简历",
  "home.resume.upload": "上传文件",
  "home.resume.parsing": "解析中…",
  "home.resume.upload.hint":
    "支持 .pdf / .txt / .md（PDF 在浏览器本地解析，不会上传文件本身；扫描版 PDF 暂不支持）",
  "home.resume.uploaded": "已加载",
  "home.section.apikey": "API Key",
  "home.apikey.help":
    "支持任意 OpenAI 兼容服务商（OpenAI / Claude / DeepSeek / 通义 / 豆包 / 智谱 / Kimi / OpenRouter / Ollama 等）。Key 仅保存在浏览器 localStorage，每次请求通过 X-API-Key 头发到后端，永不持久化。",
  "home.advanced.toggle": "高级选项",
  "home.section.provider": "服务商",
  "home.section.model": "模型",
  "home.section.baseurl": "Base URL",
  "home.placeholder.baseurl": "https://api.openai.com/v1",
  "home.baseurl.help": "选择左侧服务商会自动填入；也可以手动改成你的代理或自部署地址。",
  "home.placeholder.jd": "我们正在招聘高级前端工程师，需要……",
  "home.placeholder.resume": "5 年 React 经验，在 X 公司主导设计系统建设……",
  "home.placeholder.apikey": "sk-ant-...",
  "home.history.title": "最近的面试",
  "home.history.empty": "还没有面试记录",
  "home.history.continue": "继续",
  "home.history.report": "查看报告",
  "home.history.delete": "删除",

  "interview.thinking": "面试官思考中…",
  "interview.evaluating": "评估你的回答…",
  "interview.score": "得分",
  "interview.followup": "追问",
  "interview.stage.opening": "开场",
  "interview.stage.tech": "技术",
  "interview.stage.project": "项目",
  "interview.stage.reverse": "反向提问",
  "interview.stage.closing": "结束",
  "interview.placeholder": "用语音或文字回答（Cmd/Ctrl+Enter 发送）",
  "interview.send": "发送回答",
  "interview.skip": "我不知道，跳过",
  "interview.skip.aria": "跳过当前问题并查看参考答案",
  "interview.skipped.label": "（跳过）",
  "interview.reference.label": "参考答案",
  "interview.reference.streaming": "正在生成参考答案…",
  "interview.finish": "生成报告",
  "interview.error.apikey": "需要先配置 API Key",
  "interview.error.session_expired": "会话已过期或已被清理，已为你返回首页",
  "interview.error.empty_stream":
    "面试官没有返回任何内容。请检查 API Key、Base URL 与模型是否匹配（打开浏览器 DevTools 的 Network/Console 可看到详细原因）。",
  "interview.report_ready": "面试已完成，点击生成报告",

  "report.title": "面试评估报告",
  "report.generating": "正在生成报告…",
  "report.download.md": "下载 Markdown",
  "report.copy": "复制全文",
  "report.copied": "已复制",
  "report.back": "返回首页",

  "common.lang.toggle": "EN",
  "common.cancel": "取消",
  "common.save": "保存",
  "common.confirm": "确认",
};

const EN: Dict = {
  "app.title": "InterviewGPT",
  "app.tagline":
    "An AI interviewer that probes, pushes back, and gives you a real evaluation",
  "home.cta.start": "Start Mock Interview",
  "home.section.job": "Target Role",
  "home.section.job.custom": "Custom",
  "home.placeholder.job.custom": "e.g. Senior iOS Engineer / SRE / Quant Researcher…",
  "home.error.job.custom": "Please enter a custom role name",
  "home.section.jd": "Job Description (paste 100-2000 words)",
  "home.section.resume": "Your Resume",
  "home.resume.upload": "Upload file",
  "home.resume.parsing": "Parsing…",
  "home.resume.upload.hint":
    "Supports .pdf / .txt / .md (PDF is parsed locally in the browser — the file itself is never uploaded; scanned PDFs aren't supported)",
  "home.resume.uploaded": "Loaded",
  "home.section.apikey": "API Key",
  "home.apikey.help":
    "Works with any OpenAI-compatible provider (OpenAI, Claude, DeepSeek, Qwen, Doubao, GLM, Kimi, OpenRouter, Ollama, …). Your key is stored only in browser localStorage and sent via X-API-Key per request — never persisted server-side.",
  "home.advanced.toggle": "Advanced",
  "home.section.provider": "Provider",
  "home.section.model": "Model",
  "home.section.baseurl": "Base URL",
  "home.placeholder.baseurl": "https://api.openai.com/v1",
  "home.baseurl.help":
    "Picking a provider auto-fills this; edit to point at your proxy or self-host.",
  "home.placeholder.jd":
    "We are hiring a Senior Frontend Engineer. Required: deep React expertise...",
  "home.placeholder.resume":
    "5 years of React experience, led design system at X...",
  "home.placeholder.apikey": "sk-ant-...",
  "home.history.title": "Recent Interviews",
  "home.history.empty": "No interview history yet",
  "home.history.continue": "Resume",
  "home.history.report": "Report",
  "home.history.delete": "Delete",

  "interview.thinking": "Interviewer is thinking…",
  "interview.evaluating": "Scoring your answer…",
  "interview.score": "Score",
  "interview.followup": "Follow-up",
  "interview.stage.opening": "Opening",
  "interview.stage.tech": "Technical",
  "interview.stage.project": "Project",
  "interview.stage.reverse": "Reverse Q",
  "interview.stage.closing": "Closing",
  "interview.placeholder": "Type your answer (Cmd/Ctrl+Enter to send)",
  "interview.send": "Send Answer",
  "interview.skip": "I don't know — skip",
  "interview.skip.aria": "Skip this question and show a reference answer",
  "interview.skipped.label": "(skipped)",
  "interview.reference.label": "Reference Answer",
  "interview.reference.streaming": "Generating reference answer…",
  "interview.finish": "Generate Report",
  "interview.error.apikey": "Please set your API Key first",
  "interview.error.session_expired":
    "Session expired or no longer available — returning to home",
  "interview.error.empty_stream":
    "Interviewer returned no content. Verify your API Key, Base URL and model are compatible (the browser DevTools Network/Console tabs will show the exact reason).",
  "interview.report_ready":
    "Interview complete. Click to generate the report.",

  "report.title": "Interview Evaluation Report",
  "report.generating": "Generating report…",
  "report.download.md": "Download Markdown",
  "report.copy": "Copy All",
  "report.copied": "Copied",
  "report.back": "Back to Home",

  "common.lang.toggle": "中",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.confirm": "Confirm",
};

export function t(lang: Lang, key: string): string {
  const dict = lang === "zh" ? ZH : EN;
  return dict[key] || key;
}
