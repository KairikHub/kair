import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: accept help", () => {
  test("accept --help shows accept-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["accept", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Accept Command");
      expect(result.stdout).toContain("kair accept <contract_id> [--actor <name>]");
      expect(result.stdout).not.toContain('Unknown Contract "--help".');
    } finally {
      tmp.cleanup();
    }
  });
});
