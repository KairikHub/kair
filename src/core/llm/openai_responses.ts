type OpenAIPlanTextRequest = {
  intent: string;
  model: string;
  apiKey: string;
  baseUrl: string;
};

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
  const prompt = `Create a concise, step-by-step implementation plan for the following contract intent. Keep it short and actionable.\n\nIntent: ${request.intent}`;
  const response = await fetch(resolveResponsesUrl(request.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
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
    throw new Error(message);
  }
  const payload = await response.json();
  const plan = extractOutputText(payload);
  if (!plan) {
    throw new Error("OpenAI response did not include any text output.");
  }
  return plan;
}
