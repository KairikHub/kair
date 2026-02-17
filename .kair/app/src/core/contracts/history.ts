import { fail } from "../errors";
import { saveStore } from "../store/contracts_store";
import { now } from "../time";
import { STATES } from "./constants";

export function logAudit(contractId: string, label: string, message: string, timestamp = now()) {
  if (process.env.KAIR_TEST_MODE) return;
  if (process.env.VITEST === "1") return;
  if ((process.env.KAIR_SUPPRESS_AUDIT_LOGS || "").trim() === "1") return;
  console.log(`${timestamp} | ${contractId} | ${label} | ${message}`);
}

export function assertState(contract: any, allowed: string[], action: string) {
  if (!allowed.includes(contract.current_state)) {
    fail(
      `Cannot ${action} Contract "${contract.id}" because state is ${contract.current_state}. Allowed: ${allowed.join(
        ", "
      )}.`
    );
  }
}

export function recordHistory(contract: any, label: string, message: string, actor?: string) {
  const timestamp = now();
  contract.timestamps.updated_at = timestamp;
  const entry: any = {
    at: timestamp,
    state: label,
    message,
  };
  if (actor) {
    entry.actor = actor;
  }
  contract.history.push(entry);
  logAudit(contract.id, label, message, timestamp);
  saveStore();
}

export function transition(contract: any, nextState: string, reason: string, actor?: string) {
  if (!STATES.includes(nextState)) {
    fail(`Invalid state "${nextState}".`);
  }
  contract.current_state = nextState;
  recordHistory(contract, nextState, reason, actor);
}
