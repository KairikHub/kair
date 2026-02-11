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
  test("kair plan --interactive=false stores planJson on selected contract", () => {
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
        ["contract", "create", "--id", contractId, "Plan non-interactive contract"],
        env
      );
      expect(create.status).toBe(0);

      const planJsonRaw = JSON.stringify({
        version: "kair.plan.v1",
        title: "Non-interactive plan",
        steps: [
          {
            id: "step_prepare",
            title: "Prepare",
            description: "Gather context.",
          },
          {
            id: "step_apply",
            title: "Apply",
            description: "Implement approved changes.",
            depends_on: ["step_prepare"],
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
      expect(after.contract.planJson).toBeDefined();
      expect(after.contract.planJson.version).toBe("kair.plan.v1");
      expect(Array.isArray(after.contract.planJson.steps)).toBe(true);
      expect(after.contract.planJson.steps.length).toBe(2);

      const review = runCli(["review", contractId], env);
      expect(review.status).toBe(0);
      expect(review.stdout).toContain("APPROVED INTENT");

      const defaultLastPlanRaw = JSON.stringify({
        version: "kair.plan.v1",
        steps: [
          {
            id: "step_only",
            title: "Only",
            description: "Default --last path.",
          },
        ],
      });
      const defaultLastResult = runCli(
        ["plan", "--interactive=false", defaultLastPlanRaw],
        env
      );
      expect(defaultLastResult.status).toBe(0);

      const afterDefaultLast = readContractFromStore(tmp.dataDir, contractId);
      expect(afterDefaultLast.contract.planJson.steps).toHaveLength(1);

      const interactiveNotImplemented = runCli(["plan", contractId, planJsonRaw], env);
      expect(interactiveNotImplemented.status).not.toBe(0);
      expect(interactiveNotImplemented.stderr).toContain(
        "Interactive planning not implemented yet. Use --interactive=false with a JSON plan input."
      );
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
        ["contract", "create", "--id", contractId, "Plan invalid JSON contract"],
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
});
