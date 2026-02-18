import * as fs from "node:fs";
import * as path from "node:path";

import { EvidenceItem } from "../core/contracts/evidence";
import { COLORS, formatState, heading, label, style, title } from "./format";

const DIVIDER_WIDTH = 72;

function divider() {
  return style("-".repeat(DIVIDER_WIDTH), COLORS.gray);
}

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
  const runArtifacts = artifacts.filter(
    (entry: any) => entry && (entry.type === "run_result" || entry.type === "run")
  );
  if (!runArtifacts.length) {
    return "n/a";
  }
  const lastRun = runArtifacts[runArtifacts.length - 1];
  const contentPath = String(lastRun.content || "");
  if (contentPath && fs.existsSync(contentPath)) {
    try {
      return fs.statSync(contentPath).mtime.toISOString();
    } catch {
      // fall through to filename parsing
    }
  }
  const base = path.basename(contentPath);
  const match = base.match(/^(.+)-run\.json$/);
  if (!match) {
    return base || "n/a";
  }
  const compact = match[1];
  const normalized = compact.match(/^(.*T\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  if (!normalized) {
    return compact;
  }
  return `${normalized[1]}:${normalized[2]}:${normalized[3]}.${normalized[4]}Z`;
}

function renderEvidenceChecklist(contract: any, evidenceItems: EvidenceItem[]) {
  if (evidenceItems.length === 0) {
    const runPointers = (Array.isArray(contract?.artifacts) ? contract.artifacts : [])
      .filter(
        (entry: any) =>
          entry &&
          typeof entry.type === "string" &&
          ["run_request", "run_result", "run_log", "run_evidence"].includes(entry.type)
      )
      .map((entry: any) => `${style("[ ]", COLORS.green)} ${entry.type} - ${style(String(entry.content || ""), COLORS.gray)}`);
    if (runPointers.length > 0) {
      return runPointers;
    }
    return [`${style("[ ]", COLORS.gray)} Evidence: none recorded.`];
  }
  return evidenceItems.map(
    (item) =>
      `${style("[ ]", COLORS.green)} ${item.type} - ${item.label} (${style(
        `.kair/contracts/${contract.id}/artifacts/evidence/${item.path}`,
        COLORS.gray
      )})`
  );
}

export function renderReview(contract: any, evidenceItems: EvidenceItem[]) {
  const active = contract?.activeVersion ? `v${contract.activeVersion}` : "n/a";
  const artifacts = Array.isArray(contract?.artifacts) ? contract.artifacts.length : 0;
  const lines = [
    title("KAIR REVIEW"),
    divider(),
    `${label("Contract:")} ${contract.id}   ${label("State:")} ${formatState(
      String(contract.current_state || "n/a")
    )}   ${label("Active:")} ${active}`,
    "",
    heading("APPROVED INTENT"),
    resolveApprovedIntent(contract),
    "",
    heading("CONSTRAINTS"),
    `${label("Required controls:")} ${formatControls(contract.controlsRequired)}`,
    `${label("Approved controls:")} ${formatControls(contract.controlsApproved)}`,
    `${label("Budget:")} ${resolveBudget(contract)}`,
    "",
    heading("EXECUTION SUMMARY"),
    `${label("Artifacts:")} ${artifacts}`,
    `${label("Last run artifact:")} ${extractLastRunTimestamp(contract)}`,
    `${label("Evidence items:")} ${evidenceItems.length}`,
    "",
    heading("EVIDENCE"),
    ...renderEvidenceChecklist(contract, evidenceItems),
    "",
    heading("DECISIONS"),
    `${label("Accept responsibility:")} kair accept ${contract.id} --actor <name>`,
    `${label("Approve grant:")}         kair grant ${contract.id} <namespace>:<permission>`,
    `${label("Rewind approval:")}       kair rewind ${contract.id} --actor <name> "<reason>"`,
    `${label("Inspect evidence:")}      kair emit ${contract.id}`,
    divider(),
  ];
  return lines.join("\n");
}

export function renderEvidence(contract: any, evidenceItems: EvidenceItem[]) {
  const lines = [
    title(`EVIDENCE CHECKLIST | ${contract.id}`),
    divider(),
    ...renderEvidenceChecklist(contract, evidenceItems),
  ];
  return lines.join("\n");
}
