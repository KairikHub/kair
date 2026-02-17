import type { Plan } from "./schema";

const DESCRIPTION_WRAP_WIDTH = 64;

function normalizeWhitespace(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

function wrapText(input: string, width: number): string[] {
  const normalized = normalizeWhitespace(input);
  if (!normalized) {
    return [];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  function pushCurrent() {
    if (current) {
      lines.push(current);
      current = "";
    }
  }

  function pushLongWord(word: string) {
    let remaining = word;
    while (remaining.length > width) {
      lines.push(remaining.slice(0, width));
      remaining = remaining.slice(width);
    }
    current = remaining;
  }

  for (const rawWord of words) {
    const word = rawWord.trim();
    if (!word) {
      continue;
    }

    if (!current) {
      if (word.length <= width) {
        current = word;
      } else {
        pushLongWord(word);
      }
      continue;
    }

    const candidate = `${current} ${word}`;
    if (candidate.length <= width) {
      current = candidate;
      continue;
    }

    pushCurrent();
    if (word.length <= width) {
      current = word;
    } else {
      pushLongWord(word);
    }
  }

  pushCurrent();
  return lines;
}

function readOptionalStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter((item) => typeof item === "string").map((item) => item.trim());
}

export function renderPlanPretty(plan: Plan): string {
  const title = typeof plan.title === "string" && plan.title.trim() ? plan.title.trim() : "(untitled)";
  const lines = [`Title: ${title}`, "Steps:"];

  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    const stepTitle = step.summary && step.summary.trim() ? step.summary.trim() : "(untitled)";
    lines.push(`${index + 1}) ${step.id} — ${stepTitle}`);
    if (typeof step.details === "string" && step.details.trim()) {
      const wrapped = wrapText(step.details, DESCRIPTION_WRAP_WIDTH);
      for (const wrappedLine of wrapped) {
        lines.push(`   ${wrappedLine}`);
      }
    }
  }

  const raw = plan as Plan & {
    notes?: unknown;
    risks?: unknown;
    constraints?: unknown;
  };
  const notes = readOptionalStringArray(raw.notes);
  const risks = readOptionalStringArray(raw.risks);
  const constraints = readOptionalStringArray(raw.constraints);

  if (notes) {
    lines.push(`Notes: ${notes.length}`);
  }
  if (risks) {
    lines.push(`Risks: ${risks.length}`);
  }
  if (constraints) {
    lines.push(`Constraints: ${constraints.length}`);
  }

  return lines.join("\n");
}
