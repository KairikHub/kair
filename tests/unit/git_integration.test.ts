import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildContractGitPaths,
  commitPlanChanges,
  listUncommittedContractPaths,
} from "../../src/core/git/integration";

function runGit(args: string[], cwd: string) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function ensureOk(result: ReturnType<typeof runGit>) {
  if ((result.status ?? 1) !== 0) {
    throw new Error(`git command failed: ${result.stderr || result.stdout}`);
  }
}

function setupRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kair-git-it-"));
  ensureOk(runGit(["init"], root));
  ensureOk(runGit(["config", "user.email", "unit@test.local"], root));
  ensureOk(runGit(["config", "user.name", "unit-test"], root));
  return root;
}

function setRepoDataEnv(repo: string) {
  const previous = {
    KAIR_DATA_DIR: process.env.KAIR_DATA_DIR,
    KAIRIK_DATA_DIR: process.env.KAIRIK_DATA_DIR,
  };
  process.env.KAIR_DATA_DIR = path.join(repo, ".kair", "contracts");
  delete process.env.KAIRIK_DATA_DIR;
  return () => {
    if (previous.KAIR_DATA_DIR === undefined) {
      delete process.env.KAIR_DATA_DIR;
    } else {
      process.env.KAIR_DATA_DIR = previous.KAIR_DATA_DIR;
    }
    if (previous.KAIRIK_DATA_DIR === undefined) {
      delete process.env.KAIRIK_DATA_DIR;
    } else {
      process.env.KAIRIK_DATA_DIR = previous.KAIRIK_DATA_DIR;
    }
  };
}

function writeContractFiles(root: string, contractId: string) {
  const contractDir = path.join(root, ".kair", "contracts", contractId);
  fs.mkdirSync(path.join(contractDir, "plan"), { recursive: true });
  fs.mkdirSync(path.join(contractDir, "dpc"), { recursive: true });
  fs.writeFileSync(path.join(contractDir, "contract.json"), "{}\n");
  fs.writeFileSync(path.join(contractDir, "history.jsonl"), "{}\n");
  fs.writeFileSync(path.join(contractDir, "plan", "PLAN.md"), "# PLAN\n");
  fs.writeFileSync(
    path.join(contractDir, "plan", "plan_v1.json"),
    JSON.stringify({ version: "kair.plan.v1", title: "t", steps: [{ id: "s1", summary: "sum" }] }, null, 2)
  );
  fs.writeFileSync(path.join(contractDir, "plan", "RULES.md"), "");
  fs.writeFileSync(path.join(contractDir, "dpc", "dpc_v1.json"), "{}\n");
  fs.mkdirSync(path.join(root, ".kair", "contracts"), { recursive: true });
  fs.writeFileSync(path.join(root, ".kair", "contracts", "index.json"), "{ \"contracts\": [] }\n");
}

describe("unit: git integration contract-scoped commit paths", () => {
  test("buildContractGitPaths includes plan/governance paths and excludes auth/config + artifacts", () => {
    const repo = setupRepo();
    const prevCwd = process.cwd();
    const contractId = "contract_git_paths";
    const restoreEnv = setRepoDataEnv(repo);
    try {
      process.chdir(repo);
      writeContractFiles(repo, contractId);
      fs.writeFileSync(path.join(repo, ".kair", "auth-fallback.json"), "{ \"provider/openai\": \"secret\" }\n");
      fs.writeFileSync(path.join(repo, ".kair", "config.json"), "{ \"defaultProvider\": \"openai\" }\n");
      fs.mkdirSync(path.join(repo, ".kair", "contracts", contractId, "artifacts", "run"), { recursive: true });
      fs.writeFileSync(path.join(repo, ".kair", "contracts", contractId, "artifacts", "run", "stream.jsonl"), "{}\n");
      fs.mkdirSync(path.join(repo, ".kair", "contracts", contractId, "run"), { recursive: true });
      fs.writeFileSync(path.join(repo, ".kair", "contracts", contractId, "run", "stream.jsonl"), "{}\n");
      fs.mkdirSync(path.join(repo, ".kair", "contracts", contractId, "git"), { recursive: true });
      fs.writeFileSync(path.join(repo, ".kair", "contracts", contractId, "git", "commands.jsonl"), "{}\n");

      const paths = buildContractGitPaths(contractId, repo);
      expect(paths.some((entry) => entry.includes(`.kair/contracts/${contractId}/contract.json`))).toBe(true);
      expect(paths.some((entry) => entry.includes(`.kair/contracts/${contractId}/plan/PLAN.md`))).toBe(true);
      expect(paths.some((entry) => entry.includes(`.kair/contracts/${contractId}/dpc/dpc_v1.json`))).toBe(true);
      expect(paths.some((entry) => entry === ".kair/contracts/index.json")).toBe(true);
      expect(paths.some((entry) => entry.includes(`.kair/contracts/${contractId}/artifacts/`))).toBe(false);
      expect(paths.some((entry) => entry.includes(`.kair/contracts/${contractId}/run/`))).toBe(false);
      expect(paths.some((entry) => entry.includes(`.kair/contracts/${contractId}/git/`))).toBe(false);
      expect(paths.some((entry) => entry.includes(".kair/auth-fallback.json"))).toBe(false);
      expect(paths.some((entry) => entry.includes(".kair/config.json"))).toBe(false);
    } finally {
      restoreEnv();
      process.chdir(prevCwd);
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test("listUncommittedContractPaths detects plan/governance paths and ignores artifacts", () => {
    const repo = setupRepo();
    const prevCwd = process.cwd();
    const contractId = "contract_git_status";
    const restoreEnv = setRepoDataEnv(repo);
    try {
      process.chdir(repo);
      writeContractFiles(repo, contractId);
      fs.writeFileSync(path.join(repo, "README.tmp"), "unrelated\n");
      ensureOk(runGit(["add", "-A"], repo));
      ensureOk(runGit(["commit", "-m", "seed"], repo));

      fs.appendFileSync(path.join(repo, ".kair", "contracts", contractId, "plan", "PLAN.md"), "\nextra");
      fs.writeFileSync(path.join(repo, ".kair", "contracts", contractId, "plan", "extra.txt"), "u\n");
      fs.mkdirSync(path.join(repo, ".kair", "contracts", contractId, "artifacts", "run"), { recursive: true });
      fs.writeFileSync(path.join(repo, ".kair", "contracts", contractId, "artifacts", "run", "stream.jsonl"), "1\n");
      fs.mkdirSync(path.join(repo, ".kair", "contracts", contractId, "run"), { recursive: true });
      fs.writeFileSync(path.join(repo, ".kair", "contracts", contractId, "run", "stream.jsonl"), "1\n");
      fs.mkdirSync(path.join(repo, ".kair", "contracts", contractId, "git"), { recursive: true });
      fs.writeFileSync(path.join(repo, ".kair", "contracts", contractId, "git", "commands.jsonl"), "1\n");

      const dirty = listUncommittedContractPaths(contractId, repo);
      expect(dirty.some((entry) => entry.endsWith(`.kair/contracts/${contractId}/plan/PLAN.md`))).toBe(true);
      expect(dirty.some((entry) => entry.endsWith(`.kair/contracts/${contractId}/plan/extra.txt`))).toBe(true);
      expect(dirty.some((entry) => entry.includes(`.kair/contracts/${contractId}/artifacts/`))).toBe(false);
      expect(dirty.some((entry) => entry.includes(`.kair/contracts/${contractId}/run/`))).toBe(false);
      expect(dirty.some((entry) => entry.includes(`.kair/contracts/${contractId}/git/`))).toBe(false);
      expect(dirty.some((entry) => entry.includes("README.tmp"))).toBe(false);
    } finally {
      restoreEnv();
      process.chdir(prevCwd);
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test("commitPlanChanges commits only contract-scoped .kair artifacts", () => {
    const repo = setupRepo();
    const prevCwd = process.cwd();
    const contractId = "contract_git_commit";
    const restoreEnv = setRepoDataEnv(repo);
    try {
      process.chdir(repo);
      writeContractFiles(repo, contractId);
      fs.writeFileSync(path.join(repo, "outside.txt"), "outside\n");
      ensureOk(runGit(["add", "-A"], repo));
      ensureOk(runGit(["commit", "-m", "seed"], repo));

      fs.appendFileSync(path.join(repo, ".kair", "contracts", contractId, "plan", "PLAN.md"), "\nnew plan");
      fs.writeFileSync(path.join(repo, ".kair", "contracts", contractId, "plan", "generated.md"), "gen\n");
      fs.appendFileSync(path.join(repo, "outside.txt"), "still dirty\n");

      const result = commitPlanChanges(contractId, "kair(plan): persist contract contract_git_commit", repo);
      expect(result.committed).toBe(true);

      const status = runGit(["status", "--porcelain"], repo);
      const lines = String(status.stdout || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      expect(lines.some((line) => line.endsWith("outside.txt"))).toBe(true);
      expect(lines.some((line) => line.includes(`.kair/contracts/${contractId}/plan/PLAN.md`))).toBe(false);
      expect(lines.some((line) => line.includes(`.kair/contracts/${contractId}/plan/generated.md`))).toBe(false);
    } finally {
      restoreEnv();
      process.chdir(prevCwd);
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
