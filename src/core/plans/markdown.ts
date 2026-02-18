import * as fs from "node:fs";
import * as path from "node:path";

import { getContractPlanMarkdownPath } from "../store/paths";
import type { Plan } from "./schema";

export function planToMarkdown(plan: Plan) {
  const lines: string[] = ["# PLAN", "", `Title: ${plan.title}`, "", "## Steps", ""];
  for (const step of plan.steps) {
    lines.push(`### ${step.id} - ${step.summary}`);
    lines.push("");
    if (step.details && step.details.trim()) {
      lines.push(step.details.trim());
      lines.push("");
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

export function writePlanMarkdown(contractId: string, plan: Plan) {
  const filePath = getContractPlanMarkdownPath(contractId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, planToMarkdown(plan));
  return filePath;
}
