import * as fs from "node:fs";
import * as path from "node:path";

import { fail } from "../errors";

export const DATA_DIR = path.join(process.cwd(), "data");
export const DATA_FILE = path.join(DATA_DIR, "contracts.json");

export const contractStore = {
  contracts: new Map(),
  nextId: 1,
};

export function loadStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
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
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload = {
    nextId: contractStore.nextId,
    contracts: [...contractStore.contracts.values()],
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2));
}

export function getContract(id: string) {
  const contract = contractStore.contracts.get(id);
  if (!contract) {
    fail(`Unknown Contract "${id}".`);
  }
  return contract;
}

