import * as fs from "node:fs";
import * as path from "node:path";
import { createInterface } from "node:readline/promises";

import { resolveActor } from "../core/actor";
import { fail, warn } from "../core/errors";
import { loadEvidenceIndex } from "../core/contracts/evidence";
import { writePlanPromptArtifact } from "../core/contracts/artifacts";
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
import { PlanLlmRequestRecord, sanitizePlanLlmRequestRecord } from "../core/llm/plan_request_record";
import type { Plan } from "../core/plans/schema";
import { renderPlanPretty } from "../core/plans/render";
import { diffPlansByStepId, type PlanStepDiffById } from "../core/plans/diff";
import { parseAndValidatePlanJson } from "../core/plans/validate";
import { getProvider, normalizeProviderName } from "../core/providers/registry";
import type { Provider } from "../core/providers/types";
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
  filePathRaw: string;
  providerRaw: string;
  modelRaw: string;
  instructionsRaw: string;
  interactive: boolean;
  interactiveSpecified: boolean;
  jsonOutput: boolean;
  debug: boolean;
  last: boolean;
  actorRaw: string;
};

type PlanChoice = "accept" | "refine" | "cancel";

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

function resolveContractPlanV1(contract: any): Plan | null {
  if (contract?.plan_v1 && contract.plan_v1.version === "kair.plan.v1") {
    return contract.plan_v1 as Plan;
  }
  if (contract?.planJson && contract.planJson.version === "kair.plan.v1") {
    return contract.planJson as Plan;
  }
  return null;
}

function buildPlanHistoryMessage(kind: "interactive" | "non-interactive", provider?: string, model?: string) {
  const chunks = [
    kind === "interactive" ? "Plan updated via interactive refine." : "Plan updated via non-interactive refine.",
  ];
  if (provider) {
    chunks.push(`Provider: ${provider}.`);
  }
  if (model) {
    chunks.push(`Model: ${model}.`);
  }
  return chunks.join(" ");
}

function persistStructuredPlan(params: {
  contractId: string;
  plan: Plan;
  actor?: string;
  message: string;
}) {
  const contract = setPlanJson(params.contractId, params.plan, params.actor, params.message);
  if (contract.current_state === "DRAFT") {
    transition(
      contract,
      "PLANNED",
      "Plan captured via top-level plan command.",
      params.actor
    );
  }
}

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
  let instructionsRaw = "";
  let filePathRaw = "";
  let interactive = true;
  let interactiveSpecified = false;
  let jsonOutput = false;
  let debug = false;
  let last = false;
  let actorRaw = "";

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--last") {
      last = true;
      continue;
    }
    if (token === "--json") {
      jsonOutput = true;
      continue;
    }
    if (token === "--debug") {
      debug = true;
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
    if (token === "--instructions") {
      instructionsRaw = (args[i + 1] || "").trim();
      i += 1;
      if (!instructionsRaw) {
        fail("Missing value for --instructions.");
      }
      continue;
    }
    if (token.startsWith("--instructions=")) {
      instructionsRaw = token.slice("--instructions=".length).trim();
      if (!instructionsRaw) {
        fail("Missing value for --instructions.");
      }
      continue;
    }
    if (token === "--file") {
      filePathRaw = (args[i + 1] || "").trim();
      i += 1;
      if (!filePathRaw) {
        fail("Missing value for --file.");
      }
      continue;
    }
    if (token.startsWith("--file=")) {
      filePathRaw = token.slice("--file=".length).trim();
      if (!filePathRaw) {
        fail("Missing value for --file.");
      }
      continue;
    }
    if (token === "--interactive") {
      const raw = (args[i + 1] || "").trim();
      i += 1;
      if (!raw) {
        fail("Missing value for --interactive.");
      }
      interactiveSpecified = true;
      interactive = parseBooleanFlag(raw, "--interactive");
      continue;
    }
    if (token.startsWith("--interactive=")) {
      const raw = token.slice("--interactive=".length).trim();
      if (!raw) {
        fail("Missing value for --interactive.");
      }
      interactiveSpecified = true;
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

  if (jsonOutput) {
    if (interactiveSpecified && interactive) {
      fail("--json cannot be used with --interactive=true. Use JSON arg/stdin without interactive prompts.");
    }
    interactive = false;
  }

  return {
    contractIdRaw,
    planInputRaw,
    filePathRaw,
    providerRaw,
    modelRaw,
    instructionsRaw,
    interactive,
    interactiveSpecified,
    jsonOutput,
    debug,
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
    const answer = (await rl.question("Plan options [a]ccept [r]efine [c]ancel: "))
      .trim()
      .toLowerCase();
    if (answer === "a" || answer === "accept") {
      return "accept" as PlanChoice;
    }
    if (answer === "r" || answer === "refine") {
      return "refine" as PlanChoice;
    }
    if (answer === "c" || answer === "cancel") {
      return "cancel" as PlanChoice;
    }
    console.log("Choose a, r, or c.");
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
    console.log("Choose r or c.");
  }
}

function renderPlanPreview(plan: Plan, options: { jsonOutput?: boolean } = {}) {
  if (options.jsonOutput) {
    console.log("Preview current plan");
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  console.log(["Preview current plan", renderPlanPretty(plan)].join("\n"));
}

function renderPlanDiffSection(diff: PlanStepDiffById) {
  const lines = ["Plan diff:"];
  if (!diff.added.length && !diff.removed.length && !diff.changed.length) {
    lines.push("- no step-level changes");
    console.log(lines.join("\n"));
    return;
  }
  if (diff.added.length) {
    lines.push(`- added: ${diff.added.map((step) => step.id).join(", ")}`);
  }
  if (diff.removed.length) {
    lines.push(`- removed: ${diff.removed.map((step) => step.id).join(", ")}`);
  }
  if (diff.changed.length) {
    const changed = diff.changed.map((step) => {
      const fields: string[] = [];
      if (step.before.title !== step.after.title) {
        fields.push("title");
      }
      if (step.before.description !== step.after.description) {
        fields.push("description");
      }
      return `${step.id}${fields.length ? ` (${fields.join(", ")})` : ""}`;
    });
    lines.push(`- changed: ${changed.join(", ")}`);
  }
  console.log(lines.join("\n"));
}

function readPlanFromFile(filePathRaw: string) {
  const resolved = path.resolve(filePathRaw);
  try {
    return fs.readFileSync(resolved, "utf8");
  } catch (error: any) {
    fail(`Failed to read --file ${filePathRaw}: ${error.message}`);
  }
}

function parsePlanOrFail(raw: string, prefix = "Invalid plan JSON") {
  try {
    return parseAndValidatePlanJson(raw);
  } catch (error: any) {
    const message = error && error.message ? error.message : String(error);
    fail(`${prefix}: ${message}`);
  }
}

function printPlanDebugOutput(params: {
  parsed: ParsedTopLevelPlanOptions;
  sanitizedRequestRecord: PlanLlmRequestRecord;
  promptArtifactPath: string;
}) {
  if (!params.parsed.debug || params.parsed.jsonOutput) {
    return;
  }
  console.log("PLAN DEBUG");
  console.log(`Provider: ${params.sanitizedRequestRecord.provider}`);
  console.log(`Model: ${params.sanitizedRequestRecord.model}`);
  console.log(`Temperature: ${params.sanitizedRequestRecord.temperature}`);
  console.log(`Prompt artifact: ${params.promptArtifactPath}`);
  console.log("Sanitized request JSON:");
  console.log(JSON.stringify(params.sanitizedRequestRecord, null, 2));
}

function resolvePlanProvider(parsed: ParsedTopLevelPlanOptions, required: boolean) {
  const providerName = normalizeProviderName(parsed.providerRaw || null);
  if (!required && !parsed.providerRaw) {
    return { providerName, provider: null as Provider | null };
  }
  try {
    const provider = getProvider(providerName);
    if (!provider.isInstalled()) {
      fail(`Provider '${providerName}' is not installed.`);
    }
    return { providerName, provider };
  } catch (error: any) {
    fail(error && error.message ? error.message : String(error));
  }
}

function resolvePlanContractId(parsed: ParsedTopLevelPlanOptions) {
  if (parsed.contractIdRaw && parsed.last) {
    fail("Specify either a contract id or --last, not both.");
  }
  if (parsed.contractIdRaw) {
    return parsed.contractIdRaw;
  }
  const lastId = getLastContractId();
  if (!lastId) {
    fail("No Contracts found.");
  }
  return lastId;
}

async function requestPlanFromProvider(params: {
  provider: Provider;
  contractId: string;
  intent: string;
  currentPlan: Plan | null;
  currentPlanText: string | null;
  instructions: string;
  model: string | null;
  mode: "generate" | "refine";
  attemptsUsed: number;
}) {
  if (params.attemptsUsed >= MAX_PLAN_PROVIDER_ATTEMPTS) {
    fail(`Exceeded maximum provider planning attempts (${MAX_PLAN_PROVIDER_ATTEMPTS}).`);
  }
  if (params.mode === "refine" && !params.currentPlan) {
    fail("Refine planning requires current plan JSON.");
  }
  let raw = "";
  const promptRecord: PlanLlmRequestRecord = {
    provider: params.provider.name,
    model: params.model || (process.env.KAIR_LLM_MODEL || "").trim() || "default",
    temperature: 0.1,
    timestamp: new Date().toISOString(),
    contractId: params.contractId,
    mode: params.mode,
    changeRequestText: params.mode === "refine" ? params.instructions : undefined,
    messages: [
      {
        role: "system",
        content: "kair plan provider invocation",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            intent: params.intent,
            currentPlan: params.currentPlan,
            currentPlanText: params.currentPlanText,
            requestedChanges: params.instructions,
          },
          null,
          2
        ),
      },
    ],
  };
  const sanitizedPromptRecord = sanitizePlanLlmRequestRecord(promptRecord, {
    maxMessageLength: 4000,
  });
  const promptArtifactPath = writePlanPromptArtifact(sanitizedPromptRecord);
  try {
    raw = await params.provider.planJson({
      contractId: params.contractId,
      intent: params.intent,
      currentPlanJson: params.currentPlan,
      currentPlanText: params.currentPlanText,
      instructions: params.instructions,
      model: params.model,
    });
  } catch (error: any) {
    fail(error && error.message ? error.message : String(error));
  }

  try {
    const parsed = parseAndValidatePlanJson(raw);
    return {
      plan: parsed,
      attemptsUsed: params.attemptsUsed + 1,
      promptArtifactPath,
      sanitizedRequestRecord: sanitizedPromptRecord,
    };
  } catch (error: any) {
    const message = error && error.message ? error.message : String(error);
    throw new Error(`Provider produced invalid plan JSON: ${message}`);
  }
}

async function handleTopLevelPlan(rest: string[]) {
  const parsed = parseTopLevelPlanOptions(rest);
  const contractId = resolvePlanContractId(parsed);
  const targetContract = getContract(contractId);
  const existingPlan = resolveContractPlanV1(targetContract);
  const actor = parsed.actorRaw || (process.env.KAIR_ACTOR || "").trim()
    ? resolveActor(parsed.actorRaw)
    : undefined;

  const { providerName, provider: preResolvedProvider } = resolvePlanProvider(
    parsed,
    Boolean(parsed.providerRaw)
  );
  let provider = preResolvedProvider;
  let providerApiKeyChecked = false;
  const model = parsed.modelRaw || null;

  function ensureProviderAndApiKey() {
    if (!provider) {
      const resolved = resolvePlanProvider(parsed, true);
      provider = resolved.provider;
    }
    if (!provider) {
      fail("Provider is required for planning.");
    }
    if (!providerApiKeyChecked) {
      try {
        provider.requireApiKey();
      } catch (error: any) {
        fail(error && error.message ? error.message : String(error));
      }
      providerApiKeyChecked = true;
    }
    return provider;
  }

  if (!parsed.interactive) {
    if (parsed.jsonOutput) {
      if (parsed.instructionsRaw.trim()) {
        fail("--json requires JSON input via argument or stdin; --instructions is not supported.");
      }
      if (parsed.filePathRaw) {
        fail("--json requires JSON input via argument or stdin; --file is not supported.");
      }
      const rawInput = parsed.planInputRaw.trim() || (await readStdinUtf8()).trim();
      if (!rawInput) {
        fail("Missing plan input. Provide JSON argument or pipe JSON via stdin.");
      }
      const planJson = parsePlanOrFail(rawInput);
      persistStructuredPlan({
        contractId,
        plan: planJson,
        actor,
        message: "Plan updated via non-interactive refine.",
      });
      process.stdout.write(`${JSON.stringify(planJson, null, 2)}\n`);
      return;
    }

    if (parsed.instructionsRaw.trim()) {
      const activeProvider = ensureProviderAndApiKey();
      let result;
      try {
        result = await requestPlanFromProvider({
          provider: activeProvider,
          contractId,
          intent: targetContract.intent,
          currentPlan: existingPlan,
          currentPlanText: targetContract.plan ?? null,
          instructions: parsed.instructionsRaw.trim(),
          model,
          mode: existingPlan ? "refine" : "generate",
          attemptsUsed: 0,
        });
      } catch (error: any) {
        fail(error && error.message ? error.message : String(error));
      }
      persistStructuredPlan({
        contractId,
        plan: result.plan,
        actor,
        message: buildPlanHistoryMessage("non-interactive", providerName, model || undefined),
      });
      printPlanDebugOutput({
        parsed,
        sanitizedRequestRecord: result.sanitizedRequestRecord,
        promptArtifactPath: result.promptArtifactPath,
      });
      console.log(`Structured plan set for Contract ${contractId}.`);
      return;
    }

    if (parsed.filePathRaw && parsed.planInputRaw.trim()) {
      fail("Specify either --file or JSON argument input, not both.");
    }

    let rawInput = "";
    if (parsed.filePathRaw) {
      rawInput = String(readPlanFromFile(parsed.filePathRaw) || "").trim();
    } else if (parsed.planInputRaw.trim()) {
      rawInput = parsed.planInputRaw.trim();
    } else {
      rawInput = (await readStdinUtf8()).trim();
    }

    if (!rawInput) {
      fail("Missing plan input. Provide --file <path> or pipe JSON via stdin.");
    }
    const planJson = parsePlanOrFail(rawInput);
    persistStructuredPlan({
      contractId,
      plan: planJson,
      actor,
      message: "Plan updated via non-interactive refine.",
    });
    console.log(`Structured plan set for Contract ${contractId}.`);
    return;
  }

  let attempts = 0;
  let candidatePlan = existingPlan;
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    if (!candidatePlan || parsed.instructionsRaw.trim()) {
      const activeProvider = ensureProviderAndApiKey();
      const initialInstructions = parsed.instructionsRaw.trim() || "Create an initial plan from intent.";
      while (true) {
        try {
          const result = await requestPlanFromProvider({
            provider: activeProvider,
            contractId,
            intent: targetContract.intent,
            currentPlan: candidatePlan,
            currentPlanText: targetContract.plan ?? null,
            instructions: initialInstructions,
            model,
            mode: candidatePlan ? "refine" : "generate",
            attemptsUsed: attempts,
          });
          const priorPlan = candidatePlan;
          candidatePlan = result.plan;
          attempts = result.attemptsUsed;
          if (!parsed.jsonOutput && priorPlan) {
            renderPlanDiffSection(diffPlansByStepId(priorPlan, candidatePlan));
          }
          printPlanDebugOutput({
            parsed,
            sanitizedRequestRecord: result.sanitizedRequestRecord,
            promptArtifactPath: result.promptArtifactPath,
          });
          break;
        } catch (error: any) {
          console.log(error && error.message ? error.message : String(error));
          const next = await promptRetryOrCancel(rl);
          if (next === "retry") {
            continue;
          }
          console.log("Planning cancelled.");
          return;
        }
      }
    }

    while (candidatePlan) {
      renderPlanPreview(candidatePlan, { jsonOutput: parsed.jsonOutput });
      const action = await promptPlanChoice(rl);
      if (action === "accept") {
        persistStructuredPlan({
          contractId,
          plan: candidatePlan,
          actor,
          message: buildPlanHistoryMessage("interactive", providerName, model || undefined),
        });
        console.log(`Structured plan set for Contract ${contractId}.`);
        return;
      }
      if (action === "cancel") {
        console.log("Planning cancelled.");
        return;
      }

      const refineInstructions = (await rl.question("Explain changes: ")).trim();
      if (!refineInstructions) {
        console.log("Choose a, r, or c.");
        continue;
      }

      while (true) {
        const activeProvider = ensureProviderAndApiKey();
        try {
          const result = await requestPlanFromProvider({
            provider: activeProvider,
            contractId,
            intent: targetContract.intent,
            currentPlan: candidatePlan,
            currentPlanText: targetContract.plan ?? null,
            instructions: refineInstructions,
            model,
            mode: "refine",
            attemptsUsed: attempts,
          });
          const priorPlan = candidatePlan;
          candidatePlan = result.plan;
          attempts = result.attemptsUsed;
          if (!parsed.jsonOutput && priorPlan) {
            renderPlanDiffSection(diffPlansByStepId(priorPlan, candidatePlan));
          }
          printPlanDebugOutput({
            parsed,
            sanitizedRequestRecord: result.sanitizedRequestRecord,
            promptArtifactPath: result.promptArtifactPath,
          });
          break;
        } catch (error: any) {
          console.log(error && error.message ? error.message : String(error));
          const next = await promptRetryOrCancel(rl);
          if (next === "retry") {
            continue;
          }
          console.log("Planning cancelled.");
          return;
        }
      }
    }
  } finally {
    rl.close();
  }
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
      console.log(`Next: kair plan ${contract.id}`);
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
      await handleTopLevelPlan(rest);
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
