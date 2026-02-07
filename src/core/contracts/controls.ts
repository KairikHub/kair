import { fail } from "../errors";
import { recordHistory } from "./history";
import { CONTROL_REGISTRY } from "./constants";

export function parseControls(input: string) {
  if (!input) {
    return [];
  }
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeControls(list: string[]) {
  const seen = new Set();
  const result: string[] = [];
  for (const item of list) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

export function validateControls(list: string[]) {
  const invalid = list.filter((control) => !CONTROL_REGISTRY.has(control));
  if (invalid.length > 0) {
    fail(`Unknown Controls: ${invalid.join(", ")}. Allowed: ${[...CONTROL_REGISTRY].join(", ")}.`);
  }
}

export function missingControls(contract: any) {
  const approved = new Set(contract.controlsApproved);
  return contract.controlsRequired.filter((control: string) => !approved.has(control));
}

export function describeControls(list: string[]) {
  return list.length === 0 ? "none" : list.join(", ");
}

export function enforceControls(contract: any, context: string, options: any = {}) {
  const missing = missingControls(contract);
  if (missing.length > 0) {
    const message = `Blocked: proposal requires controls not approved: ${missing.join(
      ", "
    )}. Resolution paths: revise the proposal; add/approve the required controls; rewind the Contract to update authority; or fork into a new Contract.`;
    recordHistory(contract, "CONTROLS", message);
    if (options.fatal) {
      fail(`Contract "${contract.id}" blocked due to missing controls: ${missing.join(", ")}.`);
    }
    return false;
  }
  recordHistory(
    contract,
    "CONTROLS",
    `Controls check passed for ${context}. Required: ${describeControls(
      contract.controlsRequired
    )}. Approved: ${describeControls(contract.controlsApproved)}.`
  );
  return true;
}

