import {
  DpcDecision,
  DpcDecisionStatus,
  DpcEvidence,
  DpcEvidenceKind,
  DpcOpenQuestion,
  DpcV1,
  DPC_VERSION,
} from "./schema";

const TOP_LEVEL_KEYS = new Set([
  "version",
  "topic",
  "assumptions",
  "constraints",
  "decisions",
  "open_questions",
  "evidence",
  "updated_at",
  "parent_dpc_id",
]);
const DECISION_KEYS = new Set(["id", "decision", "rationale", "status"]);
const OPEN_QUESTION_KEYS = new Set(["id", "question", "impact"]);
const EVIDENCE_KEYS = new Set(["id", "kind", "ref", "note"]);
const DECISION_STATUS_VALUES = new Set<DpcDecisionStatus>(["active", "superseded"]);
const EVIDENCE_KIND_VALUES = new Set<DpcEvidenceKind>(["prompt", "plan", "diff", "file", "url"]);

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
  return requireNonEmptyString(value, path);
}

function parseStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array of strings`);
  }
  return value.map((item, index) => requireNonEmptyString(item, `${path}[${index}]`));
}

function parseDecisionStatus(value: unknown, path: string): DpcDecisionStatus {
  if (typeof value !== "string" || !DECISION_STATUS_VALUES.has(value as DpcDecisionStatus)) {
    throw new Error(`${path} must be one of: active, superseded`);
  }
  return value as DpcDecisionStatus;
}

function parseEvidenceKind(value: unknown, path: string): DpcEvidenceKind {
  if (typeof value !== "string" || !EVIDENCE_KIND_VALUES.has(value as DpcEvidenceKind)) {
    throw new Error(`${path} must be one of: prompt, plan, diff, file, url`);
  }
  return value as DpcEvidenceKind;
}

function parseDecision(value: unknown, index: number): DpcDecision {
  if (!isObject(value)) {
    throw new Error(`Dpc.decisions[${index}] must be a JSON object`);
  }

  for (const key of Object.keys(value)) {
    if (!DECISION_KEYS.has(key)) {
      throw new Error(`Dpc.decisions[${index}] contains unknown key: ${key}`);
    }
  }

  const decision: DpcDecision = {
    id: requireNonEmptyString(value.id, `Dpc.decisions[${index}].id`),
    decision: requireNonEmptyString(value.decision, `Dpc.decisions[${index}].decision`),
    status: parseDecisionStatus(value.status, `Dpc.decisions[${index}].status`),
  };

  const rationale = parseOptionalString(value.rationale, `Dpc.decisions[${index}].rationale`);
  if (rationale !== undefined) {
    decision.rationale = rationale;
  }

  return decision;
}

function parseOpenQuestion(value: unknown, index: number): DpcOpenQuestion {
  if (!isObject(value)) {
    throw new Error(`Dpc.open_questions[${index}] must be a JSON object`);
  }

  for (const key of Object.keys(value)) {
    if (!OPEN_QUESTION_KEYS.has(key)) {
      throw new Error(`Dpc.open_questions[${index}] contains unknown key: ${key}`);
    }
  }

  const question: DpcOpenQuestion = {
    id: requireNonEmptyString(value.id, `Dpc.open_questions[${index}].id`),
    question: requireNonEmptyString(value.question, `Dpc.open_questions[${index}].question`),
  };

  const impact = parseOptionalString(value.impact, `Dpc.open_questions[${index}].impact`);
  if (impact !== undefined) {
    question.impact = impact;
  }

  return question;
}

function parseEvidence(value: unknown, index: number): DpcEvidence {
  if (!isObject(value)) {
    throw new Error(`Dpc.evidence[${index}] must be a JSON object`);
  }

  for (const key of Object.keys(value)) {
    if (!EVIDENCE_KEYS.has(key)) {
      throw new Error(`Dpc.evidence[${index}] contains unknown key: ${key}`);
    }
  }

  const evidence: DpcEvidence = {
    id: requireNonEmptyString(value.id, `Dpc.evidence[${index}].id`),
    kind: parseEvidenceKind(value.kind, `Dpc.evidence[${index}].kind`),
    ref: requireNonEmptyString(value.ref, `Dpc.evidence[${index}].ref`),
  };

  const note = parseOptionalString(value.note, `Dpc.evidence[${index}].note`);
  if (note !== undefined) {
    evidence.note = note;
  }

  return evidence;
}

function parseDecisionArray(value: unknown): DpcDecision[] {
  if (!Array.isArray(value)) {
    throw new Error("Dpc.decisions must be an array");
  }
  return value.map((entry, index) => parseDecision(entry, index));
}

function parseOpenQuestionArray(value: unknown): DpcOpenQuestion[] {
  if (!Array.isArray(value)) {
    throw new Error("Dpc.open_questions must be an array");
  }
  return value.map((entry, index) => parseOpenQuestion(entry, index));
}

function parseEvidenceArray(value: unknown): DpcEvidence[] {
  if (!Array.isArray(value)) {
    throw new Error("Dpc.evidence must be an array");
  }
  return value.map((entry, index) => parseEvidence(entry, index));
}

export function parseAndValidateDpcJson(raw: string): DpcV1 {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    throw new Error("Dpc must be a JSON object");
  }
  if (trimmed.startsWith("```")) {
    throw new Error("Dpc must be raw JSON without markdown fences");
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(trimmed);
  } catch (error: any) {
    const reason = error && error.message ? error.message : String(error);
    throw new Error(`Invalid JSON: ${reason}`);
  }

  if (!isObject(parsedRaw)) {
    throw new Error("Dpc must be a JSON object");
  }

  for (const key of Object.keys(parsedRaw)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      throw new Error(`Dpc contains unknown top-level key: ${key}`);
    }
  }

  if (parsedRaw.version !== DPC_VERSION) {
    throw new Error(`Dpc.version must equal ${DPC_VERSION}`);
  }

  const dpc: DpcV1 = {
    version: DPC_VERSION,
    topic: requireNonEmptyString(parsedRaw.topic, "Dpc.topic"),
    assumptions: parseStringArray(parsedRaw.assumptions, "Dpc.assumptions"),
    constraints: parseStringArray(parsedRaw.constraints, "Dpc.constraints"),
    decisions: parseDecisionArray(parsedRaw.decisions),
    open_questions: parseOpenQuestionArray(parsedRaw.open_questions),
    evidence: parseEvidenceArray(parsedRaw.evidence),
    updated_at: requireNonEmptyString(parsedRaw.updated_at, "Dpc.updated_at"),
  };

  const parentDpcId = parseOptionalString(parsedRaw.parent_dpc_id, "Dpc.parent_dpc_id");
  if (parentDpcId !== undefined) {
    dpc.parent_dpc_id = parentDpcId;
  }

  return dpc;
}
