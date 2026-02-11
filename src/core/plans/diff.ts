import type { Plan } from "./schema";

export type PlanStepSnapshot = {
  id: string;
  title: string;
  description: string;
};

export type PlanStepChanged = {
  id: string;
  before: PlanStepSnapshot;
  after: PlanStepSnapshot;
};

export type PlanStepDiffById = {
  added: PlanStepSnapshot[];
  removed: PlanStepSnapshot[];
  changed: PlanStepChanged[];
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toStepSnapshot(raw: any): PlanStepSnapshot {
  return {
    id: normalizeText(raw?.id),
    title: normalizeText(raw?.title) || normalizeText(raw?.summary),
    description: normalizeText(raw?.description) || normalizeText(raw?.details),
  };
}

export function diffPlansByStepId(oldPlan: Plan, newPlan: Plan): PlanStepDiffById {
  const oldSteps = (oldPlan.steps || []).map(toStepSnapshot);
  const newSteps = (newPlan.steps || []).map(toStepSnapshot);

  const oldById = new Map(oldSteps.map((step) => [step.id, step] as const));
  const newById = new Map(newSteps.map((step) => [step.id, step] as const));

  const added: PlanStepSnapshot[] = [];
  const removed: PlanStepSnapshot[] = [];
  const changed: PlanStepChanged[] = [];

  for (const step of newSteps) {
    const previous = oldById.get(step.id);
    if (!previous) {
      added.push(step);
      continue;
    }
    if (previous.title !== step.title || previous.description !== step.description) {
      changed.push({
        id: step.id,
        before: previous,
        after: step,
      });
    }
  }

  for (const step of oldSteps) {
    if (!newById.has(step.id)) {
      removed.push(step);
    }
  }

  return { added, removed, changed };
}
