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

describe("e2e: run force", () => {
  test("run --force allows rerun from FAILED and records history", () => {
    const tmp = makeTempRoot();
    const contractId = "run_force";
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

    const openclawStubPath = path.join(tmp.root, "openclaw-stub.sh");
    fs.writeFileSync(
      openclawStubPath,
      "#!/usr/bin/env sh\nprintf '%s' '{\"payloads\":[{\"text\":\"forced rerun completed\"}],\"meta\":{}}'\n",
      { mode: 0o755 }
    );

    const envBase = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const setup = [
        ["contract", "--id", contractId, "Run force contract"],
        ["plan", contractId, "--interactive=false", planJson],
        ["propose", contractId],
        ["approve", contractId, "--actor", "e2e-actor"],
      ] as string[][];
      for (const args of setup) {
        const result = runCli(args, envBase);
        expect(result.status).toBe(0);
      }

      const firstRun = runCli(["run", contractId], {
        ...envBase,
        KAIR_OPENAI_API_KEY: "",
      });
      expect(firstRun.status).not.toBe(0);
      expect(firstRun.stderr).toContain("Missing KAIR_OPENAI_API_KEY");

      const secondRun = runCli(["run", contractId], {
        ...envBase,
        KAIR_OPENAI_API_KEY: "test-openai-key",
        KAIR_OPENCLAW_BIN: openclawStubPath,
      });
      expect(secondRun.status).not.toBe(0);
      expect(secondRun.stderr).toContain("state is FAILED");

      const forcedRun = runCli(["run", contractId, "--force"], {
        ...envBase,
        KAIR_OPENAI_API_KEY: "test-openai-key",
        KAIR_OPENCLAW_BIN: openclawStubPath,
      });
      expect(forcedRun.status).toBe(0);
      expect(forcedRun.stdout).toContain("Run status: completed");
      expect(forcedRun.stdout).toContain("forced rerun completed");

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract.current_state).toBe("COMPLETED");
      expect(
        after.contract.history.some((entry: any) =>
          String(entry.message).includes("Force run override requested; allowing rerun from FAILED.")
        )
      ).toBe(true);

      const runDir = path.join(tmp.artifactsDir, contractId, "run");
      expect(fs.existsSync(path.join(runDir, "openclaw-config.json"))).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });
});
