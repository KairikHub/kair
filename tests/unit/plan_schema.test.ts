import { PLAN_VERSION } from "../../src/core/plans/schema";
import { parseAndValidatePlanJson } from "../../src/core/plans/validate";

function buildValidPlanJson() {
  return JSON.stringify({
    version: PLAN_VERSION,
    title: "Checkout safety plan",
    steps: [
      {
        id: "step-prepare",
        summary: "Gather repo context and baseline evidence.",
        tags: ["prep"],
      },
      {
        id: "step-execute",
        summary: "Apply approved changes and run tests.",
        details: "Run tests and capture artifacts for review.",
        risks: ["Unexpected dependency regression"],
      },
    ],
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
          id: "step-prepare",
          summary: "Gather repo context and baseline evidence.",
          tags: ["prep"],
        },
        {
          id: "step-execute",
          summary: "Apply approved changes and run tests.",
          details: "Run tests and capture artifacts for review.",
          risks: ["Unexpected dependency regression"],
        },
      ],
    });
  });

  test('invalid JSON throws "Invalid JSON" message', () => {
    expect(() => parseAndValidatePlanJson("{invalid")).toThrow(/Invalid JSON/);
  });

  test("markdown fenced payload throws", () => {
    expect(() =>
      parseAndValidatePlanJson("```json\n{\"version\":\"kair.plan.v1\"}\n```")
    ).toThrow("Plan must be raw JSON without markdown fences");
  });

  test("wrong version throws", () => {
    const raw = JSON.stringify({
      version: "kair.plan.v0",
      title: "Bad version",
      steps: [{ id: "s1", summary: "Desc" }],
    });
    expect(() => parseAndValidatePlanJson(raw)).toThrow("Plan.version must equal kair.plan.v1");
  });

  test("missing title throws", () => {
    const raw = JSON.stringify({
      version: PLAN_VERSION,
      steps: [{ id: "s1", summary: "Desc" }],
    });
    expect(() => parseAndValidatePlanJson(raw)).toThrow("Plan.title must be a non-empty string");
  });

  test("empty steps throws", () => {
    const raw = JSON.stringify({
      version: PLAN_VERSION,
      title: "No steps",
      steps: [],
    });
    expect(() => parseAndValidatePlanJson(raw)).toThrow("Plan.steps must be a non-empty array");
  });

  test("duplicate step ids throws", () => {
    const raw = JSON.stringify({
      version: PLAN_VERSION,
      title: "Dup ids",
      steps: [
        { id: "dup", summary: "First" },
        { id: "dup", summary: "Second" },
      ],
    });
    expect(() => parseAndValidatePlanJson(raw)).toThrow("Plan.steps contains duplicate step id: dup");
  });

  test("unknown top-level key throws", () => {
    const raw = JSON.stringify({
      version: PLAN_VERSION,
      title: "Unknown key",
      steps: [{ id: "s1", summary: "First" }],
      xyz: true,
    });
    expect(() => parseAndValidatePlanJson(raw)).toThrow("Plan contains unknown top-level key: xyz");
  });
});
