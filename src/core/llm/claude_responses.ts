import type { Plan } from "../plans/schema";
import type { PlanProviderResponse } from "../providers/types";
import { buildPlanPrompt, OPENAI_PLAN_SYSTEM_PROMPT } from "./openai_responses";

type ClaudePlanTextRequest = {
  contractId: string;
  intent: string;
  currentPlanJson?: Plan | null;
  currentPlanText?: string | null;
  instructions?: string | null;
  model: string;
  apiKey: string;
  baseUrl: string;
};

function resolveMessagesUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/g, "");
  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/messages`;
  }
  return `${trimmed}/v1/messages`;
}

export async function requestClaudePlanText(request: ClaudePlanTextRequest) {
  const prompt = buildPlanPrompt({
    contractId: request.contractId,
    intent: request.intent,
    currentPlanJson: request.currentPlanJson ?? null,
    currentPlanText: request.currentPlanText ?? null,
    instructions: request.instructions ?? null,
  });
  const response = await fetch(resolveMessagesUrl(request.baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": request.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: 4000,
      system: OPENAI_PLAN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude request failed (${response.status}): ${text.slice(0, 500)}`);
  }
  const parsed = await response.json();
  const content = Array.isArray(parsed?.content) ? parsed.content : [];
  const text = content
    .filter((item: any) => item && item.type === "text" && typeof item.text === "string")
    .map((item: any) => item.text)
    .join("\n")
    .trim();
  if (!text) {
    throw new Error("Claude response did not include any text output.");
  }
  const usage = parsed?.usage || {};
  const inputTokens = Number(usage.input_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? 0);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    throw new Error("Claude response did not include usage metadata required for budget accounting.");
  }
  const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens);
  const result: PlanProviderResponse = {
    text,
    usage: {
      input_tokens: Number.isFinite(inputTokens) ? Math.max(0, Math.floor(inputTokens)) : 0,
      output_tokens: Number.isFinite(outputTokens) ? Math.max(0, Math.floor(outputTokens)) : 0,
      total_tokens: Number.isFinite(totalTokens) ? Math.max(0, Math.floor(totalTokens)) : 0,
    },
    provider: "claude",
    model: request.model,
  };
  return result;
}
