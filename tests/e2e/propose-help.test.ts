import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: propose help", () => {
  test("propose --help shows propose-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["propose", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Propose Command");
      expect(result.stdout).toContain('kair propose "<intent>" [--id <contract_id>]');
      expect(result.stdout).not.toContain("Kair Contract Commands");
    } finally {
      tmp.cleanup();
    }
  });

  test("propose without intent shows propose-specific help on error", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["propose"], env);
      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain("Kair Propose Command");
      expect(result.stdout).not.toContain("Kair Contract Commands");
      expect(result.stderr).toContain(
        "Missing intent. Provide it as an argument or run interactively in a TTY."
      );
    } finally {
      tmp.cleanup();
    }
  });
});
