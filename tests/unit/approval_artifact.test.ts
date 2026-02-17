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
    const plan = { version: "kair.plan.v1", title: "T", steps: [{ id: "a", summary: "A" }] };
    const contractId = "approval_contract";
    try {
      const written = writeApprovalArtifact({
        contractId,
        plan,
        approvedBy: "tester",
        source: "manual",
        cwd,
      });
      expect(fs.existsSync(written.filePath)).toBe(true);

      const validated = validateApprovalArtifact({ contractId, plan, cwd });
      expect(validated.expectedPlanHash).toBe(written.planHash);
      expect(validated.expectedPath).toBe(getApprovalArtifactPathByHash(written.planHash, cwd));
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
