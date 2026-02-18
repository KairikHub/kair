import { getConfiguredProviders, isProviderConfigured } from "../../src/core/auth/session";

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
});
