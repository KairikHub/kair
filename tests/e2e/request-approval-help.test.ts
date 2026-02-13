import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: request-approval help", () => {
  test("request-approval --help shows request-approval-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["request-approval", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Request-Approval Command");
      expect(result.stdout).toContain("kair request-approval [<contract_id>] [--last]");
      expect(result.stdout).not.toContain('Unknown Contract "--help".');
    } finally {
      tmp.cleanup();
    }
  });

  test("contract request-approval --help shows request-approval-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["contract", "request-approval", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Request-Approval Command");
      expect(result.stdout).toContain("kair contract request-approval [<contract_id>] [--last]");
      expect(result.stdout).not.toContain("Unknown Contract");
    } finally {
      tmp.cleanup();
    }
  });
});
