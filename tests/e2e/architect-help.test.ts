import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: architect help", () => {
  test("top-level help lists architect command", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("architect");
      expect(result.stdout).toContain("Run multi-agent planning loop");
    } finally {
      tmp.cleanup();
    }
  });

  test("architect --help shows architect-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["architect", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Architect Command");
      expect(result.stdout).toContain("kair architect status");
      expect(result.stdout).toContain("kair architect validate");
      expect(result.stdout).toContain("kair architect init-agents");
      expect(result.stdout).toContain(".contracts/<contract_id>/agents/<agent_name>/SOUL.md");
      expect(result.stdout).toContain(".contracts/<contract_id>/artifacts/architect/");
    } finally {
      tmp.cleanup();
    }
  });

  test("architect help is equivalent entrypoint to architect --help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const viaHelpWord = runCli(["architect", "help"], env);
      const viaFlag = runCli(["architect", "--help"], env);
      expect(viaHelpWord.status).toBe(0);
      expect(viaFlag.status).toBe(0);
      expect(viaHelpWord.stdout).toContain("Kair Architect Command");
      expect(viaHelpWord.stdout).toContain("Milestone validation gate");
      expect(viaHelpWord.stdout).toBe(viaFlag.stdout);
    } finally {
      tmp.cleanup();
    }
  });

  test("invalid architect args fail with architect usage hints", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["architect", "unknown-subcommand"], env);
      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain("Kair Architect Command");
      expect(result.stdout).toContain("kair architect [--contract <contract_id>]");
      expect(result.stderr).toContain('Architect command is not implemented yet. Use "kair architect --help" for planned interface.');
    } finally {
      tmp.cleanup();
    }
  });
});
