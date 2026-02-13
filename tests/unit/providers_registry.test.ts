import { getProvider, listProviders, normalizeProviderName } from "../../src/core/providers/registry";

describe("providers registry", () => {
  test("normalizeProviderName defaults to KAIR_LLM_PROVIDER when input is missing", () => {
    const previousProvider = process.env.KAIR_LLM_PROVIDER;
    try {
      process.env.KAIR_LLM_PROVIDER = "mock";
      expect(normalizeProviderName()).toBe("mock");
      expect(normalizeProviderName(null)).toBe("mock");
    } finally {
      if (previousProvider === undefined) {
        delete process.env.KAIR_LLM_PROVIDER;
      } else {
        process.env.KAIR_LLM_PROVIDER = previousProvider;
      }
    }
  });

  test("normalizeProviderName falls back to openai and explicit value overrides env default", () => {
    const previousProvider = process.env.KAIR_LLM_PROVIDER;
    try {
      delete process.env.KAIR_LLM_PROVIDER;
      expect(normalizeProviderName()).toBe("openai");

      process.env.KAIR_LLM_PROVIDER = "mock";
      expect(normalizeProviderName("openai")).toBe("openai");
    } finally {
      if (previousProvider === undefined) {
        delete process.env.KAIR_LLM_PROVIDER;
      } else {
        process.env.KAIR_LLM_PROVIDER = previousProvider;
      }
    }
  });

  test("listProviders includes openai", () => {
    expect(listProviders()).toContain("openai");
  });

  test("listProviders includes mock only in test mode", () => {
    const previous = process.env.KAIR_TEST_MODE;
    try {
      process.env.KAIR_TEST_MODE = "1";
      expect(listProviders()).toContain("mock");

      delete process.env.KAIR_TEST_MODE;
      expect(listProviders()).not.toContain("mock");
    } finally {
      if (previous === undefined) {
        delete process.env.KAIR_TEST_MODE;
      } else {
        process.env.KAIR_TEST_MODE = previous;
      }
    }
  });

  test("getProvider('openai') works", () => {
    const provider = getProvider("openai");
    expect(provider.name).toBe("openai");
    expect(typeof provider.planJson).toBe("function");
  });

  test("getProvider('nope') throws with supported list", () => {
    expect(() => getProvider("nope")).toThrow(/Unsupported provider: nope\./);
    expect(() => getProvider("nope")).toThrow(/Supported:/);
    expect(() => getProvider("nope")).toThrow(/openai/);
  });
});
