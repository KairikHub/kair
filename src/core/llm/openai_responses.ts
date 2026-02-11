import type { Plan } from "../plans/schema";
import { PlanLlmRequestRecord, sanitizePlanLlmRequestRecord } from "./plan_request_record";
import { buildPlanGeneratePrompt, PLAN_GENERATE_SYSTEM_PROMPT } from "./plan_prompt";

type OpenAIPlanTextRequest = {
  contractId: string;
  intent: string;
  currentPlanJson?: Plan | null;
  currentPlanText?: string | null;
  instructions?: string | null;
  model: string;
  apiKey: string;
  baseUrl: string;
};

export const OPENAI_PLAN_SYSTEM_PROMPT = PLAN_GENERATE_SYSTEM_PROMPT;

function resolveResponsesUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/g, "");
  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/responses`;
  }
  return `${trimmed}/v1/responses`;
}

function extractOutputText(payload: any) {
  if (!payload) {
    return "";
  }
  if (typeof payload.output_text === "string") {
    return payload.output_text.trim();
  }
  if (!Array.isArray(payload.output)) {
    return "";
  }
  const chunks: string[] = [];
  for (const item of payload.output) {
    if (!item || !Array.isArray(item.content)) {
      continue;
    }
    for (const part of item.content) {
      if (!part) {
        continue;
      }
      if (part.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      } else if (part.type === "text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

export function buildPlanPrompt(
  request: Pick<
    OpenAIPlanTextRequest,
    "contractId" | "intent" | "currentPlanJson" | "currentPlanText" | "instructions"
  >
) {
  const prompt = buildPlanGeneratePrompt({
    intent: request.intent,
    currentPlanJson: request.currentPlanJson ?? null,
  });

  const requestedChanges =
    request.instructions && request.instructions.trim()
      ? request.instructions.trim()
      : "Create an initial plan from intent.";

  return [
    prompt.user,
    "",
    "Requested changes:",
    requestedChanges,
    "",
    "- Preserve existing step ids when possible; only create new ids for new steps.",
    request.currentPlanText && request.currentPlanText.trim()
      ? `Current plan text:\n${request.currentPlanText.trim()}`
      : "",
    "",
    `Contract ID: ${request.contractId}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export async function requestOpenAIPlanText(request: OpenAIPlanTextRequest) {
  const prompt = buildPlanPrompt({
    contractId: request.contractId,
    intent: request.intent,
    currentPlanJson: request.currentPlanJson ?? null,
    currentPlanText: request.currentPlanText ?? null,
    instructions: request.instructions ?? null,
  });
  const messages = [
    { role: "system", content: OPENAI_PLAN_SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ] as const;
  const llmRequestRecord: PlanLlmRequestRecord = {
    provider: "openai",
    model: request.model,
    temperature: 0.1,
    timestamp: new Date().toISOString(),
    contractId: request.contractId,
    mode: request.instructions && request.instructions.trim() ? "refine" : "generate",
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
  };
  const sanitizedRecord = sanitizePlanLlmRequestRecord(llmRequestRecord, {
    secrets: [request.apiKey],
    maxMessageLength: 4000,
  });
  void sanitizedRecord;
  const response = await fetch(resolveResponsesUrl(request.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      temperature: 0.1,
      input: [
        {
          role: messages[0].role,
          content: [{ type: "input_text", text: messages[0].content }],
        },
        {
          role: messages[1].role,
          content: [{ type: "input_text", text: messages[1].content }],
        },
      ],
    }),
  });
  if (!response.ok) {
    let message = `OpenAI request failed with status ${response.status}.`;
    try {
      const errorPayload = await response.json();
      if (errorPayload?.error?.message) {
        message = `OpenAI request failed: ${errorPayload.error.message}`;
      }
    } catch (error) {
      // ignore parse errors
    }
    throw new Error(message);
  }
  const payload = await response.json();
  const plan = extractOutputText(payload);
  if (!plan) {
    throw new Error("OpenAI response did not include any text output.");
  }
  return plan;
}
