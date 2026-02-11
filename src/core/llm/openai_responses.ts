import type { Plan } from "../plans/schema";

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

export const OPENAI_PLAN_SYSTEM_PROMPT =
  "You are a planning assistant. You MUST return ONLY valid JSON. No markdown.";

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

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

export function buildPlanPrompt(
  request: Pick<
    OpenAIPlanTextRequest,
    "contractId" | "intent" | "currentPlanJson" | "currentPlanText" | "instructions"
  >
) {
  const currentPlan =
    request.currentPlanJson !== undefined
      ? safeJson(request.currentPlanJson)
      : request.currentPlanText && request.currentPlanText.trim()
        ? request.currentPlanText.trim()
        : "null";

  const requestedChanges =
    request.instructions && request.instructions.trim()
      ? request.instructions.trim()
      : "Create an initial plan from intent.";

  return [
    "Intent:",
    request.intent,
    "",
    "Current plan JSON:",
    currentPlan,
    "",
    "Requested changes:",
    requestedChanges,
    "",
    "Output requirements:",
    `- Return a JSON object conforming exactly to this schema:\n${PLAN_JSON_SCHEMA}`,
    '- "version" must equal "kair.plan.v1".',
    "- Preserve existing step ids when possible; only create new ids for new steps.",
    "- No markdown, no code fences, no commentary.",
    "",
    "If you cannot comply, output a valid fallback JSON object with version kair.plan.v1 and a single step explaining failure.",
    `Contract ID: ${request.contractId}`,
  ].join("\n");
}

export async function requestOpenAIPlanText(request: OpenAIPlanTextRequest) {
  const prompt = buildPlanPrompt({
    contractId: request.contractId,
    intent: request.intent,
    currentPlanJson: request.currentPlanJson ?? null,
    currentPlanText: request.currentPlanText ?? null,
    instructions: request.instructions ?? null,
  });
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
          role: "system",
          content: [{ type: "input_text", text: OPENAI_PLAN_SYSTEM_PROMPT }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
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
