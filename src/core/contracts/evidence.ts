import * as fs from "node:fs";
import * as path from "node:path";

import { getArtifactsDir } from "../store/paths";
import { now } from "../time";

export type EvidenceType =
  | "pull_request"
  | "diff"
  | "log"
  | "prompt"
  | "test_output"
  | "summary";

export type EvidenceSource = "codex" | "openclaw" | "human" | "mock";

export type EvidenceItem = {
  type: EvidenceType;
  label: string;
  path: string;
  source: EvidenceSource;
  created_at: string;
};

export function getEvidenceDir(contractId: string) {
  return path.join(getArtifactsDir(), contractId, "evidence");
}

export function getEvidenceIndexPath(contractId: string) {
  return path.join(getEvidenceDir(contractId), "index.json");
}

export function loadEvidenceIndex(contractId: string): EvidenceItem[] {
  const indexPath = getEvidenceIndexPath(contractId);
  try {
    const raw = fs.readFileSync(indexPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`Evidence index at "${indexPath}" must be a JSON array.`);
    }
    return parsed;
  } catch (error: any) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Evidence index at "${indexPath}" is invalid JSON: ${error.message}`);
    }
    throw error;
  }
}

export function saveEvidenceIndex(contractId: string, items: EvidenceItem[]) {
  const evidenceDir = getEvidenceDir(contractId);
  const indexPath = getEvidenceIndexPath(contractId);
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(items, null, 2));
}

export function appendEvidence(
  contractId: string,
  item: Omit<EvidenceItem, "created_at"> & { created_at?: string }
) {
  const items = loadEvidenceIndex(contractId);
  const next: EvidenceItem = {
    ...item,
    created_at: item.created_at || now(),
  };
  items.push(next);
  saveEvidenceIndex(contractId, items);
  return items;
}
