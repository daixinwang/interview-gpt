/**
 * Static job catalog mirroring `data/seeds/jobs.json` on the backend.
 * Kept in sync manually — the list is short and rarely changes.
 */

export interface JobOption {
  id: string;
  titleEn: string;
  titleZh: string;
}

export const JOBS: JobOption[] = [
  { id: "frontend", titleEn: "Frontend Engineer", titleZh: "前端工程师" },
  { id: "backend", titleEn: "Backend Engineer", titleZh: "后端工程师" },
  { id: "algorithm", titleEn: "Algorithm Engineer", titleZh: "算法工程师" },
  { id: "product", titleEn: "Product Manager", titleZh: "产品经理" },
  { id: "data", titleEn: "Data Engineer", titleZh: "数据工程师" },
];

export function jobLabel(j: JobOption, lang: "zh" | "en"): string {
  return lang === "zh" ? j.titleZh : j.titleEn;
}
