import { Plan, PlanStep, PLAN_VERSION } from "./schema";

const TOP_LEVEL_KEYS = new Set(["version", "title", "steps", "notes", "risks", "constraints"]);

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
  return value;
}

function parseOptionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array of strings`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`${path}[${index}] must be a string`);
    }
    return item;
  });
}

function parseStep(stepRaw: unknown, index: number): PlanStep {
  if (!isObject(stepRaw)) {
    throw new Error(`Plan.steps[${index}] must be a JSON object`);
  }

  const id = requireNonEmptyString(stepRaw.id, `Plan.steps[${index}].id`);
  const title = requireNonEmptyString(stepRaw.title, `Plan.steps[${index}].title`);
  const description = requireNonEmptyString(stepRaw.description, `Plan.steps[${index}].description`);

  const dependsOnRaw = stepRaw.depends_on;
  let depends_on: string[] | undefined;
  if (dependsOnRaw !== undefined) {
    if (!Array.isArray(dependsOnRaw)) {
      throw new Error(`Plan.steps[${index}].depends_on must be an array of step ids`);
    }
    depends_on = dependsOnRaw.map((entry, depIndex) =>
      requireNonEmptyString(entry, `Plan.steps[${index}].depends_on[${depIndex}]`)
    );
  }

  const tagsRaw = stepRaw.tags;
  let tags: string[] | undefined;
  if (tagsRaw !== undefined) {
    if (!Array.isArray(tagsRaw)) {
      throw new Error(`Plan.steps[${index}].tags must be an array of strings`);
    }
    tags = tagsRaw.map((entry, tagIndex) => {
      if (typeof entry !== "string") {
        throw new Error(`Plan.steps[${index}].tags[${tagIndex}] must be a string`);
      }
      return entry;
    });
  }

  const parsed: PlanStep = { id, title, description };
  if (depends_on !== undefined) {
    parsed.depends_on = depends_on;
  }
  if (tags !== undefined) {
    parsed.tags = tags;
  }
  return parsed;
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

  for (const step of steps) {
    if (!step.depends_on) {
      continue;
    }
    for (const depId of step.depends_on) {
      if (!ids.has(depId)) {
        throw new Error(`Plan.steps depends_on references unknown step id: ${depId}`);
      }
    }
  }

  return steps;
}

export function parseAndValidatePlanJson(raw: string): Plan {
  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(raw);
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

  const steps = parseSteps(parsedRaw.steps);
  const title = parseOptionalString(parsedRaw.title, "Plan.title");
  const notes = parseOptionalStringArray(parsedRaw.notes, "Plan.notes");
  const risks = parseOptionalStringArray(parsedRaw.risks, "Plan.risks");
  const constraints = parseOptionalStringArray(parsedRaw.constraints, "Plan.constraints");

  const plan: Plan = {
    version: PLAN_VERSION,
    steps,
  };
  if (title !== undefined) {
    plan.title = title;
  }
  if (notes !== undefined) {
    plan.notes = notes;
  }
  if (risks !== undefined) {
    plan.risks = risks;
  }
  if (constraints !== undefined) {
    plan.constraints = constraints;
  }

  return plan;
}
