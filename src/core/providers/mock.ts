import type { Plan } from "../plans/schema";
import { PLAN_VERSION } from "../plans/schema";
import { buildPlanGeneratePrompt } from "../llm/plan_prompt";
import { PlanRequest, Provider } from "./types";

let mockCallCount = 0;

function shouldReturnInvalidFirst() {
  const enabled = (process.env.KAIR_MOCK_INVALID_FIRST || "").trim() === "1";
  return enabled && mockCallCount === 0;
}

function normalizeStepId(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "refined-step";
}

function buildInitialPlan(request: PlanRequest): Plan {
  return {
    version: PLAN_VERSION,
    title: `Mock plan for ${request.contractId}`,
    steps: [
      {
        id: "analyze-intent",
        summary: `Analyze intent: ${request.intent}`,
        details: "Review constraints and expected outputs.",
      },
      {
        id: "implement-and-verify",
        summary: "Implement approved changes and verify evidence.",
        details: "Execute changes and capture audit evidence.",
      },
    ],
  };
}

function buildRefinedPlan(request: PlanRequest): Plan {
  const existing = request.currentPlanJson || buildInitialPlan(request);
  const instructions = (request.instructions || "").trim();
  if (!instructions) {
    return existing;
  }
  const next = JSON.parse(JSON.stringify(existing)) as Plan;
  next.title = `${existing.title} (refined)`;
  const newId = normalizeStepId(instructions);
  if (!next.steps.find((step) => step.id === newId)) {
    next.steps.push({
      id: newId,
      summary: instructions,
      details: "Refinement requested by operator.",
    });
  }
  return next;
}

export const mockProvider: Provider = {
  name: "mock",
  isInstalled() {
    return true;
  },
  requireApiKey() {
    return "";
  },
  async planJson(request: PlanRequest) {
    // Keep mock prompt construction aligned with provider prompt contract.
    void buildPlanGeneratePrompt({
      intent: request.intent,
      currentPlanJson: request.currentPlanJson ?? null,
    });
    if (shouldReturnInvalidFirst()) {
      mockCallCount += 1;
      return "{bad json";
    }
    mockCallCount += 1;
    const plan = request.instructions ? buildRefinedPlan(request) : buildInitialPlan(request);
    return JSON.stringify(plan);
  },
};
