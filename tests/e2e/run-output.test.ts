import * as path from "node:path";
import * as fs from "node:fs";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: run output", () => {
  test("run --debug prints runner details and artifact paths", () => {
    const tmp = makeTempRoot();
    const contractId = "run_debug";
    const planJson = JSON.stringify({
      version: "kair.plan.v1",
      title: "Run debug output",
      steps: [
        {
          id: "write-evidence",
          summary: "Write evidence",
          details: "Create output under artifacts.",
        },
      ],
    });
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
      KAIR_OPENAI_API_KEY: "",
    };

    try {
      const setup = [
        ["contract", "--id", contractId, "Run debug output"],
        ["plan", contractId, "--interactive=false", planJson],
        ["propose", contractId],
        ["approve", contractId, "--actor", "e2e-actor"],
      ] as string[][];
      for (const args of setup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const run = runCli(["run", contractId, "--debug"], env);
      expect(run.status).not.toBe(0);
      expect(run.stdout).toContain("Delegating execution to OpenClaw runner...");
      expect(run.stdout).toContain("RUN DEBUG");
      expect(run.stdout).toContain("Run request artifact:");
      expect(run.stdout).toContain("Run result artifact:");
      expect(run.stdout).toContain("Claimed evidence paths: none");
      expect(run.stdout).toContain("Missing evidence paths: none");
      expect(run.stderr).toContain("Missing KAIR_OPENAI_API_KEY");
      expect(fs.existsSync(path.join(tmp.artifactsDir, contractId, "run", "run-request.json"))).toBe(
        true
      );
      expect(fs.existsSync(path.join(tmp.artifactsDir, contractId, "run", "run-result.json"))).toBe(
        true
      );
    } finally {
      tmp.cleanup();
    }
  });

  test("run --json outputs machine-readable JSON only", () => {
    const tmp = makeTempRoot();
    const contractId = "run_json";
    const planJson = JSON.stringify({
      version: "kair.plan.v1",
      title: "Run json output",
      steps: [
        {
          id: "write-evidence",
          summary: "Write evidence",
          details: "Create output under artifacts.",
        },
      ],
    });
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
      KAIR_OPENAI_API_KEY: "",
    };

    try {
      const setup = [
        ["contract", "--id", contractId, "Run json output"],
        ["plan", contractId, "--interactive=false", planJson],
        ["propose", contractId],
        ["approve", contractId, "--actor", "e2e-actor"],
      ] as string[][];
      for (const args of setup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const run = runCli(["run", contractId, "--json", "--debug"], env);
      expect(run.status).not.toBe(0);
      expect(run.stdout).not.toContain("Delegating execution");
      expect(run.stdout).not.toContain("RUN DEBUG");
      const parsed = JSON.parse(run.stdout);
      expect(parsed.contract_id).toBe(contractId);
      expect(parsed.status).toBe("failed");
      expect(typeof parsed.summary).toBe("string");
      expect(typeof parsed.request_path).toBe("string");
      expect(typeof parsed.result_path).toBe("string");
      expect(parsed).toHaveProperty("failure_reason");
      expect(Array.isArray(parsed.missing_evidence_paths)).toBe(true);
      expect(Array.isArray(parsed.claimed_evidence_paths)).toBe(true);
      expect(run.stderr).toContain("Missing KAIR_OPENAI_API_KEY");
    } finally {
      tmp.cleanup();
    }
  });

  test("run pause checkpoint flags are rejected", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["run", "--pause-at", "checkpoint_1"], env);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(
        "Run checkpoint pause options are not supported with the OpenClaw runner."
      );
    } finally {
      tmp.cleanup();
    }
  });
});
