import type { Plan } from "../../src/core/plans/schema";
import { renderPlanPretty } from "../../src/core/plans/render";

describe("plan pretty renderer", () => {
  test("formats title, numbered steps, wrapped details, and optional meta counts", () => {
    const plan = {
      version: "kair.plan.v1",
      title: "Pretty plan",
      steps: [
        {
          id: "step-a",
          summary: "Collect context",
          details:
            "Collect repository state, verify constraints, and capture current behavior before modifications.",
        },
        {
          id: "step-b",
          summary: "Implement changes",
        },
      ],
      notes: ["n1", "n2"],
      risks: ["r1"],
      constraints: ["c1", "c2", "c3"],
    } as Plan & { notes: string[]; risks: string[]; constraints: string[] };

    expect(renderPlanPretty(plan)).toBe(
      [
        "Title: Pretty plan",
        "Steps:",
        "1) step-a — Collect context",
        "   Collect repository state, verify constraints, and capture",
        "   current behavior before modifications.",
        "2) step-b — Implement changes",
        "Notes: 2",
        "Risks: 1",
        "Constraints: 3",
      ].join("\n")
    );
  });

  test("uses untitled fallback when title is missing or empty", () => {
    const plan = {
      version: "kair.plan.v1",
      title: "   ",
      steps: [
        {
          id: "step-a",
          summary: "Do work",
        },
      ],
    } as Plan;

    expect(renderPlanPretty(plan)).toBe(
      ["Title: (untitled)", "Steps:", "1) step-a — Do work"].join("\n")
    );
  });
});
