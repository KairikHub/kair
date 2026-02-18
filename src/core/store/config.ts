import * as fs from "node:fs";
import * as path from "node:path";

export type KairConfig = {
  defaultProvider?: "openai" | "claude";
};

export function getConfigPath() {
  const override = String(process.env.KAIR_CONFIG_PATH || "").trim();
  if (override) {
    return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
  }
  return path.join(process.cwd(), ".kair", "config.json");
}

export function readConfig(): KairConfig {
  const filePath = getConfigPath();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    const defaultProvider = String((parsed as any).defaultProvider || "").trim().toLowerCase();
    if (defaultProvider === "openai" || defaultProvider === "claude") {
      return { defaultProvider };
    }
    return {};
  } catch {
    return {};
  }
}

export function writeConfig(next: KairConfig) {
  const filePath = getConfigPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2));
  fs.renameSync(tmpPath, filePath);
}

export function getDefaultProvider() {
  return readConfig().defaultProvider || null;
}

export function setDefaultProvider(provider: "openai" | "claude") {
  const current = readConfig();
  writeConfig({
    ...current,
    defaultProvider: provider,
  });
}
