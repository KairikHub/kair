import * as fs from "node:fs";
import * as path from "node:path";

import type { Plan } from "../plans/schema";
import { getContractPlanJsonPath } from "../store/paths";
import { getContract } from "../store/contracts_store";
import { recordHistory } from "./history";

export function getPlanJsonRef(contractId: string) {
  return `${getContractPlanJsonPath(contractId)}#/`;
}

export function setPlanJson(contractId: string, plan: Plan, actor?: string, reason?: string) {
  const contract = getContract(contractId);
  contract.plan_v1 = plan;
  contract.planJson = plan;
  const planJsonPath = getContractPlanJsonPath(contractId);
  fs.mkdirSync(path.dirname(planJsonPath), { recursive: true });
  fs.writeFileSync(planJsonPath, JSON.stringify(plan, null, 2));
  const message = (reason || "").trim() || "Structured plan updated.";
  recordHistory(contract, contract.current_state, message, actor);
  return contract;
}
