import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import { ensureGitProjectSettings, readGitProjectSettings } from "../../src/core/git/settings";

function runGit(args: string[], cwd: string) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if ((result.status ?? 1) !== 0) {
    throw new Error(String(result.stderr || result.stdout));
  }
}

describe("unit: git settings", () => {
  test("ensureGitProjectSettings writes .kair/git.json from origin remote", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "kair-git-settings-"));
    const remote = fs.mkdtempSync(path.join(os.tmpdir(), "kair-git-settings-remote-"));
    const prior = process.cwd();
    try {
      runGit(["init"], repo);
      runGit(["config", "user.email", "unit@test.local"], repo);
      runGit(["config", "user.name", "unit-test"], repo);
      runGit(["init", "--bare"], remote);
      runGit(["remote", "add", "origin", remote], repo);
      process.chdir(repo);

      const settings = ensureGitProjectSettings(repo);
      expect(settings?.repo_url).toBe(remote);
      expect(settings?.remote_name).toBe("origin");

      const persisted = readGitProjectSettings();
      expect(persisted?.repo_url).toBe(remote);
      expect(fs.existsSync(path.join(repo, ".kair", "git.json"))).toBe(true);
    } finally {
      process.chdir(prior);
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(remote, { recursive: true, force: true });
    }
  });
});
