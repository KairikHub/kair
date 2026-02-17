import { Plan, PlanStep, PLAN_VERSION } from "./schema";

const TOP_LEVEL_KEYS = new Set(["version", "title", "steps"]);
const STEP_KEYS = new Set(["id", "summary", "details", "tags", "risks"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value.trim();
}

function parseOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string`);
  }
  return value.trim();
}

function parseOptionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array of strings`);
  }
  return value.map((item, index) => requireNonEmptyString(item, `${path}[${index}]`));
}

function parseStep(stepRaw: unknown, index: number): PlanStep {
  if (!isObject(stepRaw)) {
    throw new Error(`Plan.steps[${index}] must be a JSON object`);
  }

  for (const key of Object.keys(stepRaw)) {
    if (!STEP_KEYS.has(key)) {
      throw new Error(`Plan.steps[${index}] contains unknown key: ${key}`);
    }
  }

  const step: PlanStep = {
    id: requireNonEmptyString(stepRaw.id, `Plan.steps[${index}].id`),
    summary: requireNonEmptyString(stepRaw.summary, `Plan.steps[${index}].summary`),
  };

  const details = parseOptionalString(stepRaw.details, `Plan.steps[${index}].details`);
  const tags = parseOptionalStringArray(stepRaw.tags, `Plan.steps[${index}].tags`);
  const risks = parseOptionalStringArray(stepRaw.risks, `Plan.steps[${index}].risks`);

  if (details !== undefined) {
    step.details = details;
  }
  if (tags !== undefined) {
    step.tags = tags;
  }
  if (risks !== undefined) {
    step.risks = risks;
  }

  return step;
}

function parseSteps(value: unknown): PlanStep[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Plan.steps must be a non-empty array");
  }
  const steps = value.map((stepRaw, index) => parseStep(stepRaw, index));
  const ids = new Set<string>();
  for (const step of steps) {
    if (ids.has(step.id)) {
      throw new Error(`Plan.steps contains duplicate step id: ${step.id}`);
    }
    ids.add(step.id);
  }
  return steps;
}

export function parseAndValidatePlanJson(raw: string): Plan {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    throw new Error("Plan must be a JSON object");
  }
  if (trimmed.startsWith("```")) {
    throw new Error("Plan must be raw JSON without markdown fences");
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(trimmed);
  } catch (error: any) {
    const reason = error && error.message ? error.message : String(error);
    throw new Error(`Invalid JSON: ${reason}`);
  }

  if (!isObject(parsedRaw)) {
    throw new Error("Plan must be a JSON object");
  }

  for (const key of Object.keys(parsedRaw)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      throw new Error(`Plan contains unknown top-level key: ${key}`);
    }
  }

  if (parsedRaw.version !== PLAN_VERSION) {
    throw new Error(`Plan.version must equal ${PLAN_VERSION}`);
  }

  const title = requireNonEmptyString(parsedRaw.title, "Plan.title");
  const steps = parseSteps(parsedRaw.steps);

  return {
    version: PLAN_VERSION,
    title,
    steps,
  };
}
