import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

describe("integration: openclaw npm package smoke", () => {
  test("openclaw package is resolvable from node_modules", () => {
    const entryPath = require.resolve("openclaw");

    expect(entryPath).toContain("node_modules/openclaw");
    expect(fs.existsSync(entryPath)).toBe(true);
  });

  test("openclaw can be imported by node", () => {
    const script = `
      import("openclaw")
        .then((mod) => {
          if (!mod || typeof mod !== "object" || Object.keys(mod).length === 0) {
            process.exit(1);
          }
          process.exit(0);
        })
        .catch(() => process.exit(1));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
  });

  test("openclaw CLI binary is present in node_modules/.bin", () => {
    const binaryPath = path.join(process.cwd(), "node_modules", ".bin", "openclaw");
    expect(fs.existsSync(binaryPath)).toBe(true);
  });

  test("openclaw CLI help command executes", () => {
    const cliEntry = path.join(process.cwd(), "node_modules", "openclaw", "openclaw.mjs");
    const result = spawnSync(process.execPath, [cliEntry, "--help"], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 60_000,
    });

    expect(result.status).toBe(0);
    expect(String(result.stdout || "")).toContain("Usage: openclaw");
  });
});
