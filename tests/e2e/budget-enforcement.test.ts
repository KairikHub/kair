import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

function updateContractBudget(dataDir: string, contractId: string, budget: any) {
  const contractPath = path.join(dataDir, contractId, "contract.json");
  const raw = fs.readFileSync(contractPath, "utf8");
  const parsed = JSON.parse(raw);
  parsed.budget = budget;
  fs.writeFileSync(contractPath, JSON.stringify(parsed, null, 2));
}

function readContract(dataDir: string, contractId: string) {
  const contractPath = path.join(dataDir, contractId, "contract.json");
  return JSON.parse(fs.readFileSync(contractPath, "utf8"));
}

describe("e2e: deterministic budget enforcement", () => {
  test("plan allows crossing call then blocks subsequent provider calls", () => {
    const tmp = makeTempRoot();
    const contractId = "budget_plan_enforce";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
      KAIR_LLM_PROVIDER: "mock",
    };

    try {
      expect(runCli(["contract", "--id", contractId, "Budget enforce plan"], env).status).toBe(0);
      updateContractBudget(tmp.dataDir, contractId, {
        max_tokens: 1,
        total_max_cost_usd: 100,
      });

      const first = runCli(
        [
          "plan",
          contractId,
          "--interactive=false",
          "--provider",
          "mock",
          "--instructions",
          "first budgeted call",
        ],
        env
      );
      expect(first.status).toBe(0);

      const afterFirst = readContract(tmp.dataDir, contractId);
      expect(afterFirst.budget.status).toBe("exhausted");
      expect(afterFirst.budget.usage.total_tokens).toBeGreaterThan(1);

      const second = runCli(
        [
          "plan",
          contractId,
          "--interactive=false",
          "--provider",
          "mock",
          "--instructions",
          "second budgeted call should fail",
        ],
        env
      );
      expect(second.status).not.toBe(0);
      expect(second.stderr).toContain("budget exhausted");
    } finally {
      tmp.cleanup();
    }
  });

  test("architect loop stops after crossing call and reports exhausted budget", () => {
    const tmp = makeTempRoot();
    const contractId = "budget_architect_enforce";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
      KAIR_LLM_PROVIDER: "mock",
    };

    try {
      expect(runCli(["contract", "--id", contractId, "Budget enforce architect"], env).status).toBe(0);
      expect(runCli(["architect", "init-agents", "--contract", contractId, "--provider", "mock"], env).status).toBe(0);
      updateContractBudget(tmp.dataDir, contractId, {
        max_tokens: 1,
        total_max_cost_usd: 100,
      });

      const run = runCli(
        [
          "architect",
          "--contract",
          contractId,
          "--provider",
          "mock",
          "--instructions",
          "drive architect until budget gate blocks",
        ],
        env
      );
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain("budget exhausted");

      const after = readContract(tmp.dataDir, contractId);
      expect(after.budget.status).toBe("exhausted");
      expect(after.budget.usage.total_tokens).toBeGreaterThan(1);

      const architectStatus = runCli(["architect", "status", "--contract", contractId, "--json"], env);
      expect(architectStatus.status).toBe(0);
      const architectPayload = JSON.parse(architectStatus.stdout);
      expect(architectPayload.session.budget_usage.total_tokens).toBeGreaterThan(1);
      expect(architectPayload.session.budget_status).toBe("exhausted");

      const status = runCli(["status", contractId], env);
      expect(status.status).toBe(0);
      expect(status.stdout).toContain("Budget");
      expect(status.stdout).toContain("tokens=");
    } finally {
      tmp.cleanup();
    }
  });
});
