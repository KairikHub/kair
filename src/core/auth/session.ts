import { createInterface } from "node:readline/promises";

import { getProviderToken, setProviderToken } from "./keychain";
import { runBrowserOAuth } from "./oauth";

export type SupportedProvider = "openai" | "claude";

function toSupportedProvider(value: string): SupportedProvider | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "openai" || normalized === "claude") {
    return normalized;
  }
  return null;
}

export async function promptProviderSelection() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const answer = (await rl.question("Select provider: [A] OpenAI or [B] Claude: "))
        .trim()
        .toLowerCase();
      if (answer === "a" || answer === "openai") {
        return "openai" as SupportedProvider;
      }
      if (answer === "b" || answer === "claude") {
        return "claude" as SupportedProvider;
      }
      console.log("Choose A/OpenAI or B/Claude.");
    }
  } finally {
    rl.close();
  }
}

export function resolveProviderFromInput(providerRaw: string): SupportedProvider | null {
  const direct = toSupportedProvider(providerRaw);
  if (direct) {
    return direct;
  }
  return toSupportedProvider(process.env.KAIR_LLM_PROVIDER || "");
}

function applyProviderTokenToEnv(provider: SupportedProvider, token: string) {
  if (provider === "openai") {
    process.env.KAIR_OPENAI_API_KEY = token;
    return;
  }
  process.env.KAIR_CLAUDE_API_KEY = token;
}

export async function ensureProviderSession(provider: SupportedProvider) {
  const envToken =
    provider === "openai"
      ? String(process.env.KAIR_OPENAI_API_KEY || "").trim()
      : String(process.env.KAIR_CLAUDE_API_KEY || "").trim();
  if (envToken) {
    return envToken;
  }

  const savedToken = String((await getProviderToken(provider)) || "").trim();
  if (savedToken) {
    applyProviderTokenToEnv(provider, savedToken);
    return savedToken;
  }

  const token = await runBrowserOAuth(provider);
  await setProviderToken(provider, token);
  applyProviderTokenToEnv(provider, token);
  return token;
}

export async function loginProvider(providerRaw: string) {
  const provider = toSupportedProvider(providerRaw);
  if (!provider) {
    throw new Error('Unsupported provider. Use "openai" or "claude".');
  }
  await ensureProviderSession(provider);
  process.env.KAIR_LLM_PROVIDER = provider;
  return provider;
}
