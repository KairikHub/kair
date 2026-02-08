#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const tsxBin = path.join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx"
);

const args = process.argv.slice(2);
const result = spawnSync(tsxBin, [path.join(root, "src", "kair.ts"), ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    PATH: `${path.join(root, "node_modules", ".bin")}:${process.env.PATH || ""}`,
  },
});

if (result.error) {
  console.error(`Error: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
