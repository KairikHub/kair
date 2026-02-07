import * as fs from "node:fs";
import * as path from "node:path";

import { seedMockEvidence } from "../../src/core/contracts/seed_evidence";
import { makeTempRoot } from "../helpers/tmp";

describe("integration: evidence seeding", () => {
  test("creates evidence files + index and is idempotent", () => {
    const tmp = makeTempRoot();
    const previousArtifactsDir = process.env.KAIRIK_ARTIFACTS_DIR;
    process.env.KAIRIK_ARTIFACTS_DIR = tmp.artifactsDir;

    try {
      const contract = {
        id: "contract_evidence_seed",
        intent: "Seed believable mock evidence for demo runs",
        plan: "Write evidence files and index them once",
      };

      seedMockEvidence(contract);

      const evidenceDir = path.join(tmp.artifactsDir, contract.id, "evidence");
      const indexPath = path.join(evidenceDir, "index.json");

      expect(fs.existsSync(evidenceDir)).toBe(true);
      expect(fs.existsSync(indexPath)).toBe(true);

      const first = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      expect(Array.isArray(first)).toBe(true);
      expect(first.length).toBe(5);

      for (const item of first) {
        expect(item.source).toBe("mock");
        expect(typeof item.path).toBe("string");
        expect(item.path.length).toBeGreaterThan(0);
        expect(fs.existsSync(path.join(evidenceDir, item.path))).toBe(true);
      }

      seedMockEvidence(contract);
      const second = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      expect(second.length).toBe(5);
    } finally {
      if (previousArtifactsDir === undefined) {
        delete process.env.KAIRIK_ARTIFACTS_DIR;
      } else {
        process.env.KAIRIK_ARTIFACTS_DIR = previousArtifactsDir;
      }
      tmp.cleanup();
    }
  });
});
