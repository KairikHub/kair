import * as fs from "node:fs";

import { fail } from "../errors";
import { getDataDir, getDataFile } from "./paths";

export const contractStore = {
  contracts: new Map(),
  nextId: 1,
};

export function loadStore() {
  const dataFile = getDataFile();
  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    if (!raw.trim()) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.contracts)) {
      return;
    }
    contractStore.contracts.clear();
    for (const contract of parsed.contracts) {
      if (contract && contract.id) {
        contractStore.contracts.set(contract.id, contract);
      }
    }
    contractStore.nextId = Number(parsed.nextId) || contractStore.contracts.size + 1;
  } catch (error: any) {
    if (error && error.code === "ENOENT") {
      return;
    }
    fail(`Failed to load contracts store: ${error.message}`);
  }
}

export function saveStore() {
  const dataDir = getDataDir();
  const dataFile = getDataFile();
  fs.mkdirSync(dataDir, { recursive: true });
  const payload = {
    nextId: contractStore.nextId,
    contracts: [...contractStore.contracts.values()],
  };
  fs.writeFileSync(dataFile, JSON.stringify(payload, null, 2));
}

export function getContract(id: string) {
  const contract = contractStore.contracts.get(id);
  if (!contract) {
    fail(`Unknown Contract "${id}".`);
  }
  return contract;
}
