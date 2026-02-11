import { OPENAI_PLAN_SYSTEM_PROMPT, buildPlanPrompt } from "../../src/core/llm/openai_responses";

describe("openai plan prompt", () => {
  test("enforces strict JSON-only output with required schema fields", () => {
    const prompt = buildPlanPrompt({
      contractId: "contract_123",
      intent: "Ship deterministic JSON planning output",
      currentPlanJson: null,
      currentPlanText: "Legacy text plan",
      instructions: "Refine the plan to improve safety checks.",
    });

    expect(OPENAI_PLAN_SYSTEM_PROMPT).toContain("ONLY valid JSON");
    expect(OPENAI_PLAN_SYSTEM_PROMPT).toContain("No markdown");

    expect(prompt).toContain("kair.plan.v1");
    expect(prompt).toContain('"version"');
    expect(prompt).toContain('"steps"');
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"summary"');
    expect(prompt).toContain('"details"');
    expect(prompt).toContain('"risks"');
    expect(prompt).toContain("Requested changes:");
    expect(prompt).toContain("If you cannot comply");
  });
});
