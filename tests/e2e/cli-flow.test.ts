import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

function readContractFromStore(dataDir: string, contractId: string) {
  const storePath = path.join(dataDir, "contracts.json");
  const raw = fs.readFileSync(storePath, "utf8");
  const parsed = JSON.parse(raw);
  const contract = (parsed.contracts || []).find((item: any) => item.id === contractId);
  return { storePath, contract, parsed };
}

describe("e2e: cli contract flow", () => {
  test("create -> plan -> request approval -> approve -> run -> status -> rewind -> status", () => {
    const tmp = makeTempRoot();
    const contractId = "e2e_contract";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const steps = [
        ["contract", "create", "--id", contractId, "E2E Contract"],
        ["contract", "plan", contractId, "Execute test flow"],
        ["contract", "request-approval", contractId],
        ["contract", "approve", contractId, "--actor", "e2e-actor"],
        ["contract", "run", contractId],
      ] as string[][];

      for (const args of steps) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const statusBeforeRewind = runCli(["contract", "status", contractId], env);
      expect(statusBeforeRewind.status).toBe(0);
      expect(statusBeforeRewind.stdout).toContain("Active version");

      const before = readContractFromStore(tmp.dataDir, contractId);
      expect(fs.existsSync(before.storePath)).toBe(true);
      expect(before.contract).toBeDefined();
      const historyLengthBefore = before.contract.history.length;
      const activeVersionBefore = before.contract.activeVersion;

      const rewind = runCli(
        ["contract", "rewind", contractId, "--actor", "e2e-actor", "test rewind"],
        env
      );
      expect(rewind.status).toBe(0);

      const statusAfterRewind = runCli(["contract", "status", contractId], env);
      expect(statusAfterRewind.status).toBe(0);
      expect(statusAfterRewind.stdout).toContain("REWOUND");

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(JSON.stringify(after.parsed)).toContain(contractId);
      expect(after.contract.history.length).toBeGreaterThan(historyLengthBefore);
      expect(after.contract.activeVersion).toBeGreaterThan(activeVersionBefore);

      const artifactDir = path.join(tmp.artifactsDir, contractId);
      expect(fs.existsSync(artifactDir)).toBe(true);
      expect(fs.readdirSync(artifactDir).length).toBeGreaterThan(0);
    } finally {
      tmp.cleanup();
    }
  });
});
