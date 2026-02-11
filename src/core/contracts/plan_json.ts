import type { Plan } from "../plans/schema";
import { getContract } from "../store/contracts_store";
import { recordHistory } from "./history";

export function setPlanJson(contractId: string, plan: Plan, actor?: string) {
  const contract = getContract(contractId);
  contract.planJson = plan;
  recordHistory(contract, contract.current_state, "Structured plan updated.", actor);
  return contract;
}
