import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createInterface } from "node:readline/promises";

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
import { printContractHelp, printGrantHelp, printTopHelp } from "./help";
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

type PlanChoice = "accept" | "retry" | "edit" | "cancel";

const MAX_PLAN_PROVIDER_ATTEMPTS = 5;
const GRANT_FORMAT_REGEX = /^[a-z0-9]+:[a-z0-9_-]+$/;
const INVALID_GRANT_FORMAT_MESSAGE =
  "Invalid grant format. Expected <namespace>:<permission> (example: local:write).";
const AVAILABLE_GRANTS = [
  "local:read",
  "local:write",
  "local:exec",
  "network:read",
  "network:write",
];

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

function validateGrantFormat(grantRaw: string) {
  const grant = (grantRaw || "").trim();
  if (!GRANT_FORMAT_REGEX.test(grant)) {
    fail(INVALID_GRANT_FORMAT_MESSAGE);
  }
  return grant;
}

function printGrantList() {
  const lines = ["AVAILABLE GRANTS", ...AVAILABLE_GRANTS.map((grant) => `- ${grant}`)];
  console.log(lines.join("\n"));
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

async function readStdinUtf8(options: { allowTTY?: boolean } = {}) {
  if (process.stdin.isTTY && options.allowTTY !== true) {
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

async function promptPlanChoice(rl: any) {
  while (true) {
    const answer = (await rl.question("Plan options [a]ccept [r]etry [e]dit [c]ancel: "))
      .trim()
      .toLowerCase();
    if (answer === "a" || answer === "accept") {
      return "accept" as PlanChoice;
    }
    if (answer === "r" || answer === "retry") {
      return "retry" as PlanChoice;
    }
    if (answer === "e" || answer === "edit") {
      return "edit" as PlanChoice;
    }
    if (answer === "c" || answer === "cancel") {
      return "cancel" as PlanChoice;
    }
    console.log("Invalid choice. Enter a, r, e, or c.");
  }
}

async function promptRetryOrCancel(rl: any) {
  while (true) {
    const answer = (await rl.question("Provider output invalid. [r]etry or [c]ancel: "))
      .trim()
      .toLowerCase();
    if (answer === "r" || answer === "retry") {
      return "retry" as const;
    }
    if (answer === "c" || answer === "cancel") {
      return "cancel" as const;
    }
    console.log("Invalid choice. Enter r or c.");
  }
}

async function promptEditRetryOrCancel(rl: any) {
  while (true) {
    const answer = (await rl.question("Edited plan invalid. [e]dit [r]etry [c]ancel: "))
      .trim()
      .toLowerCase();
    if (answer === "e" || answer === "edit") {
      return "edit" as const;
    }
    if (answer === "r" || answer === "retry") {
      return "retry" as const;
    }
    if (answer === "c" || answer === "cancel") {
      return "cancel" as const;
    }
    console.log("Invalid choice. Enter e, r, or c.");
  }
}

function renderPlanPreview(plan: any) {
  const lines = ["PLAN PREVIEW", `Title: ${plan.title || "(untitled)"}`, "Steps:"];
  for (const step of plan.steps || []) {
    lines.push(`- ${step.id}: ${step.title}`);
  }
  console.log(lines.join("\n"));
}

function openEditorForPlan(initialRaw: string) {
  const editor = (process.env.EDITOR || "").trim();
  if (!editor) {
    return null;
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kair-plan-"));
  const filePath = path.join(tempDir, "plan.json");
  try {
    fs.writeFileSync(filePath, initialRaw, "utf8");
    const result = spawnSync(editor, [filePath], {
      stdio: "inherit",
      shell: true,
    });
    if (result.error) {
      fail(`Failed to launch editor "${editor}": ${result.error.message}`);
    }
    if ((result.status ?? 0) !== 0) {
      fail(`Editor command "${editor}" exited with status ${result.status}.`);
    }
    return fs.readFileSync(filePath, "utf8");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function readEditedPlanInput(currentRaw: string, rl: any) {
  const editedViaEditor = openEditorForPlan(currentRaw);
  if (editedViaEditor !== null) {
    return editedViaEditor.trim();
  }
  const pasted = await rl.question("No $EDITOR set. Paste JSON plan (single line) and press Enter: ");
  return pasted.trim();
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

  if (
    isContractGroup &&
    (command === "review" ||
      command === "accept" ||
      command === "evidence" ||
      command === "emit" ||
      command === "grant")
  ) {
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
      let provider: any = null;
      try {
        provider = getProvider(providerName);
        if (!provider.isInstalled()) {
          fail(`Provider '${providerName}' is not installed.`);
        }
      } catch (error: any) {
        fail(error && error.message ? error.message : String(error));
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
      const targetContract = getContract(contractId);
      const hasActorInput = Boolean(parsed.actorRaw || (process.env.KAIR_ACTOR || "").trim());
      const actor = hasActorInput ? resolveActor(parsed.actorRaw) : undefined;

      if (!parsed.interactive) {
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
        setPlanJson(contractId, planJson, actor);
        console.log(`Structured plan set for Contract ${contractId}.`);
        break;
      }

      try {
        provider.requireApiKey();
      } catch (error: any) {
        fail(error && error.message ? error.message : String(error));
      }

      let attempts = 0;
      let candidateRaw = "";
      let candidatePlan: any = null;
      const rl = createInterface({ input: process.stdin, output: process.stdout });

      try {
        while (true) {
          if (!candidatePlan) {
            if (attempts >= MAX_PLAN_PROVIDER_ATTEMPTS) {
              fail(
                `Exceeded maximum provider planning attempts (${MAX_PLAN_PROVIDER_ATTEMPTS}).`
              );
            }
            attempts += 1;
            try {
              candidateRaw = await provider.planJson({
                contractId,
                intent: targetContract.intent,
                currentPlanText: targetContract.plan ?? null,
                model: parsed.modelRaw || null,
              });
            } catch (error: any) {
              fail(error && error.message ? error.message : String(error));
            }

            try {
              candidatePlan = parseAndValidatePlanJson(candidateRaw);
            } catch (error: any) {
              const message = error && error.message ? error.message : String(error);
              console.log(`Provider produced invalid plan JSON: ${message}`);
              const next = await promptRetryOrCancel(rl);
              if (next === "retry") {
                continue;
              }
              console.log("Planning cancelled.");
              break;
            }
          }

          renderPlanPreview(candidatePlan);
          const action = await promptPlanChoice(rl);
          if (action === "accept") {
            setPlanJson(contractId, candidatePlan, actor);
            console.log(`Structured plan set for Contract ${contractId}.`);
            break;
          }
          if (action === "retry") {
            candidateRaw = "";
            candidatePlan = null;
            continue;
          }
          if (action === "cancel") {
            console.log("Planning cancelled.");
            break;
          }

          while (true) {
            const editedRaw = await readEditedPlanInput(
              candidateRaw || JSON.stringify(candidatePlan, null, 2),
              rl
            );
            if (!editedRaw) {
              console.log("Missing plan input.");
              const next = await promptEditRetryOrCancel(rl);
              if (next === "edit") {
                continue;
              }
              if (next === "retry") {
                candidateRaw = "";
                candidatePlan = null;
                break;
              }
              console.log("Planning cancelled.");
              return;
            }
            try {
              candidatePlan = parseAndValidatePlanJson(editedRaw);
              candidateRaw = editedRaw;
              break;
            } catch (error: any) {
              const message = error && error.message ? error.message : String(error);
              console.log(`Invalid plan JSON: ${message}`);
              const next = await promptEditRetryOrCancel(rl);
              if (next === "edit") {
                continue;
              }
              if (next === "retry") {
                candidateRaw = "";
                candidatePlan = null;
                break;
              }
              console.log("Planning cancelled.");
              return;
            }
          }
        }
      } finally {
        rl.close();
      }
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
    case "grant": {
      if (rest.length === 0 || rest.includes("-h") || rest.includes("--help")) {
        printGrantHelp();
        break;
      }
      const { remaining, actorRaw } = extractActorFlags(rest);
      if (remaining.length === 1 && remaining[0] === "list") {
        printGrantList();
        break;
      }
      let contractId = "";
      let grantRaw = "";
      if (remaining.length === 1) {
        const lastId = getLastContractId();
        if (!lastId) {
          fail("No Contracts found.");
        }
        contractId = lastId;
        grantRaw = remaining[0];
      } else if (remaining.length === 2) {
        contractId = remaining[0];
        grantRaw = remaining[1];
      } else {
        fail(
          'Missing arguments. Usage: grant <grant> [--actor <name>] | grant "<contract_id>" <grant> [--actor <name>]'
        );
      }
      const grant = validateGrantFormat(grantRaw);
      const actor = resolveActor(actorRaw);
      const contract = getContract(contractId);
      if (!contract.controlsApproved.includes(grant)) {
        contract.controlsApproved.push(grant);
      }
      recordHistory(contract, "CONTROLS", `Grant approved: ${grant}. Actor: ${actor}.`, actor);
      console.log(`Grant approved for Contract ${contract.id}: ${grant}`);
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
