import * as fs from "node:fs";
import * as path from "node:path";

import { proposeContract } from "../../src/core/contracts/propose";
import { contractStore, loadStore, saveStore } from "../../src/core/store/contracts_store";
import { makeTempRoot } from "../helpers/tmp";

function resetStore() {
  contractStore.contracts.clear();
  contractStore.nextId = 1;
}

describe("integration: persistence store", () => {
  test("writes contracts.json and loads it back with required fields", () => {
    const tmp = makeTempRoot();
    const previousDataDir = process.env.KAIR_DATA_DIR;
    process.env.KAIR_DATA_DIR = tmp.dataDir;

    try {
      resetStore();
      const created = proposeContract("Persist contract state", ["local:read"], "contract_it_1");
      saveStore();

      const dataFile = path.join(tmp.dataDir, "contracts.json");
      expect(fs.existsSync(dataFile)).toBe(true);

      resetStore();
      loadStore();
      const loaded = contractStore.contracts.get(created.id);
      expect(loaded).toBeDefined();
      expect(loaded).toMatchObject({
        id: "contract_it_1",
        intent: "Persist contract state",
        current_state: "DRAFT",
      });
      expect(Array.isArray(loaded.history)).toBe(true);
      expect(Array.isArray(loaded.controlsRequired)).toBe(true);
      expect(loaded.controlsRequired).toEqual(["local:read"]);
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
