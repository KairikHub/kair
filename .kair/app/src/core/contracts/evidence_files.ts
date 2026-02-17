import * as fs from "node:fs";
import * as path from "node:path";

import { getEvidenceDir } from "./evidence";

export function writeEvidenceFile(contractId: string, filename: string, content: string) {
  const evidenceDir = getEvidenceDir(contractId);
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, filename), content);
  return filename;
}
