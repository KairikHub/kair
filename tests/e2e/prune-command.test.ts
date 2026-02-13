import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

function readStore(dataDir: string) {
  const storePath = path.join(dataDir, "contracts.json");
  const raw = fs.readFileSync(storePath, "utf8");
  return JSON.parse(raw);
}

function seedContractArtifacts(artifactsDir: string, contractId: string) {
  const artifactPath = path.join(artifactsDir, contractId, "evidence", "note.txt");
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `artifact for ${contractId}`);
  return artifactPath;
}

describe("e2e: prune command", () => {
  test("prune --help shows prune-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["prune", "--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Prune Command");
      expect(result.stdout).toContain("kair prune -a");
      expect(result.stdout).toContain("kair prune --all");
    } finally {
      tmp.cleanup();
    }
  });

  test("prune help shows prune-specific help", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["prune", "help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Prune Command");
      expect(result.stdout).toContain("kair prune -a");
    } finally {
      tmp.cleanup();
    }
  });

  test("prune with no args prints help and exits 0", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["prune"], env);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Kair Prune Command");
    } finally {
      tmp.cleanup();
    }
  });

  test("top-level help does not list prune", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["--help"], env);
      expect(result.status).toBe(0);
      expect(result.stdout.toLowerCase()).not.toContain("prune");
    } finally {
      tmp.cleanup();
    }
  });

  test("prune -a with no confirmation keeps contracts and artifacts", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      expect(runCli(["contract", "--id", "prune_one", "Prune one"], env).status).toBe(0);
      expect(runCli(["contract", "--id", "prune_two", "Prune two"], env).status).toBe(0);
      const artifactOne = seedContractArtifacts(tmp.artifactsDir, "prune_one");
      const artifactTwo = seedContractArtifacts(tmp.artifactsDir, "prune_two");

      const before = readStore(tmp.dataDir);
      const result = runCli(["prune", "-a"], env, "n\n");
      const after = readStore(tmp.dataDir);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("PRUNE PREVIEW");
      expect(result.stdout).toContain("- prune_one");
      expect(result.stdout).toContain("- prune_two");
      expect(result.stdout).toContain("Proceed? [y]es [n]o:");
      expect(result.stdout).toContain("Prune cancelled.");
      expect(after).toEqual(before);
      expect(fs.existsSync(artifactOne)).toBe(true);
      expect(fs.existsSync(artifactTwo)).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });

  test("prune --all with yes resets store and clears artifact contents", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      expect(runCli(["contract", "--id", "prune_three", "Prune three"], env).status).toBe(0);
      seedContractArtifacts(tmp.artifactsDir, "prune_three");

      const result = runCli(["prune", "--all"], env, "y\n");
      const store = readStore(tmp.dataDir);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("PRUNE PREVIEW");
      expect(result.stdout).toContain("Prune complete.");
      expect(store).toEqual({
        nextId: 1,
        contracts: [],
      });
      expect(fs.readdirSync(tmp.artifactsDir)).toEqual([]);
    } finally {
      tmp.cleanup();
    }
  });

  test("prune with invalid args fails with usage", () => {
    const tmp = makeTempRoot();
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_TEST_MODE: "1",
    };

    try {
      const result = runCli(["prune", "foo"], env);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Invalid arguments. Usage: prune [-a|--all]");
    } finally {
      tmp.cleanup();
    }
  });
});
