import { resolveActor } from "../actor";
import { enforceControls } from "./controls";
import { writeArtifact } from "./artifacts";
import { assertState, logAudit, recordHistory, transition } from "./history";
import { RUN_CHECKPOINTS } from "./constants";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCheckpoints(contract: any, startIndex: number, options: any) {
  for (let i = startIndex; i < RUN_CHECKPOINTS.length; i += 1) {
    const checkpoint = RUN_CHECKPOINTS[i];
    await wait(400);
    logAudit(contract.id, contract.current_state, checkpoint.message);
    if (options.pauseAt && options.pauseAt === checkpoint.id) {
      const actor = resolveActor(options.pauseAuthority);
      const reasonChunks = [
        `Paused Contract execution at ${checkpoint.id}.`,
        `Actor: ${actor}.`,
      ];
      if (options.pauseReason) {
        reasonChunks.push(`Reason: "${options.pauseReason}".`);
      } else {
        reasonChunks.push("Reason: not provided.");
      }
      contract.pauseContext = {
        at: checkpoint.id,
        nextIndex: i + 1,
      };
      transition(contract, "PAUSED", reasonChunks.join(" "), actor);
      return true;
    }
  }
  return false;
}

function finalizeRun(contract: any) {
  const lastApproval = contract.approvals[contract.approvals.length - 1];
  const approver = lastApproval ? lastApproval.approver : "an authorized approver";
  const approvalAt = lastApproval ? lastApproval.at : "an unknown time";
  const planText = contract.plan
    ? `Plan executed: "${contract.plan}".`
    : "Plan text was not recorded.";
  const summary = `Completed because the approved Contract ran through execution and validation checkpoints without failure. ${planText} Approval recorded from ${approver} at ${approvalAt}.`;
  contract.artifacts.push({
    type: "summary",
    content: summary,
  });
  writeArtifact(contract, {
    intent: contract.intent,
    plan: contract.plan,
  });
  contract.pauseContext = null;
  transition(contract, "COMPLETED", "Execution completed successfully for the approved Contract.");
}

export async function runContract(contract: any, options: any = {}) {
  assertState(contract, ["APPROVED"], "run");
  if (!enforceControls(contract, "execution", { fatal: true })) {
    return;
  }
  contract.pauseContext = null;
  transition(contract, "RUNNING", "Execution started for the approved Contract.");
  const paused = await runCheckpoints(contract, 0, options);
  if (paused) {
    return;
  }
  await wait(400);
  finalizeRun(contract);
}

export async function resumeContract(contract: any, authority?: string) {
  assertState(contract, ["PAUSED"], "resume");
  if (!enforceControls(contract, "execution", { fatal: true })) {
    return;
  }
  const actor = resolveActor(authority);
  const pauseContext = contract.pauseContext || { at: "unknown", nextIndex: 0 };
  contract.current_state = "RUNNING";
  recordHistory(
    contract,
    "RESUMED",
    `Resumed Contract execution after pause at ${pauseContext.at}. Actor: ${actor}.`,
    actor
  );
  const paused = await runCheckpoints(contract, pauseContext.nextIndex, {});
  if (paused) {
    return;
  }
  await wait(400);
  finalizeRun(contract);
}

