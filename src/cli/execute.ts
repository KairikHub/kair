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
import { setPlanJson } from "../core/contracts/plan_json";
import { runContract, resumeContract } from "../core/contracts/run";
import { parseAndValidatePlanJson } from "../core/plans/validate";
import { getProvider, normalizeProviderName } from "../core/providers/registry";
import { suggestContractId, validateContractId } from "../core/contracts/ids";
import { appendApprovalVersion, appendRewindVersion } from "../core/contracts/versioning";

import { failWithHelp } from "./errors";
import { parseContractCommand, extractActorFlags, extractProposeOptions, extractRunOptions, normalizePauseAt, requireArgs } from "./argv";
import { printContractHelp, printTopHelp } from "./help";
import { promptForProposeInput } from "./prompt";
import { showContractStatus } from "./status";
import { listContracts } from "./list";
import { renderEvidence, renderReview } from "./review";

type ParsedTopLevelPlanOptions = {
  contractIdRaw: string;
  planInputRaw: string;
  providerRaw: string;
  modelRaw: string;
  interactive: boolean;
  last: boolean;
  actorRaw: string;
};

function parseBooleanFlag(value: string, flagName: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  fail(`Invalid value for ${flagName}: ${value}. Use true or false.`);
}

function parseTopLevelPlanOptions(args: string[]): ParsedTopLevelPlanOptions {
  const positional: string[] = [];
  let providerRaw = "";
  let modelRaw = "";
  let interactive = true;
  let last = false;
  let actorRaw = "";

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--last") {
      last = true;
      continue;
    }
    if (token === "--provider") {
      providerRaw = (args[i + 1] || "").trim();
      i += 1;
      if (!providerRaw) {
        fail("Missing value for --provider.");
      }
      continue;
    }
    if (token.startsWith("--provider=")) {
      providerRaw = token.slice("--provider=".length).trim();
      if (!providerRaw) {
        fail("Missing value for --provider.");
      }
      continue;
    }
    if (token === "--model") {
      modelRaw = (args[i + 1] || "").trim();
      i += 1;
      if (!modelRaw) {
        fail("Missing value for --model.");
      }
      continue;
    }
    if (token.startsWith("--model=")) {
      modelRaw = token.slice("--model=".length).trim();
      if (!modelRaw) {
        fail("Missing value for --model.");
      }
      continue;
    }
    if (token === "--interactive") {
      const raw = (args[i + 1] || "").trim();
      i += 1;
      if (!raw) {
        fail("Missing value for --interactive.");
      }
      interactive = parseBooleanFlag(raw, "--interactive");
      continue;
    }
    if (token.startsWith("--interactive=")) {
      const raw = token.slice("--interactive=".length).trim();
      if (!raw) {
        fail("Missing value for --interactive.");
      }
      interactive = parseBooleanFlag(raw, "--interactive");
      continue;
    }
    if (token === "--actor" || token === "--by") {
      actorRaw = (args[i + 1] || "").trim();
      i += 1;
      if (!actorRaw) {
        fail(`Missing value for ${token}.`);
      }
      continue;
    }
    if (token.startsWith("--actor=")) {
      actorRaw = token.slice("--actor=".length).trim();
      if (!actorRaw) {
        fail("Missing value for --actor.");
      }
      continue;
    }
    if (token.startsWith("--by=")) {
      actorRaw = token.slice("--by=".length).trim();
      if (!actorRaw) {
        fail("Missing value for --by.");
      }
      continue;
    }
    positional.push(token);
  }

  let contractIdRaw = "";
  let planInputRaw = "";
  if (positional.length === 1) {
    if (positional[0].trim().startsWith("{")) {
      planInputRaw = positional[0];
    } else {
      contractIdRaw = positional[0];
    }
  } else if (positional.length >= 2) {
    contractIdRaw = positional[0];
    planInputRaw = positional.slice(1).join(" ");
  }

  return {
    contractIdRaw,
    planInputRaw,
    providerRaw,
    modelRaw,
    interactive,
    last,
    actorRaw,
  };
}

async function readStdinUtf8() {
  if (process.stdin.isTTY) {
    return "";
  }
  return await new Promise<string>((resolve, reject) => {
    let chunks = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      chunks += chunk;
    });
    process.stdin.on("end", () => {
      resolve(chunks);
    });
    process.stdin.on("error", (error) => {
      reject(error);
    });
  });
}

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

  if (isContractGroup && (command === "review" || command === "accept" || command === "evidence" || command === "emit")) {
    failWithHelp(`Unknown contract subcommand "${command}".`, "contract");
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
      console.log(`Proposed a Kair Contract: ${contract.id}`);
      console.log(`Intent: ${contract.intent}`);
      console.log(`Active version: ${contract.activeVersion ?? "none"}`);
      console.log(`Next: kair contract plan ${contract.id} "..."`);
      break;
    }
    case "plan": {
      if (isContractGroup) {
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
      const parsed = parseTopLevelPlanOptions(rest);
      const providerName = normalizeProviderName(parsed.providerRaw || null);
      try {
        const provider = getProvider(providerName);
        if (!provider.isInstalled()) {
          fail(`Provider '${providerName}' is not installed.`);
        }
      } catch (error: any) {
        fail(error && error.message ? error.message : String(error));
      }
      if (parsed.interactive) {
        fail(
          "Interactive planning not implemented yet. Use --interactive=false with a JSON plan input."
        );
      }
      if (parsed.contractIdRaw && parsed.last) {
        fail("Specify either a contract id or --last, not both.");
      }
      let contractId = parsed.contractIdRaw;
      if (!contractId) {
        const lastId = getLastContractId();
        if (!lastId) {
          fail("No Contracts found.");
        }
        contractId = lastId;
      }
      let rawInput = parsed.planInputRaw.trim();
      if (!rawInput) {
        rawInput = (await readStdinUtf8()).trim();
      }
      if (!rawInput) {
        fail("Missing plan input.");
      }
      let planJson;
      try {
        planJson = parseAndValidatePlanJson(rawInput);
      } catch (error: any) {
        const message = error && error.message ? error.message : String(error);
        fail(`Invalid plan JSON: ${message}`);
      }
      const hasActorInput = Boolean(parsed.actorRaw || (process.env.KAIR_ACTOR || "").trim());
      const actor = hasActorInput ? resolveActor(parsed.actorRaw) : undefined;
      setPlanJson(contractId, planJson, actor);
      console.log(`Structured plan set for Contract ${contractId}.`);
      break;
    }
    case "co-plan": {
      requireArgs(rest, 1, 'contract co-plan "<contract_id>"');
      const [contractId] = rest;
      const contract = getContract(contractId);
      assertState(contract, ["DRAFT"], "co-plan");
      const providerName = normalizeProviderName(process.env.KAIR_LLM_PROVIDER);
      const provider = getProvider(providerName);
      const plan = await provider.planJson({
        contractId: contract.id,
        intent: contract.intent,
        currentPlanText: contract.plan ?? null,
        model: process.env.KAIR_LLM_MODEL || null,
      });
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
      transition(contract, "APPROVED", `Approve a Kair Contract. Actor: ${actor}.`, actor);
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
        "Rewind a Kair Contract because a rewind was requested.",
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
      if (rest.length === 0 || rest[0] === "--last") {
        const lastId = getLastContractId();
        if (!lastId) {
          fail("No Contracts found.");
        }
        contractId = lastId;
      } else if (rest.length >= 1) {
        contractId = rest[0];
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
      requireArgs(remaining, 1, 'accept "<contract_id>" [--actor <name>]');
      const [contractId, ...legacyParts] = remaining;
      let legacyActor = "";
      if (legacyParts.length > 0) {
        legacyActor = legacyParts.join(" ").trim();
        warn('Positional actor is deprecated. Use "accept <id> --actor <name>" instead.');
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
    case "emit": {
      let contractId = "";
      if (rest[0] === "--last") {
        const lastId = getLastContractId();
        if (!lastId) {
          fail("No Contracts found.");
        }
        contractId = lastId;
      } else {
        requireArgs(rest, 1, 'emit "<contract_id>"');
        contractId = rest[0];
      }
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
