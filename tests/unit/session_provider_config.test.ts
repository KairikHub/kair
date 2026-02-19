import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  getConfiguredProviders,
  isProviderConfigured,
  listProviderConfigSnapshots,
} from "../../src/core/auth/session";

describe("unit: session provider configuration detection", () => {
  test("detects configured providers from environment keys", async () => {
    const prevOpenai = process.env.KAIR_OPENAI_API_KEY;
    const prevClaude = process.env.KAIR_CLAUDE_API_KEY;
    try {
      process.env.KAIR_OPENAI_API_KEY = "openai-env-token";
      process.env.KAIR_CLAUDE_API_KEY = "claude-env-token";

      await expect(isProviderConfigured("openai")).resolves.toBe(true);
      await expect(isProviderConfigured("claude")).resolves.toBe(true);
      await expect(getConfiguredProviders()).resolves.toEqual(["openai", "claude"]);
    } finally {
      if (prevOpenai === undefined) {
        delete process.env.KAIR_OPENAI_API_KEY;
      } else {
        process.env.KAIR_OPENAI_API_KEY = prevOpenai;
      }
      if (prevClaude === undefined) {
        delete process.env.KAIR_CLAUDE_API_KEY;
      } else {
        process.env.KAIR_CLAUDE_API_KEY = prevClaude;
      }
    }
  });

  test("provider snapshots include fallback source and default marker", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kair-session-test-"));
    const previousCwd = process.cwd();
    const previousConfigPath = process.env.KAIR_CONFIG_PATH;
    const configPath = path.join(root, "config.json");
    const fallbackPath = path.join(root, ".kair", "auth-fallback.json");
    const fallbackPayload = {
      "provider/claude": "fallback-claude-token",
    };
    fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
    fs.writeFileSync(fallbackPath, JSON.stringify(fallbackPayload, null, 2));
    fs.writeFileSync(configPath, JSON.stringify({ defaultProvider: "claude" }, null, 2));
    process.env.KAIR_CONFIG_PATH = configPath;
    delete process.env.KAIR_OPENAI_API_KEY;
    delete process.env.KAIR_CLAUDE_API_KEY;
    process.chdir(root);
    try {
      const snapshots = await listProviderConfigSnapshots();
      const claude = snapshots.find((entry) => entry.provider === "claude");
      const openai = snapshots.find((entry) => entry.provider === "openai");

      expect(claude).toBeDefined();
      expect(claude?.configured).toBe(true);
      expect(claude?.sources).toContain("fallback");
      expect(claude?.source).toBe("fallback");
      expect(claude?.default).toBe(true);

      expect(openai).toBeDefined();
      expect(openai?.configured).toBe(false);
      expect(openai?.source).toBe("none");
      expect(openai?.default).toBe(false);
    } finally {
      process.chdir(previousCwd);
      if (previousConfigPath === undefined) {
        delete process.env.KAIR_CONFIG_PATH;
      } else {
        process.env.KAIR_CONFIG_PATH = previousConfigPath;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
