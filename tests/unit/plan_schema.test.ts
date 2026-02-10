import { PLAN_VERSION } from "../../src/core/plans/schema";
import { parseAndValidatePlanJson } from "../../src/core/plans/validate";

function buildValidPlanJson() {
  return JSON.stringify({
    version: PLAN_VERSION,
    title: "Checkout safety plan",
    steps: [
      {
        id: "step_prepare",
        title: "Prepare",
        description: "Gather repo context and baseline evidence.",
        tags: ["prep"],
      },
      {
        id: "step_execute",
        title: "Execute",
        description: "Apply approved changes and run tests.",
        depends_on: ["step_prepare"],
      },
    ],
    notes: ["Run in Docker container"],
    risks: ["Unexpected schema drift"],
    constraints: ["No direct production writes"],
  });
}

describe("plan schema validator", () => {
  test("valid plan passes and returns normalized Plan object", () => {
    const parsed = parseAndValidatePlanJson(buildValidPlanJson());
    expect(parsed).toEqual({
      version: PLAN_VERSION,
      title: "Checkout safety plan",
      steps: [
        {
          id: "step_prepare",
          title: "Prepare",
          description: "Gather repo context and baseline evidence.",
          tags: ["prep"],
        },
        {
          id: "step_execute",
          title: "Execute",
          description: "Apply approved changes and run tests.",
          depends_on: ["step_prepare"],
        },
      ],
      notes: ["Run in Docker container"],
      risks: ["Unexpected schema drift"],
      constraints: ["No direct production writes"],
    });
  });

  test('invalid JSON throws "Invalid JSON" message', () => {
    expect(() => parseAndValidatePlanJson("{invalid")).toThrow(/Invalid JSON/);
  });

  test("wrong version throws", () => {
    const raw = JSON.stringify({
      version: "kair.plan.v0",
      steps: [{ id: "s1", title: "One", description: "Desc" }],
    });
    expect(() => parseAndValidatePlanJson(raw)).toThrow("Plan.version must equal kair.plan.v1");
  });

  test("empty steps throws", () => {
    const raw = JSON.stringify({
      version: PLAN_VERSION,
      steps: [],
    });
    expect(() => parseAndValidatePlanJson(raw)).toThrow("Plan.steps must be a non-empty array");
  });

  test("duplicate step ids throws", () => {
    const raw = JSON.stringify({
      version: PLAN_VERSION,
      steps: [
        { id: "dup", title: "One", description: "First" },
        { id: "dup", title: "Two", description: "Second" },
      ],
    });
    expect(() => parseAndValidatePlanJson(raw)).toThrow("Plan.steps contains duplicate step id: dup");
  });

  test("depends_on unknown id throws", () => {
    const raw = JSON.stringify({
      version: PLAN_VERSION,
      steps: [
        { id: "s1", title: "One", description: "First", depends_on: ["missing_step"] },
      ],
    });
    expect(() => parseAndValidatePlanJson(raw)).toThrow(
      "Plan.steps depends_on references unknown step id: missing_step"
    );
  });

  test("unknown top-level key throws", () => {
    const raw = JSON.stringify({
      version: PLAN_VERSION,
      steps: [{ id: "s1", title: "One", description: "First" }],
      xyz: true,
    });
    expect(() => parseAndValidatePlanJson(raw)).toThrow("Plan contains unknown top-level key: xyz");
  });
});
