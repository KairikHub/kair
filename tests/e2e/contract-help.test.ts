import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

function readStoreIds(dataDir: string) {
  const storePath = path.join(dataDir, "index.json");
  const raw = fs.readFileSync(storePath, "utf8");
  const parsed = JSON.parse(raw);
  return (parsed.contracts || []).map((contract: any) => contract.id);
}

describe("e2e: contract help", () => {
  test("contract --help shows contract-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["contract", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Contract Command");
      expect(result.stdout).toContain('kair contract "<intent>" [--id <contract_id>]');
      expect(result.stdout).not.toContain('Unknown Contract "--help".');
    } finally {
      tmp.cleanup();
    }
  });

  test("contract creates a new contract in DRAFT", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["contract", "Contract create test"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Created a Kair Contract:");

      const ids = readStoreIds(tmp.dataDir);
      expect(ids.length).toBe(1);
    } finally {
      tmp.cleanup();
    }
  });

  test('contract rejects reserved contract id "help"', () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["contract", "--id", "help", "Reserved id"], env);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Contract id "help" is reserved.');
    } finally {
      tmp.cleanup();
    }
  });
});
