import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: self-update help", () => {
  test("self-update --help shows command help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["self-update", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Self-Update Command");
      expect(result.stdout).toContain("kair self-update");
    } finally {
      tmp.cleanup();
    }
  });
});
