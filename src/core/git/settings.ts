import * as fs from "node:fs";
import * as path from "node:path";

import { now } from "../time";
import { runGitCommand } from "./integration";

export type GitProjectSettings = {
  repo_url: string;
  remote_name: string;
  detected_at: string;
};

function getGitSettingsPath() {
  return path.join(process.cwd(), ".kair", "git.json");
}

export function readGitProjectSettings(): GitProjectSettings | null {
  const filePath = getGitSettingsPath();
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const repoUrl = String((raw as any).repo_url || "").trim();
    const remoteName = String((raw as any).remote_name || "origin").trim() || "origin";
    const detectedAt = String((raw as any).detected_at || "").trim() || now();
    if (!repoUrl) {
      return null;
    }
    return {
      repo_url: repoUrl,
      remote_name: remoteName,
      detected_at: detectedAt,
    };
  } catch {
    return null;
  }
}

export function writeGitProjectSettings(settings: GitProjectSettings) {
  const filePath = getGitSettingsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2));
  fs.renameSync(tmpPath, filePath);
}

function parseRemoteUrl(stdout: string) {
  const lines = stdout.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*Fetch URL:\s*(.+)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function detectRemoteUrl(remoteName: string, cwd = process.cwd()) {
  const show = runGitCommand(["remote", "show", remoteName], cwd);
  if (show.status === 0) {
    const parsed = parseRemoteUrl(show.stdout);
    if (parsed) {
      return parsed;
    }
  }
  const getUrl = runGitCommand(["remote", "get-url", remoteName], cwd);
  if (getUrl.status === 0) {
    return String(getUrl.stdout || "").trim();
  }
  return "";
}

export function ensureGitProjectSettings(cwd = process.cwd()) {
  const existing = readGitProjectSettings();
  if (existing && existing.repo_url) {
    return existing;
  }
  const remoteName = "origin";
  const repoUrl = detectRemoteUrl(remoteName, cwd);
  if (!repoUrl) {
    return null;
  }
  const discovered = {
    repo_url: repoUrl,
    remote_name: remoteName,
    detected_at: now(),
  };
  writeGitProjectSettings(discovered);
  return discovered;
}
