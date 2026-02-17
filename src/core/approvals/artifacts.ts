import * as fs from "node:fs";
import * as path from "node:path";

import { getDataFile } from "../store/paths";
import { computePlanHash } from "./hash";
import { APPROVAL_VERSION, ApprovalArtifact } from "./schema";

export function getApprovalsDir(cwd = process.cwd()) {
  return path.join(cwd, ".kair", "approvals");
}

export function getApprovalArtifactPathByHash(planHash: string, cwd = process.cwd()) {
  const name = String(planHash || "").trim();
  return path.join(getApprovalsDir(cwd), `${name}.json`);
}

export function getPlanRef(contractId: string) {
  return `${getDataFile()}#/contracts[id=${contractId}]/plan_v1`;
}

function parseArtifact(raw: string, filePath: string): ApprovalArtifact {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (error: any) {
    throw new Error(`Approval artifact at "${filePath}" is invalid JSON: ${error.message}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Approval artifact at "${filePath}" must be a JSON object.`);
  }
  const requiredFields = [
    "version",
    "contract_id",
    "plan_hash",
    "plan_ref",
    "approved_by",
    "approved_at",
    "source",
  ];
  for (const field of requiredFields) {
    if (typeof parsed[field] !== "string" || !String(parsed[field]).trim()) {
      throw new Error(`Approval artifact missing required field: ${field}.`);
    }
  }
  if (parsed.version !== APPROVAL_VERSION) {
    throw new Error(
      `Approval artifact version must be ${APPROVAL_VERSION}; found ${String(parsed.version)}.`
    );
  }
  if (parsed.source !== "manual" && parsed.source !== "ci") {
    throw new Error(`Approval artifact source must be "manual" or "ci".`);
  }
  return parsed as ApprovalArtifact;
}

export function writeApprovalArtifact(params: {
  contractId: string;
  plan: unknown;
  approvedBy: string;
  source: "manual" | "ci";
  notes?: string;
  cwd?: string;
}) {
  const planHash = computePlanHash(params.plan);
  const artifact: ApprovalArtifact = {
    version: APPROVAL_VERSION,
    contract_id: params.contractId,
    plan_hash: planHash,
    plan_ref: getPlanRef(params.contractId),
    approved_by: params.approvedBy,
    approved_at: new Date().toISOString(),
    source: params.source,
    ...(params.notes ? { notes: params.notes } : {}),
  };
  const filePath = getApprovalArtifactPathByHash(planHash, params.cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2));
  return { planHash, filePath, artifact };
}

export function validateApprovalArtifact(params: {
  contractId: string;
  plan: unknown;
  cwd?: string;
}) {
  const expectedPlanHash = computePlanHash(params.plan);
  const expectedPath = getApprovalArtifactPathByHash(expectedPlanHash, params.cwd);
  if (!fs.existsSync(expectedPath)) {
    throw new Error(
      [
        `Missing approval artifact for current plan hash: ${expectedPlanHash}.`,
        `Expected file: ${expectedPath}`,
        `Create one at ${expectedPath} using schema version ${APPROVAL_VERSION}.`,
      ].join(" ")
    );
  }
  const parsed = parseArtifact(fs.readFileSync(expectedPath, "utf8"), expectedPath);
  if (parsed.contract_id !== params.contractId) {
    throw new Error(
      `Approval artifact contract mismatch: expected ${params.contractId}, found ${parsed.contract_id}.`
    );
  }
  if (parsed.plan_hash !== expectedPlanHash) {
    throw new Error(
      `Approval artifact hash mismatch: expected ${expectedPlanHash}, found ${parsed.plan_hash}.`
    );
  }
  const expectedRef = getPlanRef(params.contractId);
  if (parsed.plan_ref !== expectedRef) {
    throw new Error(
      `Approval artifact plan_ref mismatch: expected "${expectedRef}", found "${parsed.plan_ref}".`
    );
  }
  return { expectedPlanHash, expectedPath, artifact: parsed };
}
