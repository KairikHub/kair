import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

type ScriptedInput = {
  whenStdoutIncludes: string;
  send: string;
};

function runCliInteractive(
  args: string[],
  envOverrides: Record<string, string>,
  script: ScriptedInput[]
) {
  return new Promise<{ status: number; stdout: string; stderr: string }>((resolve) => {
    const command = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(command, ["run", "--silent", "kair", "--", ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...envOverrides,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let scriptIndex = 0;

    function maybeSendScriptedInput() {
      while (scriptIndex < script.length) {
        const next = script[scriptIndex];
        if (!stdout.includes(next.whenStdoutIncludes)) {
          return;
        }
        child.stdin.write(next.send);
        scriptIndex += 1;
      }
      if (scriptIndex >= script.length) {
        child.stdin.end();
      }
    }

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      maybeSendScriptedInput();
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      resolve({
        status: code ?? -1,
        stdout,
        stderr,
      });
    });
  });
}

describe("e2e: plan dpc persistence", () => {
  test("creates dpc on plan generate and appends evidence on refine", async () => {
    const tmp = makeTempRoot();
    const contractId = "plan_dpc_e2e";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const create = runCli(
        ["contract", "--id", contractId, "Plan DPC e2e contract"],
        env
      );
      expect(create.status).toBe(0);

      const initialPlan = await runCliInteractive(
        ["plan", contractId, "--provider", "mock"],
        env,
        [
          {
            whenStdoutIncludes: "Plan options [a]ccept [r]efine [c]ancel: ",
            send: "a\n",
          },
        ]
      );
      expect(initialPlan.status).toBe(0);

      const dpcPath = path.join(tmp.artifactsDir, contractId, "dpc", "dpc_v1.json");
      expect(fs.existsSync(dpcPath)).toBe(true);
      const initialDpc = JSON.parse(fs.readFileSync(dpcPath, "utf8"));
      expect(initialDpc.version).toBe("kair.dpc.v1");
      expect(Array.isArray(initialDpc.evidence)).toBe(true);
      expect(initialDpc.evidence.length).toBeGreaterThanOrEqual(1);
      expect(initialDpc.evidence.some((item: any) => item?.kind === "prompt")).toBe(true);

      const initialEvidenceCount = initialDpc.evidence.length;

      const refinedPlan = await runCliInteractive(
        ["plan", contractId, "--provider", "mock"],
        env,
        [
          {
            whenStdoutIncludes: "Plan options [a]ccept [r]efine [c]ancel: ",
            send: "r\n",
          },
          {
            whenStdoutIncludes: "Explain changes: ",
            send: "rename step A title\n",
          },
          {
            whenStdoutIncludes: "Renamed step A title",
            send: "a\n",
          },
        ]
      );
      expect(refinedPlan.status).toBe(0);

      const afterRefineDpc = JSON.parse(fs.readFileSync(dpcPath, "utf8"));
      expect(Array.isArray(afterRefineDpc.evidence)).toBe(true);
      expect(afterRefineDpc.evidence.length).toBeGreaterThan(initialEvidenceCount);
    } finally {
      tmp.cleanup();
    }
  });
});
