import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: login command", () => {
  test("login without --provider uses configured provider in non-interactive mode", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
      KAIR_LLM_PROVIDER: "openai",
      KAIR_OPENAI_API_KEY: "test-token",
    };

    try {
      const result = runCli(["login"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("OAuth login complete for provider: openai");
    } finally {
      tmp.cleanup();
    }
  });

  test("login without provider fails in non-interactive mode when no configured provider", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["login"], env);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Missing provider. Pass --provider <openai|claude> or set KAIR_LLM_PROVIDER."
      );
    } finally {
      tmp.cleanup();
    }
  });
});
