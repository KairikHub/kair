import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

function runInCwd(cmd: string, args: string[], cwd: string, env: Record<string, string> = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
  return {
    status: result.status ?? -1,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
  };
}

function runGit(args: string[], cwd: string) {
  return runInCwd("git", args, cwd);
}

function copyDir(source: string, target: string) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
      continue;
    }
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function setupTempRepoWithEmbeddedKair() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kair-e2e-git-"));
  runGit(["init"], root);
  runGit(["config", "user.email", "e2e@test.local"], root);
  runGit(["config", "user.name", "e2e-test"], root);
  copyDir(path.join(process.cwd(), ".kair"), path.join(root, ".kair"));
  fs.writeFileSync(path.join(root, ".gitignore"), "node_modules\n");
  runGit(["add", "."], root);
  runGit(["commit", "-m", "seed"], root);
  return root;
}

function buildKairEnv(repo: string) {
  return {
    KAIR_TEST_MODE: "1",
    KAIR_DATA_DIR: path.join(repo, ".kair", "contracts"),
    KAIR_ARTIFACTS_DIR: path.join(repo, ".kair", "contracts"),
  };
}

describe("e2e: plan/propose git authority", () => {
  test("non-interactive plan auto-commits contract artifacts in git repo", () => {
    const repo = setupTempRepoWithEmbeddedKair();
    const kair = path.join(repo, ".kair", "bin", "kair");
    const contractId = "git_plan_autocommit";
    const planJson = JSON.stringify({
      version: "kair.plan.v1",
      title: "Git auto commit",
      steps: [{ id: "step-a", summary: "Auto commit plan artifacts." }],
    });

    try {
      const create = runInCwd(kair, ["contract", "--id", contractId, "Git plan contract"], repo, {
        ...buildKairEnv(repo),
      });
      expect(create.status).toBe(0);

      const plan = runInCwd(
        kair,
        ["plan", contractId, "--interactive=false", planJson],
        repo,
        buildKairEnv(repo)
      );
      expect(plan.status).toBe(0);

      const log = runGit(["log", "--oneline", "-1"], repo);
      expect(log.status).toBe(0);
      expect(log.stdout).toContain(`kair(plan): persist contract ${contractId}`);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test("propose fails with actionable error when contract plan artifacts are uncommitted", () => {
    const repo = setupTempRepoWithEmbeddedKair();
    const kair = path.join(repo, ".kair", "bin", "kair");
    const contractId = "git_propose_block";
    const planJson = JSON.stringify({
      version: "kair.plan.v1",
      title: "Git propose block",
      steps: [{ id: "step-a", summary: "Detect dirty plan artifacts." }],
    });

    try {
      const create = runInCwd(kair, ["contract", "--id", contractId, "Git propose block contract"], repo, {
        ...buildKairEnv(repo),
      });
      expect(create.status).toBe(0);

      const plan = runInCwd(
        kair,
        ["plan", contractId, "--interactive=false", planJson],
        repo,
        buildKairEnv(repo)
      );
      expect(plan.status).toBe(0);

      fs.appendFileSync(path.join(repo, ".kair", "contracts", contractId, "plan", "PLAN.md"), "\nmanual edit");
      const propose = runInCwd(kair, ["propose", contractId], repo, {
        ...buildKairEnv(repo),
      });
      expect(propose.status).not.toBe(0);
      expect(propose.stderr).toContain(`Uncommitted plan artifacts detected for contract "${contractId}".`);
      expect(propose.stderr).toContain("Suggested next step:");
      expect(propose.stderr).toContain("git add .kair/contracts/");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test("propose ignores volatile contract artifacts files", () => {
    const repo = setupTempRepoWithEmbeddedKair();
    const kair = path.join(repo, ".kair", "bin", "kair");
    const contractId = "git_propose_ignore_artifacts";
    const planJson = JSON.stringify({
      version: "kair.plan.v1",
      title: "Git propose ignore artifacts",
      steps: [{ id: "step-a", summary: "Ignore artifacts noise." }],
    });

    try {
      const create = runInCwd(kair, ["contract", "--id", contractId, "Git propose artifacts contract"], repo, {
        ...buildKairEnv(repo),
      });
      expect(create.status).toBe(0);

      const plan = runInCwd(
        kair,
        ["plan", contractId, "--interactive=false", planJson],
        repo,
        buildKairEnv(repo)
      );
      expect(plan.status).toBe(0);

      fs.mkdirSync(path.join(repo, ".kair", "contracts", contractId, "artifacts", "run"), { recursive: true });
      fs.mkdirSync(path.join(repo, ".kair", "contracts", contractId, "artifacts", "git"), { recursive: true });
      fs.appendFileSync(path.join(repo, ".kair", "contracts", contractId, "artifacts", "run", "stream.jsonl"), "x\n");
      fs.appendFileSync(
        path.join(repo, ".kair", "contracts", contractId, "artifacts", "git", "commands.jsonl"),
        "{}\n"
      );

      const propose = runInCwd(kair, ["propose", contractId], repo, {
        ...buildKairEnv(repo),
      });
      expect(propose.status).toBe(0);
      expect(propose.stderr).not.toContain("Uncommitted plan artifacts detected");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
