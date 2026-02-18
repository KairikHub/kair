import * as path from "node:path";

type OverrideName =
  | "KAIR_DATA_DIR"
  | "KAIRIK_DATA_DIR"
  | "KAIR_ARTIFACTS_DIR"
  | "KAIRIK_ARTIFACTS_DIR";

function readOverride(names: OverrideName[]) {
  for (const name of names) {
    const value = (process.env[name] || "").trim();
    if (!value) {
      continue;
    }
    return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
  }
  return null;
}

export function getContractsRoot() {
  return readOverride(["KAIR_DATA_DIR", "KAIRIK_DATA_DIR"]) || path.join(process.cwd(), ".kair", "contracts");
}

export function getContractDir(contractId: string) {
  return path.join(getContractsRoot(), contractId);
}

export function getContractsIndexPath() {
  return path.join(getContractsRoot(), "index.json");
}

export function getContractSnapshotPath(contractId: string) {
  return path.join(getContractDir(contractId), "contract.json");
}

export function getContractHistoryPath(contractId: string) {
  return path.join(getContractDir(contractId), "history.jsonl");
}

export function getContractPlanDir(contractId: string) {
  return path.join(getContractDir(contractId), "plan");
}

export function getContractPlanJsonPath(contractId: string) {
  return path.join(getContractPlanDir(contractId), "plan_v1.json");
}

export function getContractPlanMarkdownPath(contractId: string) {
  return path.join(getContractPlanDir(contractId), "PLAN.md");
}

export function getContractRulesPath(contractId: string) {
  return path.join(getContractPlanDir(contractId), "RULES.md");
}

export function getContractApprovalsDir(contractId: string) {
  return path.join(getContractDir(contractId), "approvals");
}

export function getContractArtifactsDir(contractId: string) {
  const overrideArtifactsRoot = readOverride(["KAIR_ARTIFACTS_DIR", "KAIRIK_ARTIFACTS_DIR"]);
  if (overrideArtifactsRoot) {
    return path.join(overrideArtifactsRoot, contractId);
  }
  return path.join(getContractDir(contractId), "artifacts");
}

// Compatibility helpers retained during refactor/tests.
export function getDataDir() {
  return getContractsRoot();
}

export function getDataFile() {
  return getContractsIndexPath();
}

export function getArtifactsDir() {
  return readOverride(["KAIR_ARTIFACTS_DIR", "KAIRIK_ARTIFACTS_DIR"]) || getContractsRoot();
}
