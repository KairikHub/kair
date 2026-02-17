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

function readPromptArtifactFiles(artifactsDir: string, contractId: string) {
  const promptsDir = path.join(artifactsDir, contractId, "prompts");
  if (!fs.existsSync(promptsDir)) {
    return [];
  }
  return fs.readdirSync(promptsDir).sort();
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
        ["contract", "--id", contractId, "Interactive plan contract"],
        env
      );
      expect(create.status).toBe(0);

      const plan = await runCliInteractive(
        ["plan", contractId, "--provider", "mock"],
        env,
        [
          {
            whenStdoutIncludes: "Plan options [c]ommit [e]dit [p]rompt again: ",
            send: "c\n",
          },
        ]
      );
      expect(plan.status).toBe(0);
      expect(plan.stdout).toContain("Preview current plan");
      expect(plan.stdout).toContain("Plan options [c]ommit [e]dit [p]rompt again: ");

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract).toBeDefined();
      expect(after.contract.plan_v1).toBeDefined();
      expect(after.contract.plan_v1.version).toBe("kair.plan.v1");
      expect(after.contract.plan_v1.steps.length).toBeGreaterThan(0);
      expect(after.contract.current_state).toBe("PLANNED");
      expect(
        after.contract.history.some((entry: any) =>
          String(entry.message || "").startsWith("Plan updated via interactive refine.")
        )
      ).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });

  test("retries after invalid output, refines, then accepts", async () => {
    const tmp = makeTempRoot();
    const contractId = "interactive_plan_refine";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
      KAIR_MOCK_INVALID_FIRST: "1",
    };

    try {
      const create = runCli(
        ["contract", "--id", contractId, "Interactive retry contract"],
        env
      );
      expect(create.status).toBe(0);

      const plan = await runCliInteractive(
        ["plan", contractId, "--provider", "mock"],
        env,
        [
          {
            whenStdoutIncludes: "Provider output invalid. [r]etry or [c]ancel: ",
            send: "r\n",
          },
          {
            whenStdoutIncludes: "Plan options [c]ommit [e]dit [p]rompt again: ",
            send: "e\n",
          },
          {
            whenStdoutIncludes: "Describe manual edits for next refine: ",
            send: "Add safety gate\n",
          },
          {
            whenStdoutIncludes: "add-safety-gate",
            send: "c\n",
          },
        ]
      );
      expect(plan.status).toBe(0);
      expect(plan.stdout).toContain("Provider produced invalid plan JSON:");
      expect(plan.stdout).toContain("Provider output invalid. [r]etry or [c]ancel: ");

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract).toBeDefined();
      expect(after.contract.plan_v1).toBeDefined();
      expect(after.contract.plan_v1.version).toBe("kair.plan.v1");
      expect(after.contract.plan_v1.steps.some((step: any) => step.id === "add-safety-gate")).toBe(
        true
      );
      const promptArtifacts = readPromptArtifactFiles(tmp.artifactsDir, contractId);
      expect(promptArtifacts.length).toBeGreaterThanOrEqual(2);
    } finally {
      tmp.cleanup();
    }
  });

  test("invalid-first cancel exits cleanly without persisting plan", async () => {
    const tmp = makeTempRoot();
    const contractId = "interactive_plan_invalid_cancel";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
      KAIR_MOCK_INVALID_FIRST: "1",
    };

    try {
      const create = runCli(
        ["contract", "--id", contractId, "Interactive invalid cancel contract"],
        env
      );
      expect(create.status).toBe(0);

      const plan = await runCliInteractive(
        ["plan", contractId, "--provider", "mock"],
        env,
        [
          {
            whenStdoutIncludes: "Provider output invalid. [r]etry or [c]ancel: ",
            send: "c\n",
          },
        ]
      );
      expect(plan.status).toBe(0);
      expect(plan.stdout).toContain("Provider produced invalid plan JSON:");
      expect(plan.stdout).toContain("Planning cancelled.");

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract).toBeDefined();
      expect(after.contract.plan_v1).toBeUndefined();

      const promptArtifacts = readPromptArtifactFiles(tmp.artifactsDir, contractId);
      expect(promptArtifacts.length).toBeGreaterThanOrEqual(1);
    } finally {
      tmp.cleanup();
    }
  });

  test("refine uses current plan JSON and preserves step ids for deterministic rename transform", async () => {
    const tmp = makeTempRoot();
    const contractId = "interactive_plan_refine_existing";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const create = runCli(
        ["contract", "--id", contractId, "Interactive refine existing plan contract"],
        env
      );
      expect(create.status).toBe(0);

      const initialPlanRaw = JSON.stringify({
        version: "kair.plan.v1",
        title: "Initial plan",
        steps: [
          {
            id: "step-a",
            summary: "Original step A title",
          },
          {
            id: "step-b",
            summary: "Original step B title",
          },
        ],
      });
      const seedPlan = runCli(["plan", contractId, "--interactive=false", initialPlanRaw], env);
      expect(seedPlan.status).toBe(0);

      const plan = await runCliInteractive(
        ["plan", contractId, "--provider", "mock"],
        env,
        [
          {
            whenStdoutIncludes: "Plan options [c]ommit [e]dit [p]rompt again: ",
            send: "e\n",
          },
          {
            whenStdoutIncludes: "Describe manual edits for next refine: ",
            send: "rename step A title\n",
          },
          {
            whenStdoutIncludes: "Renamed step A title",
            send: "c\n",
          },
        ]
      );
      expect(plan.status).toBe(0);
      expect(plan.stdout).toContain("Preview current plan");
      expect(plan.stdout).toContain("Plan options [c]ommit [e]dit [p]rompt again: ");
      expect(plan.stdout).toContain("Describe manual edits for next refine: ");
      expect((plan.stdout.match(/Preview current plan/g) || []).length).toBeGreaterThanOrEqual(2);
      expect(
        (plan.stdout.match(/Plan options \[c\]ommit \[e\]dit \[p\]rompt again: /g) || []).length
      ).toBeGreaterThanOrEqual(2);

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract).toBeDefined();
      expect(after.contract.plan_v1).toBeDefined();
      expect(after.contract.plan_v1.steps.map((step: any) => step.id)).toEqual(["step-a", "step-b"]);
      expect(after.contract.plan_v1.steps[0].summary).toBe("Renamed step A title");
      expect(after.contract.plan_v1.steps[1].summary).toBe("Original step B title");
      expect(
        after.contract.history.some((entry: any) =>
          String(entry.message || "").startsWith("Plan updated via interactive refine.")
        )
      ).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });

});
