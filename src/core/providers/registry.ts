import { openaiProvider } from "./openai";
import { Provider } from "./types";

const providers = new Map<string, Provider>([[openaiProvider.name, openaiProvider]]);

export function listProviders() {
  return [...providers.keys()].sort();
}

export function normalizeProviderName(name?: string | null) {
  const normalized = (name || "openai").trim().toLowerCase();
  return normalized || "openai";
}

export function isSupportedProvider(name: string) {
  return providers.has(normalizeProviderName(name));
}

export function getProvider(name: string): Provider {
  const normalized = normalizeProviderName(name);
  const provider = providers.get(normalized);
  if (!provider) {
    throw new Error(`Unsupported provider: ${normalized}. Supported: ${listProviders().join(", ")}`);
  }
  return provider;
}
