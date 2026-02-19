import { createInterface } from "node:readline/promises";
import { spawn } from "node:child_process";

import {
  getProviderToken,
  hasFallbackProviderToken,
  hasKeychainProviderToken,
  setProviderToken,
} from "./keychain";
import { runBrowserOAuth } from "./oauth";
import { getDefaultProvider, setDefaultProvider } from "../store/config";

export type SupportedProvider = "openai" | "claude";
export type ProviderConfigSource = "env" | "keychain" | "fallback";
export type ProviderConfigSourceSummary = ProviderConfigSource | "none" | "mixed";
export type ProviderConfigSnapshot = {
  provider: SupportedProvider;
  configured: boolean;
  sources: ProviderConfigSource[];
  source: ProviderConfigSourceSummary;
  default: boolean;
};

const SUPPORTED_PROVIDERS: SupportedProvider[] = ["openai", "claude"];

function toSupportedProvider(value: string): SupportedProvider | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "openai" || normalized === "claude") {
    return normalized;
  }
  return null;
}

export function resolveProviderSelectionAnswer(answerRaw: string): SupportedProvider | null {
  const normalized = String(answerRaw || "").trim().toLowerCase();
  const first = normalized[0] || "";
  if (first === "a" || normalized === "openai") {
    return "openai";
  }
  if (first === "b" || normalized === "claude") {
    return "claude";
  }
  return null;
}

export async function promptProviderSelection() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const answerRaw = await rl.question("Select provider: [A] OpenAI or [B] Claude: ");
      const resolved = resolveProviderSelectionAnswer(answerRaw);
      if (resolved) {
        return resolved;
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

export function resolveDefaultProvider(): SupportedProvider | null {
  return toSupportedProvider(getDefaultProvider() || "");
}

function getEnvToken(provider: SupportedProvider) {
  return provider === "openai"
    ? String(process.env.KAIR_OPENAI_API_KEY || "").trim()
    : String(process.env.KAIR_CLAUDE_API_KEY || "").trim();
}

function summarizeSources(sources: ProviderConfigSource[]): ProviderConfigSourceSummary {
  if (sources.length === 0) {
    return "none";
  }
  if (sources.length === 1) {
    return sources[0];
  }
  return "mixed";
}

export async function getProviderConfigSnapshot(provider: SupportedProvider): Promise<ProviderConfigSnapshot> {
  const sources: ProviderConfigSource[] = [];
  if (getEnvToken(provider)) {
    sources.push("env");
  }
  if (await hasKeychainProviderToken(provider)) {
    sources.push("keychain");
  }
  if (hasFallbackProviderToken(provider)) {
    sources.push("fallback");
  }
  const defaultProvider = resolveDefaultProvider();
  return {
    provider,
    configured: sources.length > 0,
    sources,
    source: summarizeSources(sources),
    default: defaultProvider === provider,
  };
}

export async function listProviderConfigSnapshots() {
  return Promise.all(SUPPORTED_PROVIDERS.map((provider) => getProviderConfigSnapshot(provider)));
}

export async function isProviderConfigured(provider: SupportedProvider) {
  const envToken = getEnvToken(provider);
  if (envToken) {
    return true;
  }
  const storedToken = String((await getProviderToken(provider)) || "").trim();
  return Boolean(storedToken);
}

export async function getConfiguredProviders() {
  const providers: SupportedProvider[] = [];
  if (await isProviderConfigured("openai")) {
    providers.push("openai");
  }
  if (await isProviderConfigured("claude")) {
    providers.push("claude");
  }
  return providers;
}

function applyProviderTokenToEnv(provider: SupportedProvider, token: string) {
  if (provider === "openai") {
    process.env.KAIR_OPENAI_API_KEY = token;
    return;
  }
  process.env.KAIR_CLAUDE_API_KEY = token;
}

function openBrowser(url: string) {
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    return;
  }
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    return;
  }
  spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

function providerApiKeysUrl(provider: SupportedProvider) {
  if (provider === "openai") {
    return "https://platform.openai.com/api-keys";
  }
  return "https://console.anthropic.com/settings/keys";
}

async function promptForApiKey(provider: SupportedProvider) {
  const url = providerApiKeysUrl(provider);
  console.log(`OAuth client config not found. Opening ${provider} API key page: ${url}`);
  openBrowser(url);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const value = (await rl.question(`Paste your ${provider} API key (or type "cancel"): `)).trim();
      if (value.toLowerCase() === "cancel") {
        throw new Error("Login cancelled.");
      }
      if (value) {
        return value;
      }
      console.log("API key cannot be empty.");
    }
  } finally {
    rl.close();
  }
}

export async function ensureProviderSession(
  provider: SupportedProvider,
  options: { allowInteractiveAuth?: boolean } = {}
) {
  const allowInteractiveAuth = options.allowInteractiveAuth !== false;
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

  let token = "";
  try {
    token = await runBrowserOAuth(provider);
  } catch (error: any) {
    const message = String(error?.message || error || "");
    const missingOAuthClientId = /Missing KAIR_.*_OAUTH_CLIENT_ID/.test(message);
    if (!missingOAuthClientId) {
      throw error;
    }
    if (!allowInteractiveAuth || !process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error(
        `${message} Set API key env var or run login in an interactive terminal to paste key.`
      );
    }
    token = await promptForApiKey(provider);
  }
  await setProviderToken(provider, token);
  applyProviderTokenToEnv(provider, token);
  return token;
}

export async function loginProvider(providerRaw: string, options: { allowInteractiveAuth?: boolean } = {}) {
  const provider = toSupportedProvider(providerRaw);
  if (!provider) {
    throw new Error('Unsupported provider. Use "openai" or "claude".');
  }
  await ensureProviderSession(provider, options);
  setDefaultProvider(provider);
  process.env.KAIR_LLM_PROVIDER = provider;
  return provider;
}
