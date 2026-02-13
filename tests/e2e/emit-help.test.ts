import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: emit help", () => {
  test("emit --help shows emit-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["emit", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Emit Command");
      expect(result.stdout).toContain("kair emit [<contract_id>] [--last]");
      expect(result.stdout).not.toContain('Unknown Contract "--help".');
    } finally {
      tmp.cleanup();
    }
  });
});
