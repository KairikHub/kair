import * as fs from "node:fs";
import * as path from "node:path";

const SERVICE_NAME = "kair";

function getFallbackPath() {
  return path.join(process.cwd(), ".kair", "auth-fallback.json");
}

async function loadKeytar() {
  try {
    return await import("keytar");
  } catch {
    return null;
  }
}

function loadFallbackStore() {
  const filePath = getFallbackPath();
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function saveFallbackStore(payload: Record<string, string>) {
  const filePath = getFallbackPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

export async function setProviderToken(provider: string, token: string) {
  const account = `provider/${provider}`;
  const keytar = await loadKeytar();
  if (keytar?.setPassword) {
    await keytar.setPassword(SERVICE_NAME, account, token);
    return;
  }
  const store = loadFallbackStore();
  store[account] = token;
  saveFallbackStore(store);
}

export async function getProviderToken(provider: string) {
  const account = `provider/${provider}`;
  const keytar = await loadKeytar();
  if (keytar?.getPassword) {
    return keytar.getPassword(SERVICE_NAME, account);
  }
  const store = loadFallbackStore();
  return typeof store[account] === "string" ? store[account] : null;
}

export async function hasKeychainProviderToken(provider: string) {
  const account = `provider/${provider}`;
  const keytar = await loadKeytar();
  if (!keytar?.getPassword) {
    return false;
  }
  const value = await keytar.getPassword(SERVICE_NAME, account);
  return Boolean(String(value || "").trim());
}

export function hasFallbackProviderToken(provider: string) {
  const account = `provider/${provider}`;
  const store = loadFallbackStore();
  return Boolean(typeof store[account] === "string" && String(store[account]).trim());
}
