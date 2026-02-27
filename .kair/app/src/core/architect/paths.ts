import * as path from "node:path";

import { getContractArtifactsDir, getContractDir } from "../store/paths";

export function getArchitectAgentsDir(contractId: string) {
  return path.join(getContractDir(contractId), "agents");
}

export function getAgentSoulPath(contractId: string, agentName: string) {
  return path.join(getArchitectAgentsDir(contractId), agentName, "SOUL.md");
}

export function getArchitectArtifactsDir(contractId: string) {
  return path.join(getContractArtifactsDir(contractId), "architect");
}

export function getArchitectSessionPath(contractId: string) {
  return path.join(getArchitectArtifactsDir(contractId), "session.json");
}

export function getArchitectTurnsLogPath(contractId: string) {
  return path.join(getArchitectArtifactsDir(contractId), "turns.jsonl");
}

export function getArchitectDecisionsLogPath(contractId: string) {
  return path.join(getArchitectArtifactsDir(contractId), "decisions.jsonl");
}

export function getArchitectHumanInputPath(contractId: string) {
  return path.join(getArchitectArtifactsDir(contractId), "human-input.json");
}

export function getArchitectValidationPath(contractId: string) {
  return path.join(getArchitectArtifactsDir(contractId), "validation.json");
}
