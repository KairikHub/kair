import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: propose help", () => {
  test("propose --help shows propose-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["propose", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Propose Command");
      expect(result.stdout).toContain("kair propose [<contract_id>] [--last]");
      expect(result.stdout).not.toContain('Unknown Contract "--help".');
    } finally {
      tmp.cleanup();
    }
  });

  test("propose help shows propose-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["propose", "help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Propose Command");
      expect(result.stdout).toContain("kair propose [<contract_id>] [--last]");
      expect(result.stdout).not.toContain("Unknown Contract");
    } finally {
      tmp.cleanup();
    }
  });

  test("propose with no contracts fails clearly", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["propose", "--last"], env);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("No Contracts found.");
    } finally {
      tmp.cleanup();
    }
  });

  test("request-approval command is removed", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["request-approval"], env);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Unknown command "request-approval".');
    } finally {
      tmp.cleanup();
    }
  });
});
