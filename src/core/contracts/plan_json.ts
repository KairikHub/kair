import type { Plan } from "../plans/schema";
import { getDataFile } from "../store/paths";
import { getContract } from "../store/contracts_store";
import { recordHistory } from "./history";

export function getPlanJsonRef(contractId: string) {
  return `${getDataFile()}#/contracts[id=${contractId}]/plan_v1`;
}

export function setPlanJson(contractId: string, plan: Plan, actor?: string, reason?: string) {
  const contract = getContract(contractId);
  contract.plan_v1 = plan;
  contract.planJson = plan;
  const message = (reason || "").trim() || "Structured plan updated.";
  recordHistory(contract, contract.current_state, message, actor);
  return contract;
}
