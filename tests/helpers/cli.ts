import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

type CliResult = {
  status: number;
  stdout: string;
  stderr: string;
};

function readPackageScripts() {
  const packagePath = path.join(process.cwd(), "package.json");
  const raw = fs.readFileSync(packagePath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed?.scripts || {};
}

function resolveInvocation() {
  const scripts = readPackageScripts();
  if (typeof scripts.kairik === "string") {
    return {
      command: process.platform === "win32" ? "npm.cmd" : "npm",
      prefixArgs: ["run", "kairik", "--"],
    };
  }
  const firstMatch = Object.entries(scripts).find(([, value]) =>
    typeof value === "string" ? value.includes("kairik") : false
  );
  if (firstMatch) {
    return {
      command: process.platform === "win32" ? "npm.cmd" : "npm",
      prefixArgs: ["run", firstMatch[0], "--"],
    };
  }
  return {
    command: process.platform === "win32" ? "node.exe" : "node",
    prefixArgs: [path.join(process.cwd(), "bin", "kairik.cjs")],
  };
}

export function runCli(args: string[], envOverrides: Record<string, string> = {}): CliResult {
  const invocation = resolveInvocation();
  const result = spawnSync(invocation.command, [...invocation.prefixArgs, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...envOverrides,
    },
    encoding: "utf8",
  });

  if (result.error) {
    return {
      status: -1,
      stdout: String(result.stdout || ""),
      stderr: result.error.message,
    };
  }

  return {
    status: result.status ?? -1,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
  };
}
