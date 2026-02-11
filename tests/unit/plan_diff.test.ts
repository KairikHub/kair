import type { Plan } from "../../src/core/plans/schema";
import { diffPlansByStepId } from "../../src/core/plans/diff";

describe("plan diff by step id", () => {
  test("returns added, removed, and changed steps", () => {
    const oldPlan: Plan = {
      version: "kair.plan.v1",
      title: "Old",
      steps: [
        {
          id: "step-a",
          summary: "Prepare baseline",
          details: "Collect current state.",
        },
        {
          id: "step-b",
          summary: "Run tests",
          details: "Execute unit tests.",
        },
      ],
    };
    const newPlan: Plan = {
      version: "kair.plan.v1",
      title: "New",
      steps: [
        {
          id: "step-a",
          summary: "Prepare baseline (updated)",
          details: "Collect current state.",
        },
        {
          id: "step-c",
          summary: "Deploy",
          details: "Deploy approved changes.",
        },
      ],
    };

    const diff = diffPlansByStepId(oldPlan, newPlan);

    expect(diff.added.map((step) => step.id)).toEqual(["step-c"]);
    expect(diff.removed.map((step) => step.id)).toEqual(["step-b"]);
    expect(diff.changed.map((step) => step.id)).toEqual(["step-a"]);
    expect(diff.changed[0].before.title).toBe("Prepare baseline");
    expect(diff.changed[0].after.title).toBe("Prepare baseline (updated)");
    expect(diff.changed[0].before.description).toBe("Collect current state.");
    expect(diff.changed[0].after.description).toBe("Collect current state.");
  });

  test("treats title/description aliases as comparable fields", () => {
    const oldPlan = {
      version: "kair.plan.v1",
      title: "Old",
      steps: [
        {
          id: "step-a",
          title: "Alias title",
          description: "Alias description old",
        },
      ],
    } as unknown as Plan;
    const newPlan = {
      version: "kair.plan.v1",
      title: "New",
      steps: [
        {
          id: "step-a",
          title: "Alias title",
          description: "Alias description new",
        },
      ],
    } as unknown as Plan;

    const diff = diffPlansByStepId(oldPlan, newPlan);

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].id).toBe("step-a");
    expect(diff.changed[0].before.description).toBe("Alias description old");
    expect(diff.changed[0].after.description).toBe("Alias description new");
  });
});
