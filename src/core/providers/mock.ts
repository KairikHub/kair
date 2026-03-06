import type { Plan } from "../plans/schema";
import { PLAN_VERSION } from "../plans/schema";
import { buildPlanGeneratePrompt, buildPlanRefinePrompt } from "../llm/plan_prompt";
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
  if (/rename step a title/i.test(instructions) && request.currentPlanJson) {
    const targetIndex = next.steps.findIndex((step) => step.id === "step-a");
    const resolvedIndex = targetIndex >= 0 ? targetIndex : 0;
    if (next.steps[resolvedIndex]) {
      next.steps[resolvedIndex].summary = "Renamed step A title";
      next.steps[resolvedIndex].details = "Deterministic mock refine transform.";
    }
    return next;
  }
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
    if (request.currentPlanJson && request.instructions && request.instructions.trim()) {
      void buildPlanRefinePrompt({
        intent: request.intent,
        currentPlanJson: request.currentPlanJson,
        changeRequestText: request.instructions.trim(),
      });
    } else {
      void buildPlanGeneratePrompt({
        intent: request.intent,
        currentPlanJson: request.currentPlanJson ?? null,
      });
    }
    if (shouldReturnInvalidFirst()) {
      mockCallCount += 1;
      return {
        text: "{bad json",
        usage: {
          input_tokens: 100,
          output_tokens: 25,
          total_tokens: 125,
        },
        provider: "mock",
        model: (request.model || "mock-default").trim() || "mock-default",
      };
    }
    mockCallCount += 1;
    const plan = request.instructions ? buildRefinedPlan(request) : buildInitialPlan(request);
    const inputSignal = [
      request.contractId,
      request.intent,
      request.instructions || "",
      request.currentPlanText || "",
      request.currentPlanJson ? JSON.stringify(request.currentPlanJson) : "",
    ].join("\n");
    const outputSignal = JSON.stringify(plan);
    const inputTokens = 100 + Math.ceil(inputSignal.length / 16);
    const outputTokens = 50 + Math.ceil(outputSignal.length / 16);
    return {
      text: outputSignal,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      },
      provider: "mock",
      model: (request.model || "mock-default").trim() || "mock-default",
    };
  },
};
