import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: rewind help", () => {
  test("rewind --help shows rewind-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["rewind", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Rewind Command");
      expect(result.stdout).toContain(
        "kair rewind [<contract_id>] [--last] [--actor <name>] [<reason>]"
      );
      expect(result.stdout).not.toContain('Unknown Contract "--help".');
    } finally {
      tmp.cleanup();
    }
  });

  test("contract rewind --help shows rewind-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["contract", "rewind", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Rewind Command");
      expect(result.stdout).toContain(
        "kair contract rewind [<contract_id>] [--last] [--actor <name>] [<reason>]"
      );
      expect(result.stdout).not.toContain("Unknown Contract");
    } finally {
      tmp.cleanup();
    }
  });
});
