import * as fs from "node:fs";
import * as path from "node:path";

import { getArtifactsDir } from "../store/paths";
import { DpcV1 } from "./schema";
import { parseAndValidateDpcJson } from "./validate";

const DPC_FILENAME = "dpc_v1.json";

export function getDpcDir(contractId: string) {
  return path.join(getArtifactsDir(), contractId, "dpc");
}

export function getDpcPath(contractId: string) {
  return path.join(getDpcDir(contractId), DPC_FILENAME);
}

export function loadDpcV1(contractId: string): DpcV1 | null {
  const dpcPath = getDpcPath(contractId);
  try {
    const raw = fs.readFileSync(dpcPath, "utf8");
    return parseAndValidateDpcJson(raw);
  } catch (error: any) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new Error(`DPC file at "${dpcPath}" is invalid JSON: ${error.message}`);
    }
    if (error instanceof Error && error.message.startsWith("Invalid JSON:")) {
      const reason = error.message.replace(/^Invalid JSON:\s*/, "");
      throw new Error(`DPC file at "${dpcPath}" is invalid JSON: ${reason}`);
    }
    throw error;
  }
}

export function saveDpcV1(contractId: string, dpc: DpcV1) {
  const dpcDir = getDpcDir(contractId);
  const dpcPath = getDpcPath(contractId);
  const normalized = parseAndValidateDpcJson(JSON.stringify(dpc));
  const payload = JSON.stringify(normalized, null, 2);
  const tmpPath = path.join(
    dpcDir,
    `${DPC_FILENAME}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  fs.mkdirSync(dpcDir, { recursive: true });
  fs.writeFileSync(tmpPath, payload);

  try {
    fs.renameSync(tmpPath, dpcPath);
  } catch (error) {
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch {
      // Ignore cleanup failures; original rename error is more actionable.
    }
    throw error;
  }
}
