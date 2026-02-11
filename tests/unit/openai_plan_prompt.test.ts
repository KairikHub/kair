import { OPENAI_PLAN_SYSTEM_PROMPT, buildPlanPrompt } from "../../src/core/llm/openai_responses";
import { buildPlanGeneratePrompt } from "../../src/core/llm/plan_prompt";

describe("openai plan prompt", () => {
  test("buildPlanGeneratePrompt enforces strict JSON-only output with required schema fields", () => {
    const prompt = buildPlanGeneratePrompt({
      intent: "Ship deterministic JSON planning output",
      currentPlanJson: null,
    });

    expect(prompt.system).toBe(OPENAI_PLAN_SYSTEM_PROMPT);
    expect(prompt.system).toContain("ONLY a single JSON object");
    expect(prompt.system).toContain("No markdown");

    expect(prompt.user).toContain("kair.plan.v1");
    expect(prompt.user).toContain('"version"');
    expect(prompt.user).toContain('"steps"');
    expect(prompt.user).toContain('"title"');
    expect(prompt.user).toContain('"id"');
    expect(prompt.user).toContain('"summary"');
    expect(prompt.user).toContain('"details"');
    expect(prompt.user).toContain('"tags"');
    expect(prompt.user).toContain('"risks"');
    expect(prompt.user).toContain("If you cannot comply");
  });

  test("buildPlanPrompt preserves requested changes section", () => {
    const prompt = buildPlanPrompt({
      contractId: "contract_123",
      intent: "Ship deterministic JSON planning output",
      currentPlanJson: null,
      currentPlanText: "Legacy text plan",
      instructions: "Refine the plan to improve safety checks.",
    });

    expect(prompt).toContain("Requested changes:");
    expect(prompt).toContain("Refine the plan to improve safety checks.");
    expect(prompt).toContain("Current plan text:");
  });
});
