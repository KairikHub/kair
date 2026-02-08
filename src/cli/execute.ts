import { resolveActor } from "../core/actor";
import { fail, warn } from "../core/errors";
import { loadEvidenceIndex } from "../core/contracts/evidence";
import { contractStore, getContract, getLastContractId } from "../core/store/contracts_store";
import {
  describeControls,
  enforceControls,
  normalizeControls,
  parseControls,
  validateControls,
} from "../core/contracts/controls";
import { proposeContract } from "../core/contracts/propose";
import { assertState, recordHistory, transition } from "../core/contracts/history";
import { runContract, resumeContract } from "../core/contracts/run";
import { coPlanContract } from "../core/llm/openai_responses";
import { suggestContractId, validateContractId } from "../core/contracts/ids";
import { appendApprovalVersion, appendRewindVersion } from "../core/contracts/versioning";

import { failWithHelp } from "./errors";
import { parseContractCommand, extractActorFlags, extractProposeOptions, extractRunOptions, normalizePauseAt, requireArgs } from "./argv";
import { printContractHelp, printTopHelp } from "./help";
import { promptForProposeInput } from "./prompt";
import { showContractStatus } from "./status";
import { listContracts } from "./list";
import { renderEvidence, renderReview } from "./review";

export async function executeCommand(tokens: string[], options: any = {}) {
  const parsed = parseContractCommand(tokens);
  const command = parsed.command;
  const rest = parsed.args;
  const isContractGroup = parsed.isContractGroup;
  if (!command) {
    printTopHelp();
    process.exit(0);
  }

  if (command === "-h" || command === "--help") {
    printTopHelp();
    return;
  }

  switch (command) {
    case "propose":
    case "create": {
      if (rest.includes("-h") || rest.includes("--help")) {
        printContractHelp();
        return;
      }
      const { remaining, requiredRaw, idRaw } = extractProposeOptions(rest);
      let intent = remaining.join(" ").trim();
      let id = idRaw.trim();
      const allowPrompt = options.allowPrompt === true;
      const isChained = options.isChained === true;
      if (id) {
        const error = validateContractId(id);
        if (error) {
          fail(error);
        }
        if (contractStore.contracts.has(id)) {
          fail(`Contract id "${id}" already exists.`);
        }
      }
      if (!intent && !allowPrompt) {
        failWithHelp(
          "Missing intent. Provide it as an argument or run interactively in a TTY.",
          "contract"
        );
      }
      if (!intent && allowPrompt) {
        const prompted = await promptForProposeInput({ intent, idRaw: id || "" });
        intent = prompted.intent;
        id = prompted.id;
      }
      if (!intent) {
        fail("Intent cannot be empty.");
      }
      if (!id) {
        id = isChained ? `contract_${contractStore.nextId}` : suggestContractId(intent);
        const error = validateContractId(id);
        if (error) {
          fail(error);
        }
        if (contractStore.contracts.has(id)) {
          fail(`Contract id "${id}" already exists.`);
        }
      }
      const controlsRequired = normalizeControls(parseControls(requiredRaw));
      validateControls(controlsRequired);
      const contract = proposeContract(intent, controlsRequired, id);
      console.log(`Proposed a Kairik Contract: ${contract.id}`);
      console.log(`Intent: ${contract.intent}`);
      console.log(`Active version: ${contract.activeVersion ?? "none"}`);
      console.log(`Next: kair contract plan ${contract.id} "..."`);
      break;
    }
    case "plan": {
      requireArgs(rest, 2, 'contract plan "<contract_id>" "<plan>"');
      const [contractId, ...planParts] = rest;
      const plan = planParts.join(" ").trim();
      if (!plan) {
        fail("Plan cannot be empty.");
      }
      const contract = getContract(contractId);
      assertState(contract, ["DRAFT"], "plan");
      contract.plan = plan;
      transition(contract, "PLANNED", `Plan captured for Contract: "${plan}".`);
      break;
    }
    case "co-plan": {
      requireArgs(rest, 1, 'contract co-plan "<contract_id>"');
      const [contractId] = rest;
      const contract = getContract(contractId);
      assertState(contract, ["DRAFT"], "co-plan");
      const plan = await coPlanContract(contract.intent);
      contract.plan = plan;
      transition(contract, "PLANNED", "Plan generated via LLM co-plan.");
      console.log(`Co-plan complete for ${contract.id}.`);
      console.log(`Plan:\n${plan}`);
      console.log(`Next: kair contract request-approval ${contract.id}`);
      break;
    }
    case "require-controls": {
      requireArgs(rest, 2, 'contract require-controls "<contract_id>" "<controls_csv>"');
      const [contractId, ...controlsParts] = rest;
      const controlsRaw = controlsParts.join(" ").trim();
      if (!controlsRaw) {
        fail("Controls list cannot be empty.");
      }
      const controlsRequired = normalizeControls(parseControls(controlsRaw));
      validateControls(controlsRequired);
      const contract = getContract(contractId);
      contract.controlsRequired = controlsRequired;
      recordHistory(
        contract,
        "CONTROLS",
        `Controls required by this proposal set to: ${describeControls(controlsRequired)}.`
      );
      break;
    }
    case "request-approval": {
      requireArgs(rest, 1, 'contract request-approval "<contract_id>"');
      const [contractId] = rest;
      const contract = getContract(contractId);
      assertState(contract, ["PLANNED"], "request-approval");
      if (!enforceControls(contract, "approval request")) {
        return;
      }
      transition(contract, "AWAITING_APPROVAL", "Approval requested for Contract.");
      break;
    }
    case "approve": {
      const { remaining, actorRaw } = extractActorFlags(rest);
      requireArgs(remaining, 1, 'contract approve "<contract_id>" [--actor <name>]');
      const [contractId, ...legacyParts] = remaining;
      let legacyActor = "";
      if (legacyParts.length > 0) {
        legacyActor = legacyParts.join(" ").trim();
        warn(
          'Positional approver is deprecated. Use "contract approve <id> --actor <name>" instead.'
        );
      }
      if (actorRaw && legacyActor) {
        warn('Both --actor and positional approver provided; using "--actor".');
      }
      const actor = resolveActor(actorRaw || legacyActor);
      const contract = getContract(contractId);
      assertState(contract, ["AWAITING_APPROVAL"], "approve");
      appendApprovalVersion(contract, actor);
      transition(contract, "APPROVED", `Approve a Kairik Contract. Actor: ${actor}.`, actor);
      break;
    }
    case "approve-control":
    case "add-control": {
      const { remaining, actorRaw } = extractActorFlags(rest);
      requireArgs(remaining, 2, 'contract add-control "<contract_id>" "<control>" [--actor <name>]');
      const [contractId, control, ...legacyParts] = remaining;
      let legacyActor = "";
      if (legacyParts.length > 0) {
        legacyActor = legacyParts.join(" ").trim();
        warn(
          'Positional approver is deprecated. Use "contract add-control <id> <control> --actor <name>" instead.'
        );
      }
      if (actorRaw && legacyActor) {
        warn('Both --actor and positional approver provided; using "--actor".');
      }
      const actor = resolveActor(actorRaw || legacyActor);
      validateControls([control]);
      const contract = getContract(contractId);
      if (!contract.controlsApproved.includes(control)) {
        contract.controlsApproved.push(control);
        recordHistory(
          contract,
          "CONTROLS",
          `Control "${control}" approved. Actor: ${actor}.`,
          actor
        );
      } else {
        recordHistory(
          contract,
          "CONTROLS",
          `Control "${control}" reaffirmed. Actor: ${actor}.`,
          actor
        );
      }
      break;
    }
    case "run":
    case "execute": {
      const { remaining, pauseAt, pauseAuthority, pauseReason } = extractRunOptions(rest);
      requireArgs(
        remaining,
        1,
        'contract run "<contract_id>" [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]'
      );
      const [contractId] = remaining;
      const contract = getContract(contractId);
      const normalizedPauseAt = normalizePauseAt(pauseAt);
      await runContract(contract, {
        pauseAt: normalizedPauseAt,
        pauseAuthority: pauseAuthority ? pauseAuthority.trim() : "",
        pauseReason: pauseReason ? pauseReason.trim() : "",
      });
      break;
    }
    case "pause": {
      const { remaining, actorRaw } = extractActorFlags(rest);
      requireArgs(remaining, 1, 'contract pause "<contract_id>" [--actor <name>]');
      const [contractId, ...legacyParts] = remaining;
      let legacyActor = "";
      if (legacyParts.length > 0) {
        legacyActor = legacyParts.join(" ").trim();
        warn('Positional actor is deprecated. Use "contract pause <id> --actor <name>" instead.');
      }
      if (actorRaw && legacyActor) {
        warn('Both --actor and positional actor provided; using "--actor".');
      }
      const actor = resolveActor(actorRaw || legacyActor);
      const contract = getContract(contractId);
      assertState(contract, ["RUNNING"], "pause");
      transition(contract, "PAUSED", `Paused Contract execution. Actor: ${actor}.`, actor);
      break;
    }
    case "resume": {
      const { remaining, actorRaw } = extractActorFlags(rest);
      requireArgs(remaining, 1, 'contract resume "<contract_id>" [--actor <name>]');
      const [contractId, ...legacyParts] = remaining;
      let legacyActor = "";
      if (legacyParts.length > 0) {
        legacyActor = legacyParts.join(" ").trim();
        warn('Positional actor is deprecated. Use "contract resume <id> --actor <name>" instead.');
      }
      if (actorRaw && legacyActor) {
        warn('Both --actor and positional actor provided; using "--actor".');
      }
      const actor = resolveActor(actorRaw || legacyActor);
      const contract = getContract(contractId);
      await resumeContract(contract, actor);
      break;
    }
    case "rewind": {
      const { remaining, actorRaw } = extractActorFlags(rest);
      requireArgs(remaining, 1, 'contract rewind "<contract_id>" [--actor <name>] [<reason>]');
      const [contractId, ...reasonParts] = remaining;
      const contract = getContract(contractId);
      assertState(contract, ["RUNNING", "PAUSED", "FAILED", "COMPLETED"], "rewind");
      let legacyActor = "";
      let reasonText = "";
      if (!actorRaw && reasonParts.length >= 2) {
        legacyActor = reasonParts[0].trim();
        reasonText = reasonParts.slice(1).join(" ").trim();
        warn(
          'Positional actor is deprecated. Use "contract rewind <id> --actor <name> <reason>" instead.'
        );
      } else if (reasonParts.length >= 1) {
        reasonText = reasonParts.join(" ").trim();
      }
      if (actorRaw && legacyActor) {
        warn('Both --actor and positional actor provided; using "--actor".');
      }
      const actor = resolveActor(actorRaw || legacyActor);
      appendRewindVersion(contract, actor);
      const reasonChunks = [
        "Rewind a Kairik Contract because a rewind was requested.",
        `Actor: ${actor}.`,
      ];
      if (reasonText) {
        reasonChunks.push(`Reason: "${reasonText}".`);
      } else {
        reasonChunks.push("Reason: not provided.");
      }
      transition(contract, "REWOUND", reasonChunks.join(" "), actor);
      break;
    }
    case "status": {
      requireArgs(rest, 1, 'contract status "<contract_id>"');
      const [contractId] = rest;
      const contract = getContract(contractId);
      showContractStatus(contract);
      break;
    }
    case "review": {
      let contractId = "";
      if (isContractGroup) {
        requireArgs(rest, 1, 'contract review "<contract_id>"');
        contractId = rest[0];
      } else if (rest[0] === "--last") {
        const lastId = getLastContractId();
        if (!lastId) {
          fail("No Contracts found.");
        }
        contractId = lastId;
      } else if (rest.length >= 1) {
        contractId = rest[0];
      } else {
        fail('Missing arguments. Usage: review --last');
      }
      const contract = getContract(contractId);
      let evidenceItems: any[] = [];
      try {
        evidenceItems = loadEvidenceIndex(contract.id);
      } catch (error: any) {
        fail(`Failed to load evidence for Contract "${contract.id}": ${error.message}`);
      }
      console.log(renderReview(contract, evidenceItems));
      break;
    }
    case "accept": {
      const { remaining, actorRaw } = extractActorFlags(rest);
      requireArgs(remaining, 1, 'contract accept "<contract_id>" [--actor <name>]');
      const [contractId, ...legacyParts] = remaining;
      let legacyActor = "";
      if (legacyParts.length > 0) {
        legacyActor = legacyParts.join(" ").trim();
        warn(
          'Positional actor is deprecated. Use "contract accept <id> --actor <name>" instead.'
        );
      }
      if (actorRaw && legacyActor) {
        warn('Both --actor and positional actor provided; using "--actor".');
      }
      const actor = resolveActor(actorRaw || legacyActor);
      const contract = getContract(contractId);
      recordHistory(
        contract,
        contract.current_state,
        `Accepted responsibility for evidence-backed review. Actor: ${actor}.`,
        actor
      );
      console.log(`Accepted responsibility for Contract ${contract.id}. Actor: ${actor}.`);
      break;
    }
    case "evidence": {
      requireArgs(rest, 1, 'contract evidence "<contract_id>"');
      const [contractId] = rest;
      const contract = getContract(contractId);
      let evidenceItems: any[] = [];
      try {
        evidenceItems = loadEvidenceIndex(contract.id);
      } catch (error: any) {
        fail(`Failed to load evidence for Contract "${contract.id}": ${error.message}`);
      }
      console.log(renderEvidence(contract, evidenceItems));
      break;
    }
    case "list": {
      requireArgs(rest, 0, "contract list");
      listContracts();
      break;
    }
    default:
      if (isContractGroup) {
        failWithHelp(`Unknown contract subcommand "${command}".`, "contract");
      } else {
        failWithHelp(`Unknown command "${command}".`, "top");
      }
  }
}
