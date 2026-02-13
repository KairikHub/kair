import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: run help", () => {
  test("run --help shows run-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["run", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Run Command");
      expect(result.stdout).toContain(
        "kair run [<contract_id>] [--last] [--provider <name>] [--model <name>] [--force] [--debug] [--json]"
      );
      expect(result.stdout).not.toContain('Unknown Contract "--help".');
    } finally {
      tmp.cleanup();
    }
  });

  test("run help shows run-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["run", "help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Run Command");
      expect(result.stdout).toContain(
        "kair run [<contract_id>] [--last] [--provider <name>] [--model <name>] [--force] [--debug] [--json]"
      );
      expect(result.stdout).not.toContain("Unknown Contract");
    } finally {
      tmp.cleanup();
    }
  });
});
