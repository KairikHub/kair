import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: self-update command", () => {
  test("self-update runs override command and succeeds", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
      KAIR_SELF_UPDATE_CMD: "printf 'mock update\\n'",
    };

    try {
      const result = runCli(["self-update"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Running self-update...");
      expect(result.stdout).toContain("Self-update complete.");
      expect(result.stdout).toContain("mock update");
    } finally {
      tmp.cleanup();
    }
  });

  test("self-update fails when override command fails", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
      KAIR_SELF_UPDATE_CMD: "exit 7",
    };

    try {
      const result = runCli(["self-update"], env);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("Running self-update...");
      expect(result.stderr).toContain("self-update failed (exit code 7)");
    } finally {
      tmp.cleanup();
    }
  });
});
