export const PLAN_VERSION = "kair.plan.v1";

export type PlanStep = {
  id: string;
  summary: string;
  details?: string;
  tags?: string[];
  risks?: string[];
};

export type KairPlan = {
  version: typeof PLAN_VERSION;
  title: string;
  steps: PlanStep[];
};

export type Plan = KairPlan;
