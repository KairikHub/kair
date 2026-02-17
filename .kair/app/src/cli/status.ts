import { now } from "../core/time";
import { describeControls, missingControls } from "../core/contracts/controls";
import { COLORS, formatState, heading, label, style } from "./format";

function describePlan(contract: any) {
  const structuredPlan = contract?.plan_v1 || contract?.planJson;
  if (
    structuredPlan &&
    structuredPlan.version === "kair.plan.v1" &&
    Array.isArray(structuredPlan.steps)
  ) {
    const title = typeof structuredPlan.title === "string" ? structuredPlan.title : "(untitled)";
    return `kair.plan.v1 | ${title} | ${structuredPlan.steps.length} step(s)`;
  }
  if (contract?.plan) {
    return String(contract.plan);
  }
  return "none";
}

export function showContractStatus(contract: any) {
  const timestamp = now();
  console.log(`${timestamp} | ${contract.id} | STATUS | Audit report generated.`);
  console.log(`\n${heading("Contract Summary")}`);
  console.log(`${label("Contract")}: ${contract.id}`);
  console.log(`${label("Created")}: ${contract.timestamps.created_at}`);
  console.log(`${label("Last updated")}: ${contract.timestamps.updated_at}`);
  console.log(`${label("Intent")}: ${contract.intent}`);
  console.log(`${label("Plan")}: ${describePlan(contract)}`);
  console.log(`${label("Current state")}: ${formatState(contract.current_state)}`);
  console.log(`${label("Active version")}: ${contract.activeVersion ?? "none"}`);
  if (contract.current_state === "PAUSED" && contract.pauseContext?.at) {
    console.log(`${label("Paused at")}: ${contract.pauseContext.at}`);
  }
  console.log(`${label("Controls required")}: ${describeControls(contract.controlsRequired)}`);
  console.log(`${label("Controls approved")}: ${describeControls(contract.controlsApproved)}`);
  const missing = missingControls(contract);
  console.log(`${label("Controls missing")}: ${describeControls(missing)}`);
  const gatingSummary = missing.length
    ? style(`BLOCKED (missing: ${missing.join(", ")})`, COLORS.red, COLORS.bold)
    : style("CLEAR", COLORS.green, COLORS.bold);
  const activeLabel = contract.activeVersion ? `v${contract.activeVersion}` : "none";
  console.log(
    `${label("Summary")}: Active version ${activeLabel}. Controls gating: ${gatingSummary}.`
  );
  console.log(`\n${heading("Approvals")}`);
  if (contract.approvals.length === 0) {
    console.log("- none recorded");
  } else {
    for (const approval of contract.approvals) {
      const actor = approval.actor || approval.approver || "unknown";
      console.log(`- ${approval.at} | ${actor}`);
    }
  }
  console.log(`\n${heading("Versions (append-only)")}`);
  if (contract.versions.length === 0) {
    console.log("- none recorded");
  } else {
    for (const version of contract.versions) {
      const activeMark = version.version === contract.activeVersion ? " (active)" : "";
      console.log(
        `- v${version.version}${activeMark} | ${version.kind} | ${version.at} | ${version.note}`
      );
    }
  }
  console.log(`\n${heading("Rewinds")}`);
  const rewindEntries = contract.history.filter((entry: any) => entry.state === "REWOUND");
  if (rewindEntries.length === 0) {
    console.log("- none recorded");
  } else {
    for (const entry of rewindEntries) {
      console.log(`- ${entry.at} | ${entry.message}`);
    }
  }
  console.log(`\n${heading("History (append-only)")}`);
  for (const entry of contract.history) {
    const stateText = formatState(entry.state);
    const actor = entry.actor ? ` | actor: ${entry.actor}` : "";
    console.log(`- ${entry.at} | ${stateText}${actor} | ${entry.message}`);
  }
  console.log(`\n${heading("Artifacts")}`);
  if (contract.artifacts.length === 0) {
    console.log("- none recorded");
  } else {
    for (const artifact of contract.artifacts) {
      console.log(`- ${artifact.type} | ${artifact.content}`);
    }
  }
}
