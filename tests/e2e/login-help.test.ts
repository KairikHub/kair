import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: login help", () => {
  test("login --help shows login-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["login", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Login Command");
      expect(result.stdout).toContain("kair login --provider <openai|claude>");
    } finally {
      tmp.cleanup();
    }
  });
});
