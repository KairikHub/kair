import * as fs from "node:fs";
import * as path from "node:path";

import { proposeContract } from "../../src/core/contracts/propose";
import { PLAN_VERSION, Plan } from "../../src/core/plans/schema";
import { contractStore, loadStore, saveStore } from "../../src/core/store/contracts_store";
import { makeTempRoot } from "../helpers/tmp";

function resetStore() {
  contractStore.contracts.clear();
  contractStore.nextId = 1;
}

describe("integration: planJson persistence", () => {
  test("persists and reloads planJson on contract", () => {
    const tmp = makeTempRoot();
    const previousDataDir = process.env.KAIR_DATA_DIR;
    process.env.KAIR_DATA_DIR = tmp.dataDir;

    try {
      resetStore();
      const contract = proposeContract("Persist structured plan", [], "contract_planjson_it");
      const planJson: Plan = {
        version: PLAN_VERSION,
        title: "Structured plan",
        steps: [
          {
            id: "step_1",
            title: "Prepare",
            description: "Gather context.",
          },
          {
            id: "step_2",
            title: "Execute",
            description: "Apply approved changes.",
            depends_on: ["step_1"],
          },
        ],
        notes: ["Keep deterministic"],
      };

      contract.planJson = planJson;
      saveStore();

      resetStore();
      loadStore();

      const loaded = contractStore.contracts.get(contract.id);
      expect(loaded).toBeDefined();
      expect(loaded?.planJson).toEqual(planJson);
      expect(loaded?.planJson?.version).toBe(PLAN_VERSION);
      expect(loaded?.planJson?.steps).toHaveLength(2);
    } finally {
      if (previousDataDir === undefined) {
        delete process.env.KAIR_DATA_DIR;
      } else {
        process.env.KAIR_DATA_DIR = previousDataDir;
      }
      resetStore();
      tmp.cleanup();
    }
  });

  test("loads legacy contracts.json with string plan and no planJson", () => {
    const tmp = makeTempRoot();
    const previousDataDir = process.env.KAIR_DATA_DIR;
    process.env.KAIR_DATA_DIR = tmp.dataDir;

    try {
      resetStore();
      const dataFile = path.join(tmp.dataDir, "contracts.json");
      const legacyPayload = {
        nextId: 2,
        contracts: [
          {
            id: "legacy_contract",
            intent: "Legacy contract",
            plan: "legacy string plan",
            current_state: "PLANNED",
            history: [],
            approvals: [],
            executor_ref: null,
            artifacts: [],
            controlsRequired: [],
            controlsApproved: [],
            activeVersion: null,
            versions: [],
            pauseContext: null,
            timestamps: {
              created_at: "2026-02-10T00:00:00.000Z",
              updated_at: "2026-02-10T00:00:00.000Z",
            },
          },
        ],
      };
      fs.writeFileSync(dataFile, JSON.stringify(legacyPayload, null, 2));

      expect(() => loadStore()).not.toThrow();
      const loaded = contractStore.contracts.get("legacy_contract");
      expect(loaded).toBeDefined();
      expect(loaded?.plan).toBe("legacy string plan");
      expect(loaded?.planJson).toBeUndefined();
    } finally {
      if (previousDataDir === undefined) {
        delete process.env.KAIR_DATA_DIR;
      } else {
        process.env.KAIR_DATA_DIR = previousDataDir;
      }
      resetStore();
      tmp.cleanup();
    }
  });
});
