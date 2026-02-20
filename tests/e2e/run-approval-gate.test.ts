import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: run approval gate", () => {
  test("run blocks when approval artifact is missing", () => {
    const tmp = makeTempRoot();
    const contractId = "run_approval_gate";
    const planJson = JSON.stringify({
      version: "kair.plan.v1",
      title: "Approval gate",
      steps: [{ id: "step-1", summary: "Gate run" }],
    });

    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
      KAIR_ENFORCE_APPROVAL_GATE: "1",
    };

    try {
      expect(runCli(["contract", "--id", contractId, "Approval gate"], env).status).toBe(0);
      expect(runCli(["plan", contractId, "--interactive=false", planJson], env).status).toBe(0);
      const rulesPath = path.join(tmp.dataDir, contractId, "plan", "RULES.md");
      fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
      fs.writeFileSync(rulesPath, "# RULES\n\n");

      const run = runCli(["run", contractId], env);
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain("Missing approval artifact for current plan hash");
    } finally {
      tmp.cleanup();
    }
  });

  test("approve writes approval artifact so run can proceed", () => {
    const tmp = makeTempRoot();
    const contractId = "run_approval_written";
    const planJson = JSON.stringify({
      version: "kair.plan.v1",
      title: "Approval written",
      steps: [{ id: "step-1", summary: "Gate run" }],
    });

    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
      KAIR_ENFORCE_APPROVAL_GATE: "1",
    };

    try {
      expect(runCli(["contract", "--id", contractId, "Approval gate"], env).status).toBe(0);
      expect(runCli(["plan", contractId, "--interactive=false", planJson], env).status).toBe(0);
      const rulesPath = path.join(tmp.dataDir, contractId, "plan", "RULES.md");
      fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
      fs.writeFileSync(rulesPath, "# RULES\n\n");

      expect(runCli(["propose", contractId], env).status).toBe(0);
      expect(runCli(["approve", contractId, "--actor", "e2e-actor"], env).status).toBe(0);

      const approvalsDir = path.join(tmp.dataDir, contractId, "approvals");
      expect(fs.existsSync(approvalsDir)).toBe(true);
      const files = fs.readdirSync(approvalsDir).filter((entry) => entry.endsWith(".json"));
      expect(files.length).toBeGreaterThan(0);

      const run = runCli(["run", contractId], env);
      expect(run.status).toBe(0);
    } finally {
      tmp.cleanup();
    }
  });
});
