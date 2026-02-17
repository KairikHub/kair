import { now } from "../time";
import { contractStore, ContractRecord } from "../store/contracts_store";
import { recordHistory } from "./history";

export function proposeContract(intent: string, controlsRequired: string[] = [], idOverride?: string) {
  const id = idOverride || `contract_${contractStore.nextId}`;
  contractStore.nextId += 1;
  const timestamp = now();
  const contract: ContractRecord = {
    id,
    intent,
    plan: null,
    current_state: "DRAFT",
    history: [],
    approvals: [],
    executor_ref: null,
    artifacts: [],
    controlsRequired: controlsRequired,
    controlsApproved: [],
    activeVersion: null,
    versions: [],
    pauseContext: null,
    timestamps: {
      created_at: timestamp,
      updated_at: timestamp,
    },
  };
  contractStore.contracts.set(id, contract);
  const reason = `Propose a Kair Contract: "${intent}".`;
  recordHistory(contract, "DRAFT", reason);
  return contract;
}
