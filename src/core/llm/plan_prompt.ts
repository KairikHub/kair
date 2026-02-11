import type { Plan } from "../plans/schema";

type BuildPlanGeneratePromptInput = {
  intent: string;
  currentPlanJson?: Plan | null;
};

export const PLAN_GENERATE_SYSTEM_PROMPT =
  "You are a planning assistant. You output ONLY a single JSON object. No markdown. No code fences. No commentary.";

const PLAN_JSON_SCHEMA = `{
  "version": "kair.plan.v1",
  "title": "non-empty string",
  "steps": [
    {
      "id": "non-empty string",
      "summary": "non-empty string",
      "details": "optional string",
      "tags": ["optional string"],
      "risks": ["optional string"]
    }
  ]
}`;

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

export function buildPlanGeneratePrompt(
  input: BuildPlanGeneratePromptInput
): { system: string; user: string } {
  const currentPlan = input.currentPlanJson !== undefined ? safeJson(input.currentPlanJson) : "null";

  return {
    system: PLAN_GENERATE_SYSTEM_PROMPT,
    user: [
      "Intent:",
      input.intent,
      "",
      "Current plan JSON:",
      currentPlan,
      "",
      "Output requirements:",
      `- Return a JSON object conforming exactly to this schema:\n${PLAN_JSON_SCHEMA}`,
      '- "version" must equal "kair.plan.v1".',
      '- Include top-level fields: "version", "title", and "steps".',
      '- Each step must include "id" and "summary". Optional fields: "details", "tags", "risks".',
      "- No markdown, no code fences, no commentary.",
      "",
      "If you cannot comply, output a valid fallback JSON object with version kair.plan.v1 and a single step explaining failure.",
    ].join("\n"),
  };
}
