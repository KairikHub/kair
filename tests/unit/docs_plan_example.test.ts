import { parseAndValidatePlanJson } from "../../src/core/plans/validate";

const DOCS_PLAN_EXAMPLE_JSON = JSON.stringify(
  {
    version: "kair.plan.v1",
    title: "Docs example plan",
    steps: [
      {
        id: "s1",
        summary: "Verify install",
        details: "Run kair --help and confirm core commands work.",
      },
    ],
  },
  null,
  2
);

describe("docs canonical plan example", () => {
  test("parses as valid kair.plan.v1 and includes required step semantics", () => {
    const plan = parseAndValidatePlanJson(DOCS_PLAN_EXAMPLE_JSON);

    expect(plan.version).toBe("kair.plan.v1");
    expect(plan.steps.length).toBeGreaterThanOrEqual(1);

    // The runtime schema uses summary/details; map to docs title/description semantics.
    const first = {
      id: plan.steps[0].id,
      title: plan.steps[0].summary,
      description: plan.steps[0].details || "",
    };
    expect(first.id).toBeTruthy();
    expect(first.title).toBeTruthy();
    expect(first.description).toBeTruthy();
  });
});
