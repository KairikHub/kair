import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

import { loadStore } from "../core/store/contracts_store";
import { printTopHelp } from "./help";
import { executeCommand } from "./execute";

function maybeWarnRuntimeVersionDrift(rawArgs: string[]) {
  if ((process.env.KAIR_TEST_MODE || "").trim() === "1") {
    return;
  }
  const shouldCheck = rawArgs.includes("-h")
    || rawArgs.includes("--help")
    || rawArgs.includes("help")
    || rawArgs.includes("--debug");
  if (!shouldCheck) {
    return;
  }
  const gitDir = path.join(process.cwd(), ".git");
  if (!fs.existsSync(gitDir)) {
    return;
  }
  const installedVersionPath = path.join(os.homedir(), ".kair", "VERSION");
  if (!fs.existsSync(installedVersionPath)) {
    return;
  }
  const installedRaw = fs.readFileSync(installedVersionPath, "utf8");
  const installedSha = (installedRaw.match(/^kair_git_sha=([0-9a-f]+)/m) || [])[1];
  if (!installedSha) {
    return;
  }
  const repoShaResult = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if ((repoShaResult.status ?? 1) !== 0) {
    return;
  }
  const repoSha = String(repoShaResult.stdout || "").trim();
  if (!repoSha || repoSha === installedSha) {
    return;
  }
  console.warn(
    `[kair] Installed runtime SHA (${installedSha}) differs from repo SHA (${repoSha}). `
    + "Run `kair self-update` and verify with `which kair` and `cat ~/.kair/VERSION`."
  );
}

export async function main() {
  let rawArgs = process.argv.slice(2);
  if (rawArgs[0] === "kair") {
    rawArgs = rawArgs.slice(1);
  }
  maybeWarnRuntimeVersionDrift(rawArgs);
  if (rawArgs.length === 0) {
    printTopHelp();
    return;
  }
  if (rawArgs.length === 1 && (rawArgs[0] === "-h" || rawArgs[0] === "--help")) {
    printTopHelp();
    return;
  }

  loadStore();

  const commandGroups: string[][] = [];
  let current: string[] = [];
  for (const arg of rawArgs) {
    if (arg === "--") {
      if (current.length > 0) {
        commandGroups.push(current);
        current = [];
      }
      continue;
    }
    current.push(arg);
  }
  if (current.length > 0) {
    commandGroups.push(current);
  }

  const allowPrompt = process.stdin.isTTY && process.stdout.isTTY;
  const isChained = commandGroups.length > 1;

  for (const group of commandGroups) {
    await executeCommand(group, { allowPrompt, isChained });
  }
}
