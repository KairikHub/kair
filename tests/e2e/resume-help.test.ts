import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: resume help", () => {
  test("resume --help shows resume-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["resume", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Resume Command");
      expect(result.stdout).toContain("kair resume [<contract_id>] [--last] [--actor <name>]");
      expect(result.stdout).not.toContain('Unknown Contract "--help".');
    } finally {
      tmp.cleanup();
    }
  });

  test("resume help shows resume-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["resume", "help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Resume Command");
      expect(result.stdout).toContain("kair resume [<contract_id>] [--last] [--actor <name>]");
      expect(result.stdout).not.toContain("Unknown Contract");
    } finally {
      tmp.cleanup();
    }
  });
});
