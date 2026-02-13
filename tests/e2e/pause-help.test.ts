import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: pause help", () => {
  test("pause --help shows pause-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["pause", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Pause Command");
      expect(result.stdout).toContain("kair pause [<contract_id>] [--last] [--actor <name>]");
      expect(result.stdout).not.toContain('Unknown Contract "--help".');
    } finally {
      tmp.cleanup();
    }
  });

  test("contract pause --help shows pause-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["contract", "pause", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Pause Command");
      expect(result.stdout).toContain(
        "kair contract pause [<contract_id>] [--last] [--actor <name>]"
      );
      expect(result.stdout).not.toContain("Unknown Contract");
    } finally {
      tmp.cleanup();
    }
  });
});
