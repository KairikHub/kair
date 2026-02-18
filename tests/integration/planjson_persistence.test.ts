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

describe("integration: structured plan persistence", () => {
  test("persists and reloads plan_v1 on contract", () => {
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
            id: "step-prepare",
            summary: "Gather context.",
          },
          {
            id: "step-execute",
            summary: "Apply approved changes.",
          },
        ],
      };

      contract.plan_v1 = planJson;
      saveStore();

      resetStore();
      loadStore();

      const loaded = contractStore.contracts.get(contract.id);
      expect(loaded).toBeDefined();
      expect(loaded?.plan_v1).toEqual(planJson);
      expect(loaded?.plan_v1?.version).toBe(PLAN_VERSION);
      expect(loaded?.plan_v1?.steps).toHaveLength(2);
      expect(loaded?.planJson).toEqual(planJson);
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

  test("loads index entry + contract snapshot", () => {
    const tmp = makeTempRoot();
    const previousDataDir = process.env.KAIR_DATA_DIR;
    process.env.KAIR_DATA_DIR = tmp.dataDir;

    try {
      resetStore();
      const dataFile = path.join(tmp.dataDir, "index.json");
      const indexPayload = {
        nextId: 2,
        contracts: [
          {
            id: "legacy_contract",
            current_state: "PLANNED",
            updated_at: "2026-02-10T00:00:00.000Z",
            active_version: null,
          },
        ],
      };
      fs.writeFileSync(dataFile, JSON.stringify(indexPayload, null, 2));
      fs.mkdirSync(path.join(tmp.dataDir, "legacy_contract"), { recursive: true });
      fs.writeFileSync(
        path.join(tmp.dataDir, "legacy_contract", "contract.json"),
        JSON.stringify(
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
          null,
          2
        )
      );

      expect(() => loadStore()).not.toThrow();
      const loaded = contractStore.contracts.get("legacy_contract");
      expect(loaded).toBeDefined();
      expect(loaded?.plan).toBe("legacy string plan");
      expect(loaded?.planJson).toBeUndefined();
      expect(loaded?.plan_v1).toBeUndefined();
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
