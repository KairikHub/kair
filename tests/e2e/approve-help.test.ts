import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: approve help", () => {
  test("approve --help shows approve-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["approve", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Approve Command");
      expect(result.stdout).toContain("kair approve [<contract_id>] [--last] [--actor <name>]");
      expect(result.stdout).not.toContain('Unknown Contract "--help".');
    } finally {
      tmp.cleanup();
    }
  });

  test("contract approve --help shows approve-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["contract", "approve", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Approve Command");
      expect(result.stdout).toContain(
        "kair contract approve [<contract_id>] [--last] [--actor <name>]"
      );
      expect(result.stdout).not.toContain("Unknown Contract");
    } finally {
      tmp.cleanup();
    }
  });
});
