import * as fs from "node:fs";
import * as path from "node:path";

import { getArchitectDecisionsLogPath, getArchitectTurnsLogPath } from "./paths";
import type { ArchitectDecisionLog, ArchitectTurnLog } from "./types";

function appendJsonl(filePath: string, payload: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`);
  return filePath;
}

export function appendArchitectTurn(entry: ArchitectTurnLog) {
  return appendJsonl(getArchitectTurnsLogPath(entry.contract_id), entry as unknown as Record<string, unknown>);
}

export function appendArchitectDecision(entry: ArchitectDecisionLog) {
  return appendJsonl(getArchitectDecisionsLogPath(entry.contract_id), entry as unknown as Record<string, unknown>);
}
