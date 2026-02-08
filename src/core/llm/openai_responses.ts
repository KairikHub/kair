import { fail } from "../errors";

function resolveOpenAIConfig() {
  const provider = (process.env.KAIR_LLM_PROVIDER || "openai").trim().toLowerCase();
  if (provider !== "openai") {
    fail(
      `Unsupported LLM provider "${provider}". Set KAIR_LLM_PROVIDER=openai to use the built-in adapter.`
    );
  }
  const model = (process.env.KAIR_LLM_MODEL || "gpt-5.1").trim();
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    fail(
      "Missing OPENAI_API_KEY. Set KAIR_OPENAI_API_KEY in .env and restart the containers."
    );
  }
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim();
  return { model, apiKey, baseUrl };
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

export async function coPlanContract(intent: string) {
  const { model, apiKey, baseUrl } = resolveOpenAIConfig();
  const prompt = `Create a concise, step-by-step implementation plan for the following contract intent. Keep it short and actionable.\n\nIntent: ${intent}`;
  const response = await fetch(resolveResponsesUrl(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
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
    fail(message);
  }
  const payload = await response.json();
  const plan = extractOutputText(payload);
  if (!plan) {
    fail("OpenAI response did not include any text output.");
  }
  return plan;
}

