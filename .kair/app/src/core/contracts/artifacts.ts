import * as fs from "node:fs";
import * as path from "node:path";

import type { PlanLlmRequestRecord } from "../llm/plan_request_record";
import { getArtifactsDir } from "../store/paths";
import { now } from "../time";

export function writeArtifact(contract: any, proposalSummary: any) {
  const dir = path.join(getArtifactsDir(), contract.id);
  fs.mkdirSync(dir, { recursive: true });
  const safeTimestamp = now().replace(/[:.]/g, "-");
  const filename = `${safeTimestamp}-run.json`;
  const payload = {
    contract_id: contract.id,
    executedVersion: contract.activeVersion,
    controlsApproved: [...contract.controlsApproved],
    proposal: proposalSummary,
    outcome: "mock ok",
  };
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  contract.artifacts.push({
    type: "run",
    content: filePath,
  });
}

function toSafeTimestamp(raw?: string) {
  const value = (raw || now()).trim();
  if (!value) {
    return now().replace(/[:.]/g, "-");
  }
  return value.replace(/[:.]/g, "-");
}

export function writePlanPromptArtifact(record: PlanLlmRequestRecord) {
  const contractId = String(record.contractId || "").trim();
  if (!contractId) {
    throw new Error("writePlanPromptArtifact requires record.contractId");
  }
  const mode = record.mode === "refine" ? "refine" : "generate";
  const safeTimestamp = toSafeTimestamp(record.timestamp);
  const dir = path.join(getArtifactsDir(), contractId, "prompts");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${safeTimestamp}-plan-${mode}.json`);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  return filePath;
}
