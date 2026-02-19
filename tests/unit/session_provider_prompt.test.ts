import { resolveProviderSelectionAnswer } from "../../src/core/auth/session";

describe("unit: session provider prompt parsing", () => {
  test("accepts repeated or prefixed openai selection inputs", () => {
    expect(resolveProviderSelectionAnswer("a")).toBe("openai");
    expect(resolveProviderSelectionAnswer("aa")).toBe("openai");
    expect(resolveProviderSelectionAnswer("aaa")).toBe("openai");
    expect(resolveProviderSelectionAnswer("a123")).toBe("openai");
    expect(resolveProviderSelectionAnswer("openai")).toBe("openai");
  });

  test("accepts repeated or prefixed claude selection inputs", () => {
    expect(resolveProviderSelectionAnswer("b")).toBe("claude");
    expect(resolveProviderSelectionAnswer("bb")).toBe("claude");
    expect(resolveProviderSelectionAnswer("bbb")).toBe("claude");
    expect(resolveProviderSelectionAnswer("b123")).toBe("claude");
    expect(resolveProviderSelectionAnswer("claude")).toBe("claude");
  });

  test("returns null for unsupported prompt input", () => {
    expect(resolveProviderSelectionAnswer("")).toBeNull();
    expect(resolveProviderSelectionAnswer("c")).toBeNull();
    expect(resolveProviderSelectionAnswer("hello")).toBeNull();
  });
});
