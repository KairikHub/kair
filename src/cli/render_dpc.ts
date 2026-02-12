import { DpcDecision, DpcV1, DPC_VERSION } from "../core/dpc/schema";

function normalizeText(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

function renderStringSection(lines: string[], heading: string, items: string[]) {
  lines.push(`${heading} (${items.length})`);
  if (items.length === 0) {
    lines.push("- (none)");
    return;
  }

  for (let index = 0; index < items.length; index += 1) {
    lines.push(`${index + 1}) ${normalizeText(items[index])}`);
  }
}

function renderDecisionGroup(lines: string[], heading: string, decisions: DpcDecision[]) {
  lines.push(`${heading} (${decisions.length})`);
  if (decisions.length === 0) {
    lines.push("- (none)");
    return;
  }

  for (const item of decisions) {
    lines.push(`- [${item.id}] ${normalizeText(item.decision)}`);
    if (typeof item.rationale === "string" && item.rationale.trim()) {
      lines.push(`  rationale: ${normalizeText(item.rationale)}`);
    }
  }
}

export function renderDpcPretty(dpc: DpcV1): string {
  const lines: string[] = [
    `DPC (${DPC_VERSION}) — ${normalizeText(dpc.topic)}`,
    `updated_at: ${normalizeText(dpc.updated_at)}`,
    "",
  ];

  renderStringSection(lines, "Assumptions", dpc.assumptions);
  lines.push("");

  renderStringSection(lines, "Constraints", dpc.constraints);
  lines.push("");

  const active = dpc.decisions.filter((item) => item.status === "active");
  const superseded = dpc.decisions.filter((item) => item.status === "superseded");
  lines.push(`Decisions (${dpc.decisions.length})`);
  renderDecisionGroup(lines, "Active", active);
  renderDecisionGroup(lines, "Superseded", superseded);
  lines.push("");

  lines.push(`Open Questions (${dpc.open_questions.length})`);
  if (dpc.open_questions.length === 0) {
    lines.push("- (none)");
  } else {
    for (const item of dpc.open_questions) {
      lines.push(`- [${item.id}] ${normalizeText(item.question)}`);
      if (typeof item.impact === "string" && item.impact.trim()) {
        lines.push(`  impact: ${normalizeText(item.impact)}`);
      }
    }
  }
  lines.push("");

  lines.push(`Evidence (${dpc.evidence.length})`);
  if (dpc.evidence.length === 0) {
    lines.push("- (none)");
  } else {
    for (const item of dpc.evidence) {
      lines.push(`- [${item.id}] ${item.kind}: ${normalizeText(item.ref)}`);
      if (typeof item.note === "string" && item.note.trim()) {
        lines.push(`  note: ${normalizeText(item.note)}`);
      }
    }
  }

  return lines.join("\n");
}
