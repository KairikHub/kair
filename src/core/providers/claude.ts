import { requestClaudePlanText } from "../llm/claude_responses";
import { PlanRequest, Provider } from "./types";

const CLAUDE_PROVIDER_NAME = "claude";
const DEFAULT_MODEL = "claude-sonnet-4-5";
const DEFAULT_BASE_URL = "https://api.anthropic.com";

function resolveModel(request: PlanRequest) {
  const model = (request.model || process.env.KAIR_LLM_MODEL || DEFAULT_MODEL).trim();
  return model || DEFAULT_MODEL;
}

function resolveBaseUrl() {
  const baseUrl = (process.env.KAIR_CLAUDE_BASE_URL || DEFAULT_BASE_URL).trim();
  return baseUrl || DEFAULT_BASE_URL;
}

function resolveApiKey() {
  const apiKey = (process.env.KAIR_CLAUDE_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error(
      "Missing KAIR_CLAUDE_API_KEY. Run `kair login --provider claude` or set it in your environment."
    );
  }
  return apiKey;
}

export const claudeProvider: Provider = {
  name: CLAUDE_PROVIDER_NAME,
  isInstalled() {
    return true;
  },
  requireApiKey() {
    return resolveApiKey();
  },
  async planJson(request: PlanRequest) {
    const apiKey = resolveApiKey();
    return requestClaudePlanText({
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
