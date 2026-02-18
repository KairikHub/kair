import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import {
  getContractArtifactsDir,
  getContractPlanJsonPath,
  getContractPlanMarkdownPath,
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
  const stageCandidates = [
    getContractPlanMarkdownPath(contractId),
    getContractPlanJsonPath(contractId),
    getContractSnapshotPath(contractId),
    getContractsIndexPath(),
  ];
  const stagePaths = stageCandidates
    .map((candidate) => path.relative(cwd, candidate))
    .filter((candidate) => candidate && !candidate.startsWith("..") && !path.isAbsolute(candidate));
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
  return { receiptPath: commitResult.receiptPath };
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
