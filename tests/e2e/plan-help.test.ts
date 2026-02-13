import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: plan help", () => {
  test("plan --help shows plan-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["plan", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Plan Command");
      expect(result.stdout).toContain("kair plan [<contract_id>] [--last]");
      expect(result.stdout).not.toContain('Unknown Contract "--help".');
    } finally {
      tmp.cleanup();
    }
  });

  test("plan help shows plan-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["plan", "help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Plan Command");
      expect(result.stdout).toContain("kair plan [<contract_id>] [--last]");
      expect(result.stdout).not.toContain("Unknown Contract");
    } finally {
      tmp.cleanup();
    }
  });
});
