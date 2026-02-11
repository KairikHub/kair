import { getProvider, listProviders } from "../../src/core/providers/registry";

describe("providers registry", () => {
  test("listProviders includes openai", () => {
    expect(listProviders()).toContain("openai");
  });

  test("getProvider('openai') works", () => {
    const provider = getProvider("openai");
    expect(provider.name).toBe("openai");
    expect(typeof provider.planJson).toBe("function");
  });

  test("getProvider('nope') throws with supported list", () => {
    expect(() => getProvider("nope")).toThrow("Unsupported provider: nope. Supported: openai");
  });
});
