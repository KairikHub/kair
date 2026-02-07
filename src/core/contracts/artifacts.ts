import * as fs from "node:fs";
import * as path from "node:path";

import { now } from "../time";

export function writeArtifact(contract: any, proposalSummary: any) {
  const dir = path.join("artifacts", contract.id);
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

