import * as fs from "node:fs";

import { fail } from "../errors";
import type { Plan } from "../plans/schema";
import { getDataDir, getDataFile } from "./paths";

export type ContractRecord = {
  id: string;
  intent: string;
  plan: string | null;
  planJson?: Plan;
  current_state: string;
  history: any[];
  approvals: any[];
  executor_ref: any;
  artifacts: any[];
  controlsRequired: string[];
  controlsApproved: string[];
  activeVersion: number | null;
  versions: any[];
  pauseContext?: any;
  timestamps: {
    created_at: string;
    updated_at: string;
  };
  [key: string]: any;
};

export const contractStore = {
  contracts: new Map<string, ContractRecord>(),
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
        contractStore.contracts.set(contract.id, contract as ContractRecord);
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

export function getContract(id: string): ContractRecord {
  const contract = contractStore.contracts.get(id);
  if (!contract) {
    fail(`Unknown Contract "${id}".`);
  }
  return contract;
}

function parseNumericSuffix(id: string) {
  const match = String(id).match(/(\d+)$/);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function getLastContractId() {
  const contracts = [...contractStore.contracts.values()];
  if (contracts.length === 0) {
    return null;
  }
  const ranked = contracts.map((contract: any, index: number) => {
    const updatedRaw = contract?.timestamps?.updated_at || "";
    const updatedAt = Date.parse(updatedRaw);
    return {
      contract,
      index,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : null,
      numericSuffix: parseNumericSuffix(contract?.id || ""),
    };
  });
  ranked.sort((a, b) => {
    const aUpdated = a.updatedAt ?? Number.NEGATIVE_INFINITY;
    const bUpdated = b.updatedAt ?? Number.NEGATIVE_INFINITY;
    if (aUpdated !== bUpdated) {
      return bUpdated - aUpdated;
    }
    const aNumeric = a.numericSuffix ?? Number.NEGATIVE_INFINITY;
    const bNumeric = b.numericSuffix ?? Number.NEGATIVE_INFINITY;
    if (aNumeric !== bNumeric) {
      return bNumeric - aNumeric;
    }
    if (a.index !== b.index) {
      return b.index - a.index;
    }
    return String(b.contract.id).localeCompare(String(a.contract.id));
  });
  return ranked[0].contract.id;
}
