import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

describe("e2e: logins command", () => {
  test("logins lists provider status with default marker", () => {
    const tmp = makeTempRoot();
    const configPath = path.join(tmp.root, "config.json");
    fs.writeFileSync(configPath, JSON.stringify({ defaultProvider: "openai" }, null, 2));
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
      KAIR_CONFIG_PATH: configPath,
      KAIR_OPENAI_API_KEY: "openai-test-token",
    };

    try {
      const result = runCli(["logins"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("provider  configured  source    default");
      expect(result.stdout).toContain("openai    yes");
      expect(result.stdout).toContain("claude    no");
      expect(result.stdout).toContain("*");
    } finally {
      tmp.cleanup();
    }
  });

  test("login list alias matches logins output", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
      KAIR_OPENAI_API_KEY: "openai-test-token",
    };

    try {
      const direct = runCli(["logins"], env);
      const alias = runCli(["login", "list"], env);
      expect(direct.status).toBe(0);
      expect(alias.status).toBe(0);
      expect(alias.stdout).toBe(direct.stdout);
    } finally {
      tmp.cleanup();
    }
  });

  test("logins --help shows logins-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["logins", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Logins Command");
      expect(result.stdout).toContain("kair logins");
      expect(result.stdout).toContain("kair login list");
    } finally {
      tmp.cleanup();
    }
  });
});
