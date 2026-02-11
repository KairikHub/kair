import { OPENAI_PLAN_SYSTEM_PROMPT, buildPlanPrompt } from "../../src/core/llm/openai_responses";

describe("openai plan prompt", () => {
  test("enforces strict JSON-only output with required schema fields", () => {
    const prompt = buildPlanPrompt({
      contractId: "contract_123",
      intent: "Ship deterministic JSON planning output",
      currentPlanText: "Legacy text plan",
    });

    expect(OPENAI_PLAN_SYSTEM_PROMPT).toContain("ONLY a single JSON object");
    expect(OPENAI_PLAN_SYSTEM_PROMPT).toContain("No markdown");

    expect(prompt).toContain("kair.plan.v1");
    expect(prompt).toContain('"version"');
    expect(prompt).toContain('"steps"');
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"notes"');
    expect(prompt).toContain('"risks"');
    expect(prompt).toContain('"constraints"');
    expect(prompt).toContain("If you cannot comply");
  });
});
