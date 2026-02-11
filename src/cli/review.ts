import * as path from "node:path";

import { EvidenceItem } from "../core/contracts/evidence";

function formatControls(list: any) {
  if (!Array.isArray(list) || list.length === 0) {
    return "none";
  }
  return list.join(", ");
}

function resolveApprovedIntent(contract: any) {
  const versions = Array.isArray(contract?.versions) ? contract.versions : [];
  const approvals = versions.filter(
    (entry: any) => entry && entry.kind === "approval" && typeof entry.intent === "string"
  );
  if (approvals.length === 0) {
    return contract?.intent || "n/a";
  }
  return approvals[approvals.length - 1].intent;
}

function resolveBudget(contract: any) {
  const budget = contract?.budget;
  if (budget === undefined || budget === null || budget === "") {
    return "n/a";
  }
  if (typeof budget === "string" || typeof budget === "number" || typeof budget === "boolean") {
    return String(budget);
  }
  return JSON.stringify(budget);
}

function extractLastRunTimestamp(contract: any) {
  const artifacts = Array.isArray(contract?.artifacts) ? contract.artifacts : [];
  const runArtifacts = artifacts.filter((entry: any) => entry && entry.type === "run");
  if (runArtifacts.length === 0) {
    return "n/a";
  }
  const lastRun = runArtifacts[runArtifacts.length - 1];
  const base = path.basename(String(lastRun.content || ""));
  const match = base.match(/^(.+)-run\.json$/);
  if (!match) {
    return "n/a";
  }
  const compact = match[1];
  const normalized = compact.match(/^(.*T\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  if (!normalized) {
    return compact;
  }
  return `${normalized[1]}:${normalized[2]}:${normalized[3]}.${normalized[4]}Z`;
}

function renderEvidenceChecklist(contractId: string, evidenceItems: EvidenceItem[]) {
  if (evidenceItems.length === 0) {
    return ["Evidence: none (run will seed mock evidence)."];
  }
  return evidenceItems.map(
    (item) => `[ ] ${item.type} - ${item.label} (artifacts/${contractId}/evidence/${item.path})`
  );
}

export function renderReview(contract: any, evidenceItems: EvidenceItem[]) {
  const active = contract?.activeVersion ? `v${contract.activeVersion}` : "n/a";
  const artifacts = Array.isArray(contract?.artifacts) ? contract.artifacts.length : 0;
  const lines = [
    "KAIR REVIEW",
    `Contract: ${contract.id}   State: ${contract.current_state}   Active: ${active}`,
    "",
    "APPROVED INTENT",
    resolveApprovedIntent(contract),
    "",
    "CONSTRAINTS",
    `Required controls: ${formatControls(contract.controlsRequired)}`,
    `Approved controls: ${formatControls(contract.controlsApproved)}`,
    `Budget: ${resolveBudget(contract)}`,
    "",
    "EXECUTION SUMMARY",
    `Artifacts: ${artifacts}`,
    `Last run artifact: ${extractLastRunTimestamp(contract)}`,
    `Evidence items: ${evidenceItems.length}`,
    "",
    "EVIDENCE",
    ...renderEvidenceChecklist(contract.id, evidenceItems),
    "",
    "DECISIONS",
    `✅ Accept responsibility:  kair accept ${contract.id} --actor <name>`,
    `🛂 Approve grant:          kair grant ${contract.id} <namespace>:<permission>`,
    `⏪ Rewind approval:        kair contract rewind ${contract.id} --actor <name> "<reason>"`,
    `🔍 Inspect evidence:       kair emit ${contract.id}`,
  ];
  return lines.join("\n");
}

export function renderEvidence(contract: any, evidenceItems: EvidenceItem[]) {
  const lines = [
    `EVIDENCE CHECKLIST | ${contract.id}`,
    ...renderEvidenceChecklist(contract.id, evidenceItems),
  ];
  return lines.join("\n");
}
