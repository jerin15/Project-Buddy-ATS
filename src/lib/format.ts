import dirhamAsset from "@/assets/dirham.png.asset.json";

const aedFmt = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });
export const fmtAED = (n: number) => aedFmt.format(Math.round(Number(n) || 0));

export const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export const dirhamSrc = dirhamAsset.url;

export type Project = {
  id: string;
  name: string;
  client: string | null;
  description: string | null;
  status: "active" | "paused" | "done";
  budget_cost: number;
  spent_cost: number;
  budget_hours: number;
  spent_hours: number;
  start_date: string;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function isOverBudget(p: Project) {
  return Number(p.spent_cost) > Number(p.budget_cost);
}
export function isOverTime(p: Project) {
  return Number(p.spent_hours) > Number(p.budget_hours);
}
export function isOverdue(p: Project) {
  if (!p.due_date || p.status === "done") return false;
  return new Date(p.due_date).getTime() < Date.now();
}
