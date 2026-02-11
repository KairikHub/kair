import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { runCli } from "../helpers/cli";
import { makeTempRoot } from "../helpers/tmp";

function readContractFromStore(dataDir: string, contractId: string) {
  const storePath = path.join(dataDir, "contracts.json");
  const raw = fs.readFileSync(storePath, "utf8");
  const parsed = JSON.parse(raw);
  const contract = (parsed.contracts || []).find((item: any) => item.id === contractId);
  return { storePath, contract, parsed };
}

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
    const child = spawn(command, ["run", "kair", "--", ...args], {
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

describe("e2e: interactive plan", () => {
  test("accepts provider-generated plan in interactive mode with mock provider", async () => {
    const tmp = makeTempRoot();
    const contractId = "interactive_plan_accept";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const create = runCli(
        ["contract", "create", "--id", contractId, "Interactive plan contract"],
        env
      );
      expect(create.status).toBe(0);

      const plan = await runCliInteractive(
        ["plan", contractId, "--provider", "mock"],
        env,
        [
          {
            whenStdoutIncludes: "Plan options [a]ccept [r]etry [e]dit [c]ancel:",
            send: "a\n",
          },
        ]
      );
      expect(plan.status).toBe(0);

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract).toBeDefined();
      expect(after.contract.planJson).toBeDefined();
      expect(after.contract.planJson.version).toBe("kair.plan.v1");
      expect(after.contract.planJson.steps.length).toBeGreaterThan(0);
    } finally {
      tmp.cleanup();
    }
  });

  test("retries once after invalid mock output then accepts", async () => {
    const tmp = makeTempRoot();
    const contractId = "interactive_plan_retry";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
      KAIR_MOCK_INVALID_FIRST: "1",
    };

    try {
      const create = runCli(
        ["contract", "create", "--id", contractId, "Interactive retry contract"],
        env
      );
      expect(create.status).toBe(0);

      const plan = await runCliInteractive(
        ["plan", contractId, "--provider", "mock"],
        env,
        [
          {
            whenStdoutIncludes: "Provider output invalid. [r]etry or [c]ancel:",
            send: "r\n",
          },
          {
            whenStdoutIncludes: "Plan options [a]ccept [r]etry [e]dit [c]ancel:",
            send: "a\n",
          },
        ]
      );
      expect(plan.status).toBe(0);
      expect(plan.stdout).toContain("Provider produced invalid plan JSON");

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract).toBeDefined();
      expect(after.contract.planJson).toBeDefined();
      expect(after.contract.planJson.version).toBe("kair.plan.v1");
    } finally {
      tmp.cleanup();
    }
  });
});
