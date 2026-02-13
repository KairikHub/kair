import { getProvider, listProviders, normalizeProviderName } from "../../src/core/providers/registry";

describe("providers registry", () => {
  test("normalizeProviderName only normalizes explicit input", () => {
    expect(normalizeProviderName(" OpenAI ")).toBe("openai");
    expect(normalizeProviderName("mock")).toBe("mock");
    expect(normalizeProviderName("")).toBe("");
    expect(normalizeProviderName(null)).toBe("");
    expect(normalizeProviderName(undefined)).toBe("");
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
