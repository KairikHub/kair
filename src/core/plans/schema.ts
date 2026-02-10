export const PLAN_VERSION = "kair.plan.v1";

export type PlanStep = {
  id: string;
  title: string;
  description: string;
  depends_on?: string[];
  tags?: string[];
};

export type Plan = {
  version: typeof PLAN_VERSION;
  title?: string;
  steps: PlanStep[];
  notes?: string[];
  risks?: string[];
  constraints?: string[];
};
