import * as fs from "node:fs";
import * as path from "node:path";

import { fail } from "../errors";
import type { Plan } from "../plans/schema";
import {
  getContractHistoryPath,
  getContractSnapshotPath,
  getContractsIndexPath,
  getContractsRoot,
} from "./paths";

export type ContractRecord = {
  id: string;
  intent: string;
  plan: string | null;
  plan_v1?: Plan;
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

type ContractIndexEntry = {
  id: string;
  current_state: string;
  updated_at: string;
  active_version: number | null;
  intent_preview?: string;
};

export const contractStore = {
  contracts: new Map<string, ContractRecord>(),
  nextId: 1,
};

function normalizeContract(raw: any): ContractRecord | null {
  if (!raw || !raw.id) {
    return null;
  }
  const normalized = raw as ContractRecord;
  if (!normalized.plan_v1 && normalized.planJson) {
    normalized.plan_v1 = normalized.planJson;
  }
  if (!normalized.planJson && normalized.plan_v1) {
    normalized.planJson = normalized.plan_v1;
  }
  if (!Array.isArray(normalized.history)) {
    normalized.history = [];
  }
  if (!Array.isArray(normalized.approvals)) {
    normalized.approvals = [];
  }
  if (!Array.isArray(normalized.artifacts)) {
    normalized.artifacts = [];
  }
  if (!Array.isArray(normalized.controlsRequired)) {
    normalized.controlsRequired = [];
  }
  if (!Array.isArray(normalized.controlsApproved)) {
    normalized.controlsApproved = [];
  }
  if (!Array.isArray(normalized.versions)) {
    normalized.versions = [];
  }
  return normalized;
}

function buildIndexEntry(contract: ContractRecord): ContractIndexEntry {
  return {
    id: contract.id,
    current_state: contract.current_state,
    updated_at: String(contract?.timestamps?.updated_at || ""),
    active_version: contract.activeVersion ?? null,
    intent_preview: String(contract.intent || "").slice(0, 160),
  };
}

export function loadStore() {
  const indexPath = getContractsIndexPath();
  try {
    const raw = fs.readFileSync(indexPath, "utf8");
    if (!raw.trim()) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.contracts)) {
      return;
    }
    contractStore.contracts.clear();
    for (const entry of parsed.contracts as ContractIndexEntry[]) {
      const snapshotPath = getContractSnapshotPath(entry.id);
      try {
        const snapshotRaw = fs.readFileSync(snapshotPath, "utf8");
        const contract = normalizeContract(JSON.parse(snapshotRaw));
        if (contract) {
          contractStore.contracts.set(contract.id, contract);
        }
      } catch (error: any) {
        if (error && error.code === "ENOENT") {
          continue;
        }
        throw error;
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
  const contractsRoot = getContractsRoot();
  const indexPath = getContractsIndexPath();
  fs.mkdirSync(contractsRoot, { recursive: true });

  for (const contract of contractStore.contracts.values()) {
    const snapshotPath = getContractSnapshotPath(contract.id);
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.writeFileSync(snapshotPath, JSON.stringify(contract, null, 2));
  }

  const payload = {
    nextId: contractStore.nextId,
    contracts: [...contractStore.contracts.values()].map(buildIndexEntry),
  };
  fs.writeFileSync(indexPath, JSON.stringify(payload, null, 2));
}

export function appendContractHistoryEntry(contractId: string, entry: any) {
  const historyPath = getContractHistoryPath(contractId);
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.appendFileSync(historyPath, `${JSON.stringify(entry)}\n`);
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
