type OpenAIPlanTextRequest = {
  contractId: string;
  intent: string;
  currentPlanText?: string | null;
  model: string;
  apiKey: string;
  baseUrl: string;
};

export const OPENAI_PLAN_SYSTEM_PROMPT =
  "You output ONLY a single JSON object. No markdown. No code fences. No commentary.";

const PLAN_JSON_SHAPE = `{
  "version": "kair.plan.v1",
  "title": "optional string",
  "steps": [
    {
      "id": "required string",
      "title": "required string",
      "description": "required string",
      "depends_on": ["optional step id strings"],
      "tags": ["optional string tags"]
    }
  ],
  "notes": ["optional strings"],
  "risks": ["optional strings"],
  "constraints": ["optional strings"]
}`;

const PLAN_JSON_EXAMPLE = `{
  "version": "kair.plan.v1",
  "title": "Example plan",
  "steps": [],
  "notes": [],
  "risks": [],
  "constraints": []
}`;

export function buildPlanPrompt(request: Pick<OpenAIPlanTextRequest, "contractId" | "intent" | "currentPlanText">) {
  const existingPlanText = request.currentPlanText && request.currentPlanText.trim()
    ? request.currentPlanText.trim()
    : "(none)";

  return [
    "Generate a strict plan JSON object for kair.",
    `Contract ID: ${request.contractId}`,
    `Contract intent:\n${request.intent}`,
    `Existing plan text (if any):\n${existingPlanText}`,
    "Required version: kair.plan.v1",
    "Required schema fields:",
    PLAN_JSON_SHAPE,
    "Rules:",
    '- Return ONLY one JSON object. No markdown. No prose. No code fences. No surrounding text.',
    '- Keep steps ordered and actionable.',
    '- Use unique step ids and valid depends_on references.',
    '- If title/notes/risks/constraints are unknown, omit them or use empty arrays where appropriate.',
    "If you cannot comply, output a JSON object with version \"kair.plan.v1\" and exactly one step that explains the failure.",
    "Example JSON skeleton (syntax example only):",
    PLAN_JSON_EXAMPLE,
  ].join("\n\n");
}

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

export async function requestOpenAIPlanText(request: OpenAIPlanTextRequest) {
  const prompt = buildPlanPrompt({
    contractId: request.contractId,
    intent: request.intent,
    currentPlanText: request.currentPlanText ?? null,
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
          content: [
            {
              type: "input_text",
              text: OPENAI_PLAN_SYSTEM_PROMPT,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
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
