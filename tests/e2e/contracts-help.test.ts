import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: contracts help", () => {
  test("contracts --help shows contracts-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["contracts", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Contracts Command");
      expect(result.stdout).toContain("kair contracts");
      expect(result.stdout).not.toContain("kair contract list");
      expect(result.stdout).not.toContain("No Contracts found.");
    } finally {
      tmp.cleanup();
    }
  });

  test("contracts help shows contracts-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["contracts", "help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Contracts Command");
      expect(result.stdout).toContain("kair contracts");
      expect(result.stdout).not.toContain("No Contracts found.");
    } finally {
      tmp.cleanup();
    }
  });
});
