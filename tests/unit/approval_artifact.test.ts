import * as fs from "node:fs";
import * as path from "node:path";

import {
  computePlanHash,
  getApprovalArtifactPathByHash,
  validateApprovalArtifact,
  writeApprovalArtifact,
} from "../../src/core/approvals";

describe("approval artifacts", () => {
  test("computePlanHash is stable across key order", () => {
    const a = { version: "kair.plan.v1", title: "T", steps: [{ id: "a", summary: "A" }] };
    const b = { title: "T", steps: [{ summary: "A", id: "a" }], version: "kair.plan.v1" };
    expect(computePlanHash(a)).toBe(computePlanHash(b));
  });

  test("write + validate approval artifact", () => {
    const cwd = fs.mkdtempSync(path.join(process.cwd(), "tmp-approval-"));
    const previousDataDir = process.env.KAIR_DATA_DIR;
    process.env.KAIR_DATA_DIR = cwd;
    const plan = { version: "kair.plan.v1", title: "T", steps: [{ id: "a", summary: "A" }] };
    const contractId = "approval_contract";
    try {
      const written = writeApprovalArtifact({
        contractId,
        plan,
        approvedBy: "tester",
        source: "manual",
      });
      expect(fs.existsSync(written.filePath)).toBe(true);

      const validated = validateApprovalArtifact({ contractId, plan });
      expect(validated.expectedPlanHash).toBe(written.planHash);
      expect(validated.expectedPath).toBe(getApprovalArtifactPathByHash(contractId, written.planHash));
    } finally {
      if (previousDataDir === undefined) {
        delete process.env.KAIR_DATA_DIR;
      } else {
        process.env.KAIR_DATA_DIR = previousDataDir;
      }
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
