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

describe("e2e: plan non-interactive", () => {
  test("kair plan --interactive=false stores plan_v1 on selected contract", () => {
    const tmp = makeTempRoot();
    const contractId = "plan_noninteractive_demo";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const create = runCli(
        ["contract", "--id", contractId, "Plan non-interactive contract"],
        env
      );
      expect(create.status).toBe(0);

      const planJsonRaw = JSON.stringify({
        version: "kair.plan.v1",
        title: "Non-interactive plan",
        steps: [
          {
            id: "step-prepare",
            summary: "Gather context.",
          },
          {
            id: "step-apply",
            summary: "Implement approved changes.",
          },
        ],
      });

      const planResult = runCli(
        [
          "plan",
          contractId,
          "--interactive=false",
          "--provider",
          "openai",
          "--model",
          "gpt-5.1",
          planJsonRaw,
        ],
        env
      );
      expect(planResult.status).toBe(0);

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(fs.existsSync(after.storePath)).toBe(true);
      expect(after.contract).toBeDefined();
      expect(after.contract.plan_v1).toBeDefined();
      expect(after.contract.plan_v1.version).toBe("kair.plan.v1");
      expect(Array.isArray(after.contract.plan_v1.steps)).toBe(true);
      expect(after.contract.plan_v1.steps.length).toBe(2);

      const review = runCli(["review", contractId], env);
      expect(review.status).toBe(0);
      expect(review.stdout).toContain("APPROVED INTENT");

      const defaultLastPlanRaw = JSON.stringify({
        version: "kair.plan.v1",
        title: "Default last",
        steps: [
          {
            id: "step-only",
            summary: "Default --last path.",
          },
        ],
      });
      const defaultLastResult = runCli(
        ["plan", "--interactive=false", defaultLastPlanRaw],
        env
      );
      expect(defaultLastResult.status).toBe(0);

      const afterDefaultLast = readContractFromStore(tmp.dataDir, contractId);
      expect(afterDefaultLast.contract.plan_v1.steps).toHaveLength(1);
      expect(afterDefaultLast.contract.current_state).toBe("PLANNED");
    } finally {
      tmp.cleanup();
    }
  });

  test("kair plan --interactive=false fails with invalid JSON", () => {
    const tmp = makeTempRoot();
    const contractId = "plan_noninteractive_invalid";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const create = runCli(
        ["contract", "--id", contractId, "Plan invalid JSON contract"],
        env
      );
      expect(create.status).toBe(0);

      const planResult = runCli(["plan", contractId, "--interactive=false", "{bad json"], env);
      expect(planResult.status).not.toBe(0);
      expect(planResult.stderr).toContain("Invalid plan JSON");
    } finally {
      tmp.cleanup();
    }
  });

  test("kair plan --interactive=false with --instructions performs single refine and persists", () => {
    const tmp = makeTempRoot();
    const contractId = "plan_noninteractive_instructions";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const create = runCli(
        ["contract", "--id", contractId, "Plan instructions contract"],
        env
      );
      expect(create.status).toBe(0);

      const planResult = runCli(
        [
          "plan",
          contractId,
          "--interactive=false",
          "--provider",
          "mock",
          "--instructions",
          "Add rollback verification step",
        ],
        env
      );
      expect(planResult.status).toBe(0);

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract.plan_v1).toBeDefined();
      expect(after.contract.plan_v1.version).toBe("kair.plan.v1");
      expect(after.contract.plan_v1.steps.length).toBeGreaterThan(0);
    } finally {
      tmp.cleanup();
    }
  });

  test("kair plan requiring provider fails when neither --provider nor KAIR_LLM_PROVIDER is set", () => {
    const tmp = makeTempRoot();
    const contractId = "plan_noninteractive_missing_provider";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
      KAIR_LLM_PROVIDER: "",
    };

    try {
      const create = runCli(
        ["contract", "--id", contractId, "Plan missing provider contract"],
        env
      );
      expect(create.status).toBe(0);

      const result = runCli(
        [
          "plan",
          contractId,
          "--interactive=false",
          "--instructions",
          "Add rollback verification step",
        ],
        env
      );
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(
        "Missing provider configuration. Set KAIR_LLM_PROVIDER or pass --provider <name>."
      );
    } finally {
      tmp.cleanup();
    }
  });

  test("kair plan --json prints only validated JSON output", () => {
    const tmp = makeTempRoot();
    const contractId = "plan_noninteractive_json_output";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const create = runCli(
        ["contract", "--id", contractId, "Plan json output contract"],
        env
      );
      expect(create.status).toBe(0);

      const planJsonRaw = JSON.stringify({
        version: "kair.plan.v1",
        title: "JSON output mode",
        steps: [
          {
            id: "step-a",
            summary: "Validate json-only output.",
          },
        ],
      });

      const result = runCli(["plan", contractId, "--json", planJsonRaw], env);
      expect(result.status).toBe(0);
      expect(result.stdout).not.toContain("PLAN PREVIEW");
      expect(result.stdout).not.toContain("Structured plan set for Contract");

      const parsedOut = JSON.parse(result.stdout);
      expect(parsedOut.version).toBe("kair.plan.v1");
      expect(parsedOut.steps).toHaveLength(1);
      expect(parsedOut.steps[0].id).toBe("step-a");
      expect(String(result.stdout).trim().startsWith("{")).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });

  test("kair plan --json with --interactive=true fails clearly", () => {
    const tmp = makeTempRoot();
    const contractId = "plan_noninteractive_json_interactive_conflict";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const create = runCli(
        ["contract", "--id", contractId, "Plan json interactive conflict contract"],
        env
      );
      expect(create.status).toBe(0);

      const planJsonRaw = JSON.stringify({
        version: "kair.plan.v1",
        title: "Conflict plan",
        steps: [
          {
            id: "step-a",
            summary: "Conflict check",
          },
        ],
      });

      const result = runCli(
        ["plan", contractId, "--json", "--interactive=true", planJsonRaw],
        env
      );
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("--json cannot be used with --interactive=true");
    } finally {
      tmp.cleanup();
    }
  });

  test("accepted structured plan moves REWOUND contract back to PLANNED", () => {
    const tmp = makeTempRoot();
    const contractId = "plan_rewound_to_planned";
    const actor = "e2e-actor";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: actor,
      KAIR_TEST_MODE: "1",
    };

    try {
      const setup = [
        ["contract", "--id", contractId, "Rewound contract plan retry"],
        ["plan", contractId, "Legacy plan before structured retry"],
        ["propose", contractId],
        ["approve", contractId, "--actor", actor],
      ] as string[][];

      for (const args of setup) {
        const result = runCli(args, env);
        expect(result.status).toBe(0);
      }

      const run = runCli(["run", contractId], env);
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain("Structured plan required; run `kair plan` first.");

      const rewind = runCli(["rewind", contractId, "--actor", actor, "Need new structured plan"], env);
      expect(rewind.status).toBe(0);

      const afterRewind = readContractFromStore(tmp.dataDir, contractId);
      expect(afterRewind.contract.current_state).toBe("REWOUND");

      const planJsonRaw = JSON.stringify({
        version: "kair.plan.v1",
        title: "Recovery plan after rewind",
        steps: [
          {
            id: "step-recover",
            summary: "Regenerate structured plan and move back to PLANNED.",
          },
        ],
      });

      const planResult = runCli(["plan", contractId, "--interactive=false", planJsonRaw], env);
      expect(planResult.status).toBe(0);

      const after = readContractFromStore(tmp.dataDir, contractId);
      expect(after.contract.current_state).toBe("PLANNED");
      expect(after.contract.plan_v1).toBeDefined();
      expect(after.contract.plan_v1.version).toBe("kair.plan.v1");

      const plannedEntries = (after.contract.history || []).filter(
        (entry: any) => entry && entry.state === "PLANNED"
      );
      expect(plannedEntries.length).toBeGreaterThanOrEqual(2);
      expect(
        plannedEntries.some(
          (entry: any) =>
            String(entry.message || "") === "Structured plan accepted; Contract moved to PLANNED."
        )
      ).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });

  test("kair plan --debug prints provider details, prompt artifact path, and dpc artifact path", () => {
    const tmp = makeTempRoot();
    const contractId = "plan_noninteractive_debug";
    const env = {
      KAIR_DATA_DIR: tmp.dataDir,
      KAIR_ARTIFACTS_DIR: tmp.artifactsDir,
      KAIR_ACTOR: "e2e-actor",
      KAIR_TEST_MODE: "1",
    };

    try {
      const create = runCli(
        ["contract", "--id", contractId, "Plan debug contract"],
        env
      );
      expect(create.status).toBe(0);

      const debugResult = runCli(
        [
          "plan",
          contractId,
          "--interactive=false",
          "--provider",
          "mock",
          "--instructions",
          "Add explicit validation step",
          "--debug",
        ],
        env
      );
      expect(debugResult.status).toBe(0);
      expect(debugResult.stdout).toContain("Provider: mock");
      expect(debugResult.stdout).toContain("prompts/");
      expect(debugResult.stdout).toContain("DPC artifact:");
      expect(debugResult.stdout).toContain("/dpc/dpc_v1.json");
      expect(debugResult.stdout).toContain("DPC preview:");
      expect(debugResult.stdout).toContain("DPC (kair.dpc.v1)");

      const jsonRaw = JSON.stringify({
        version: "kair.plan.v1",
        title: "Debug suppressed in json mode",
        steps: [
          {
            id: "step-json",
            summary: "No debug banners in json mode.",
          },
        ],
      });
      const suppressedDebugResult = runCli(
        [
          "plan",
          contractId,
          "--debug",
          "--json",
          jsonRaw,
        ],
        env
      );
      expect(suppressedDebugResult.status).toBe(0);
      expect(suppressedDebugResult.stdout).not.toContain("PLAN DEBUG");
      expect(suppressedDebugResult.stdout).not.toContain("Prompt artifact:");
      expect(suppressedDebugResult.stdout).not.toContain("DPC artifact:");
      expect(suppressedDebugResult.stdout).not.toContain("DPC (kair.dpc.v1)");
      expect(() => JSON.parse(suppressedDebugResult.stdout)).not.toThrow();
    } finally {
      tmp.cleanup();
    }
  });
});
