import { OPENAI_PLAN_SYSTEM_PROMPT, buildPlanPrompt } from "../../src/core/llm/openai_responses";
import { buildPlanGeneratePrompt, buildPlanRefinePrompt } from "../../src/core/llm/plan_prompt";

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

  test("buildPlanRefinePrompt includes modify rule and current plan JSON verbatim", () => {
    const currentPlanJson = {
      version: "kair.plan.v1" as const,
      title: "Current plan",
      steps: [
        {
          id: "step-alpha",
          summary: "Do alpha work.",
          details: "Alpha details.",
        },
      ],
    };
    const prompt = buildPlanRefinePrompt({
      intent: "Improve plan quality",
      currentPlanJson,
      changeRequestText: "Add one validation step and keep current IDs.",
    });

    expect(prompt.system).toContain("ONLY a single JSON object");
    expect(prompt.user).toContain(
      "modify the existing plan; preserve step ids unless necessary; change only what user asked"
    );
    expect(prompt.user).toContain(JSON.stringify(currentPlanJson, null, 2));
  });
});
