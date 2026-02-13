import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: status help", () => {
  test("status --help shows status-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["status", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Status Command");
      expect(result.stdout).toContain("kair status [<contract_id>] [--last]");
      expect(result.stdout).not.toContain('Unknown Contract "--help".');
    } finally {
      tmp.cleanup();
    }
  });

  test("status help shows status-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["status", "help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Status Command");
      expect(result.stdout).toContain("kair status [<contract_id>] [--last]");
      expect(result.stdout).not.toContain("Unknown Contract");
    } finally {
      tmp.cleanup();
    }
  });
});
