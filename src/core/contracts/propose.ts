import { now } from "../time";
import { contractStore } from "../store/contracts_store";
import { recordHistory } from "./history";

export function proposeContract(intent: string, controlsRequired: string[], idOverride?: string) {
  const id = idOverride || `contract_${contractStore.nextId}`;
  contractStore.nextId += 1;
  const timestamp = now();
  const contract: any = {
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
  const controlsNote = controlsRequired.length
    ? ` Controls required by this proposal: ${controlsRequired.join(", ")}.`
    : " Controls required by this proposal: none.";
  const reason = `Propose a Kairik Contract: "${intent}".${controlsNote}`;
  recordHistory(contract, "DRAFT", reason);
  return contract;
}

