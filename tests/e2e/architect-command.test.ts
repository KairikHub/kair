import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

describe("e2e: architect command", () => {
  test("architect init-agents scaffolds SOUL definitions", () => {
    const tmp = makeTempRoot();
    const contractId = "architect_init_agents";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
      KAIR_LLM_PROVIDER: "mock",
    };

    try {
      expect(runCli(["contract", "--id", contractId, "Architect init agents"], env).status).toBe(0);
      const init = runCli(["architect", "init-agents", "--contract", contractId, "--provider", "mock"], env);
      expect(init.status).toBe(0);
      expect(fs.existsSync(path.join(tmp.dataDir, contractId, "agents", "architect", "SOUL.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmp.dataDir, contractId, "agents", "critic", "SOUL.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmp.dataDir, contractId, "agents", "integrator", "SOUL.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmp.dataDir, contractId, "agents", "validator", "SOUL.md"))).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });

  test("architect run with mock provider persists plan, session, and validation", () => {
    const tmp = makeTempRoot();
    const contractId = "architect_run_mock";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
      KAIR_LLM_PROVIDER: "mock",
    };

    try {
      expect(runCli(["contract", "--id", contractId, "Architect run mock"], env).status).toBe(0);
      expect(runCli(["architect", "init-agents", "--contract", contractId, "--provider", "mock"], env).status).toBe(0);

      const run = runCli([
        "architect",
        "--contract",
        contractId,
        "--provider",
        "mock",
        "--instructions",
        "Generate milestone-oriented implementation plan with validation checks.",
      ], env);
      expect(run.status).toBe(0);
      expect(run.stdout).toContain("Architect status for Contract");
      expect(run.stdout).toContain("completed");

      const planPath = path.join(tmp.dataDir, contractId, "plan", "plan_v1.json");
      expect(fs.existsSync(planPath)).toBe(true);
      const plan = readJson(planPath);
      expect(plan.version).toBe("kair.plan.v1");
      expect(Array.isArray(plan.steps)).toBe(true);
      expect(plan.steps.length).toBeGreaterThan(0);

      const sessionPath = path.join(tmp.artifactsDir, contractId, "architect", "session.json");
      const validationPath = path.join(tmp.artifactsDir, contractId, "architect", "validation.json");
      expect(fs.existsSync(sessionPath)).toBe(true);
      expect(fs.existsSync(validationPath)).toBe(true);

      const session = readJson(sessionPath);
      const validation = readJson(validationPath);
      expect(session.status).toBe("completed");
      expect(validation.final_pass).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });

  test("architect status and validate commands return expected outputs", () => {
    const tmp = makeTempRoot();
    const contractId = "architect_status_validate";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
      KAIR_LLM_PROVIDER: "mock",
    };

    try {
      expect(runCli(["contract", "--id", contractId, "Architect status validate"], env).status).toBe(0);
      expect(runCli(["architect", "init-agents", "--contract", contractId, "--provider", "mock"], env).status).toBe(0);
      expect(runCli(["architect", "--contract", contractId, "--provider", "mock"], env).status).toBe(0);

      const status = runCli(["architect", "status", "--contract", contractId], env);
      expect(status.status).toBe(0);
      expect(status.stdout).toContain("Architect session for Contract");

      const validate = runCli(["architect", "validate", "--contract", contractId, "--json"], env);
      expect(validate.status).toBe(0);
      const payload = JSON.parse(validate.stdout);
      expect(payload.plan_schema_valid).toBe(true);
      expect(payload.final_pass).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });
});
