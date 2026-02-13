import { openaiProvider } from "./openai";
import { mockProvider } from "./mock";
import { Provider } from "./types";

function buildProvidersMap() {
  const providers = new Map<string, Provider>([[openaiProvider.name, openaiProvider]]);
  if ((process.env.KAIR_TEST_MODE || "").trim() === "1") {
    providers.set(mockProvider.name, mockProvider);
  }
  return providers;
}

export function listProviders() {
  return [...buildProvidersMap().keys()].sort();
}

export function normalizeProviderName(name?: string | null) {
  const defaultProvider = (process.env.KAIR_LLM_PROVIDER || "openai").trim().toLowerCase();
  const normalized = (name || defaultProvider).trim().toLowerCase();
  return normalized || "openai";
}

export function isSupportedProvider(name: string) {
  return buildProvidersMap().has(normalizeProviderName(name));
}

export function getProvider(name: string): Provider {
  const normalized = normalizeProviderName(name);
  const provider = buildProvidersMap().get(normalized);
  if (!provider) {
    throw new Error(`Unsupported provider: ${normalized}. Supported: ${listProviders().join(", ")}`);
  }
  return provider;
}
