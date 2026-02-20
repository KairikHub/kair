import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import {
  getContractDir,
  getContractArtifactsDir,
  getContractHistoryPath,
  getContractPlanDir,
  getContractPlanJsonPath,
  getContractPlanMarkdownPath,
  getContractRulesPath,
  getContractSnapshotPath,
  getContractsIndexPath,
} from "../store/paths";
import { now } from "../time";

type GitResult = {
  status: number;
  stdout: string;
  stderr: string;
  command: string[];
};

function runGit(args: string[], cwd = process.cwd()): GitResult {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    command: ["git", ...args],
  };
}

export function isGitInstalled() {
  const result = runGit(["--version"]);
  return result.status === 0;
}

export function ensureGitInstalled() {
  if (!isGitInstalled()) {
    throw new Error("git is required for --with=git but was not found on PATH.");
  }
}

export function ensureGitRepo(cwd = process.cwd()) {
  const result = runGit(["rev-parse", "--is-inside-work-tree"], cwd);
  if (result.status !== 0 || !result.stdout.trim().toLowerCase().startsWith("true")) {
    throw new Error("--with=git requires running inside a git repository.");
  }
}

function appendGitReceipt(contractId: string, payload: Record<string, unknown>) {
  const logPath = path.join(getContractArtifactsDir(contractId), "git", "commands.jsonl");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`);
  return logPath;
}

function runAndReceipt(contractId: string, args: string[], cwd = process.cwd()) {
  const result = runGit(args, cwd);
  const receiptPath = appendGitReceipt(contractId, {
    ts: now(),
    cwd,
    command: result.command,
    status: result.status,
    stdout: result.stdout.slice(0, 4000),
    stderr: result.stderr.slice(0, 4000),
  });
  return { ...result, receiptPath };
}

export function contractBranchName(contractId: string) {
  return `kair-contract/${contractId}`;
}

export function checkoutContractBranch(contractId: string, cwd = process.cwd()) {
  const branch = contractBranchName(contractId);
  let result = runAndReceipt(contractId, ["checkout", "-B", branch], cwd);
  if (result.status !== 0) {
    result = runAndReceipt(contractId, ["switch", "-C", branch], cwd);
  }
  if (result.status !== 0) {
    throw new Error(`Failed to create/switch git branch ${branch}: ${result.stderr || result.stdout}`);
  }
  return { branch, receiptPath: result.receiptPath };
}

export function commitPlanChanges(contractId: string, message: string, cwd = process.cwd()) {
  const stagePaths = buildContractGitPaths(contractId, cwd);
  if (stagePaths.length === 0) {
    throw new Error("No in-repo contract files were available to stage for commit.");
  }
  const addResult = runAndReceipt(contractId, ["add", ...stagePaths], cwd);
  if (addResult.status !== 0) {
    throw new Error(`git add failed: ${addResult.stderr || addResult.stdout}`);
  }
  const commitResult = runAndReceipt(contractId, ["commit", "-m", message], cwd);
  if (commitResult.status !== 0) {
    const summary = `${commitResult.stderr} ${commitResult.stdout}`.toLowerCase();
    if (!summary.includes("nothing to commit")) {
      throw new Error(`git commit failed: ${commitResult.stderr || commitResult.stdout}`);
    }
  }
  const commitSummary = `${commitResult.stderr} ${commitResult.stdout}`.toLowerCase();
  const committed = !commitSummary.includes("nothing to commit");
  return { receiptPath: commitResult.receiptPath, committed };
}

function toRepoRelative(filePath: string, cwd = process.cwd()) {
  let normalizedCwd = path.resolve(cwd);
  let normalizedFilePath = path.resolve(filePath);
  try {
    normalizedCwd = fs.realpathSync.native(normalizedCwd);
  } catch {
    // fallback to resolved cwd path
  }
  try {
    normalizedFilePath = fs.realpathSync.native(normalizedFilePath);
  } catch {
    // fallback to resolved file path
  }
  const relative = path.relative(normalizedCwd, normalizedFilePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return "";
  }
  return relative;
}

function gatherExistingRelativeFiles(rootPath: string, cwd = process.cwd()) {
  if (!fs.existsSync(rootPath)) {
    return [] as string[];
  }
  const stat = fs.statSync(rootPath);
  if (stat.isFile()) {
    const relative = toRepoRelative(rootPath, cwd);
    return relative ? [relative] : [];
  }
  const output: string[] = [];
  const stack = [rootPath];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const currentStat = fs.statSync(current);
    if (currentStat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    const relative = toRepoRelative(current, cwd);
    if (relative) {
      output.push(relative);
    }
  }
  return output;
}

export function buildContractGitPaths(contractId: string, cwd = process.cwd()) {
  const candidates = [
    getContractSnapshotPath(contractId),
    getContractHistoryPath(contractId),
    getContractPlanDir(contractId),
    getContractPlanJsonPath(contractId),
    getContractPlanMarkdownPath(contractId),
    getContractRulesPath(contractId),
    getContractsIndexPath(),
    path.join(getContractDir(contractId), "dpc"),
  ];

  const stagePaths = new Set<string>();
  for (const candidate of candidates) {
    for (const item of gatherExistingRelativeFiles(candidate, cwd)) {
      stagePaths.add(item);
    }
  }

  const filtered = [...stagePaths]
    .filter((entry) => !entry.includes("/artifacts/"))
    .filter((entry) => !entry.startsWith(`.kair/contracts/${contractId}/run/`))
    .filter((entry) => !entry.startsWith(`.kair/contracts/${contractId}/git/`))
    .filter((entry) => !entry.startsWith(".kair/auth-fallback.json"))
    .filter((entry) => !entry.startsWith(".kair/config.json"))
    .sort((a, b) => a.localeCompare(b));

  return filtered;
}

export function listUncommittedContractPaths(contractId: string, cwd = process.cwd()) {
  const scope = buildContractGitPaths(contractId, cwd);
  if (scope.length === 0) {
    return [] as string[];
  }
  const result = runGit(["status", "--porcelain", "--untracked-files=all", "--", ...scope], cwd);
  if (result.status !== 0) {
    throw new Error(`git status failed: ${result.stderr || result.stdout}`);
  }
  const paths = new Set<string>();
  const lines = result.stdout.split("\n").map((line) => line.trimEnd()).filter(Boolean);
  for (const line of lines) {
    const payload = line.slice(3).trim();
    if (!payload) {
      continue;
    }
    if (payload.includes(" -> ")) {
      const target = payload.split(" -> ")[1].trim();
      if (target) {
        paths.add(target);
      }
      continue;
    }
    paths.add(payload);
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}

export function pushContractBranch(contractId: string, cwd = process.cwd()) {
  const branch = contractBranchName(contractId);
  const result = runAndReceipt(contractId, ["push", "origin", branch], cwd);
  if (result.status !== 0) {
    throw new Error(`git push failed: ${result.stderr || result.stdout}`);
  }
  return { branch, receiptPath: result.receiptPath };
}

export function pullCurrentBranch(contractId: string, cwd = process.cwd()) {
  const result = runAndReceipt(contractId, ["pull"], cwd);
  if (result.status !== 0) {
    throw new Error(`git pull failed: ${result.stderr || result.stdout}`);
  }
  return { receiptPath: result.receiptPath };
}

export function isInsideGitRepo(cwd = process.cwd()) {
  if (!isGitInstalled()) {
    return false;
  }
  const result = runGit(["rev-parse", "--is-inside-work-tree"], cwd);
  return result.status === 0 && result.stdout.trim().toLowerCase().startsWith("true");
}
