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
  "home.section.jd": "岗位 JD（粘贴 100-2000 字最佳）",
  "home.section.resume": "你的简历摘要",
  "home.section.apikey": "Anthropic API Key",
  "home.apikey.help":
    "你的 key 仅保存在浏览器 localStorage，每次请求通过 X-Anthropic-Key 头发到后端，永不持久化。",
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
  "interview.finish": "生成报告",
  "interview.error.apikey": "需要先配置 Anthropic API Key",
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
  "home.section.jd": "Job Description (paste 100-2000 words)",
  "home.section.resume": "Resume Summary",
  "home.section.apikey": "Anthropic API Key",
  "home.apikey.help":
    "Your key is stored only in browser localStorage and sent via X-Anthropic-Key per request — never persisted server-side.",
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
  "interview.finish": "Generate Report",
  "interview.error.apikey": "Please set your Anthropic API Key first",
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
