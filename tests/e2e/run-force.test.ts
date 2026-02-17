import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

function readContractFromStore(dataDir: string, contractId: string) {
  const storePath = path.join(dataDir, "contracts.json");
  const raw = fs.readFileSync(storePath, "utf8");
  const parsed = JSON.parse(raw);
  const contract = (parsed.contracts || []).find((item: any) => item.id === contractId);
  return { contract, parsed };
}

function prepareApprovedContract(params: {
  contractId: string;
  dataDir: string;
  artifactsDir: string;
  actor: string;
}) {
  const planJson = JSON.stringify({
    version: "kair.plan.v1",
    title: "Run force flow",
    steps: [
      {
        id: "step-1",
        summary: "Execute once",
      },
    ],
  });
  const env = {
    KAIR_DATA_DIR: params.dataDir,
    KAIR_ARTIFACTS_DIR: params.artifactsDir,
    KAIR_ACTOR: params.actor,
    KAIR_TEST_MODE: "1",
  };
  const setup = [
    ["contract", "--id", params.contractId, "Run force contract"],
    ["plan", params.contractId, "--interactive=false", planJson],
    ["propose", params.contractId],
    ["approve", params.contractId, "--actor", params.actor],
  ] as string[][];
  for (const args of setup) {
    const result = runCli(args, env);
    expect(result.status).toBe(0);
  }
  return env;
}

describe("e2e: run force", () => {
  test("run --force allows rerun from FAILED and records history", () => {
    const tmp = makeTempRoot();
    const contractId = "run_force";

    try {
      const envBase = prepareApprovedContract({
        contractId,
        dataDir: tmp.dataDir,
        artifactsDir: tmp.artifactsDir,
        actor: "e2e-actor",
      });
      const firstRun = runCli(["run", contractId], {
        ...envBase,
        KAIR_OPENAI_API_KEY: "",
      });
      expect(firstRun.status).not.toBe(0);
      expect(firstRun.stderr).toContain("Missing KAIR_OPENAI_API_KEY");

      const secondRun = runCli(["run", contractId], {
        ...envBase,
        KAIR_OPENAI_API_KEY: "test-openai-key",
      });
      expect(secondRun.status).not.toBe(0);
      expect(secondRun.stderr).toContain("is FAILED. Use --force to rerun.");

      const forcedRun = runCli(["run", contractId, "--force"], {
        ...envBase,
        KAIR_OPENAI_API_KEY: "test-openai-key",
      });
      expect(forcedRun.status).toBe(0);
      expect(forcedRun.stdout).toContain("Run status: completed");
      expect(forcedRun.stdout).toContain("Execution completed via native Kair runner.");

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract.current_state).toBe("COMPLETED");
      expect(
        after.contract.history.some((entry: any) =>
          String(entry.message).includes("Force run override requested; allowing rerun from FAILED.")
        )
      ).toBe(true);

      const runDir = path.join(tmp.artifactsDir, contractId, "run");
      expect(fs.existsSync(path.join(runDir, "native-summary.md"))).toBe(true);
      expect(fs.existsSync(path.join(runDir, "native-run.log"))).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });
});
