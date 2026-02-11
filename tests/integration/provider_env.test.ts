import { openaiProvider } from "../../src/core/providers/openai";

describe("integration: provider env requirements", () => {
  test("openai provider throws clear error when KAIR_OPENAI_API_KEY is missing", () => {
    const previousApiKey = process.env.KAIR_OPENAI_API_KEY;
    try {
      delete process.env.KAIR_OPENAI_API_KEY;
      expect(() => openaiProvider.requireApiKey()).toThrow(
        "Missing KAIR_OPENAI_API_KEY. Set it in your environment to use provider 'openai'."
      );
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.KAIR_OPENAI_API_KEY;
      } else {
        process.env.KAIR_OPENAI_API_KEY = previousApiKey;
      }
    }
  });
});
