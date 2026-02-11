import { requestOpenAIPlanText } from "../llm/openai_responses";
import { PlanRequest, Provider } from "./types";

const OPENAI_PROVIDER_NAME = "openai";
const DEFAULT_MODEL = "gpt-5.1";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function resolveModel(request: PlanRequest) {
  const model = (request.model || process.env.KAIR_LLM_MODEL || DEFAULT_MODEL).trim();
  return model || DEFAULT_MODEL;
}

function resolveBaseUrl() {
  const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).trim();
  return baseUrl || DEFAULT_BASE_URL;
}

function resolveApiKey() {
  const apiKey = (process.env.KAIR_OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error(
      "Missing KAIR_OPENAI_API_KEY. Set it in your environment to use provider 'openai'."
    );
  }
  return apiKey;
}

export const openaiProvider: Provider = {
  name: OPENAI_PROVIDER_NAME,
  isInstalled() {
    return true;
  },
  requireApiKey() {
    return resolveApiKey();
  },
  async planJson(request: PlanRequest) {
    const apiKey = resolveApiKey();
    return requestOpenAIPlanText({
      contractId: request.contractId,
      intent: request.intent,
      currentPlanJson: request.currentPlanJson ?? null,
      currentPlanText: request.currentPlanText ?? null,
      instructions: request.instructions ?? null,
      model: resolveModel(request),
      apiKey,
      baseUrl: resolveBaseUrl(),
    });
  },
};
