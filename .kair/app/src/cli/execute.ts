import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

import { resolveActor } from "../core/actor";
import { fail, warn } from "../core/errors";
import { loadEvidenceIndex } from "../core/contracts/evidence";
import { writePlanPromptArtifact } from "../core/contracts/artifacts";
import { DPC_VERSION, DpcV1 } from "../core/dpc/schema";
import { getDpcPath, loadDpcV1, saveDpcV1 } from "../core/dpc/storage";
import { contractStore, getContract, getLastContractId } from "../core/store/contracts_store";
import {
  enforceControls,
} from "../core/contracts/controls";
import { proposeContract } from "../core/contracts/propose";
import { assertState, recordHistory, transition } from "../core/contracts/history";
import { getPlanJsonRef, setPlanJson } from "../core/contracts/plan_json";
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
import {
  getArtifactsDir,
  getContractsRoot,
  getContractPlanJsonPath,
  getContractRulesPath,
  getDataFile,
} from "../core/store/paths";
import { now } from "../core/time";
import { writePlanMarkdown } from "../core/plans/markdown";
import { appendStreamEvent } from "../core/streaming/events";
import {
  contractBranchName,
  checkoutContractBranch,
  commitPlanChanges,
  ensureGitInstalled,
  ensureGitRepo,
  isInsideGitRepo,
  listUncommittedContractPaths,
  pullCurrentBranch,
  pushContractBranch,
} from "../core/git/integration";
import { validateApprovalArtifact } from "../core/approvals";
import {
  ensureProviderSession,
  getConfiguredProviders,
  loginProvider,
  promptProviderSelection,
  resolveDefaultProvider,
  resolveProviderFromInput,
} from "../core/auth/session";
import { setDefaultProvider } from "../core/store/config";

import { failWithHelp } from "./errors";
import { parseContractCommand, extractActorFlags, extractProposeOptions, extractRunOptions, requireArgs } from "./argv";
import {
  printAcceptHelp,
  printApproveHelp,
  printContractsHelp,
  printContractHelp,
  printEmitHelp,
  printGrantHelp,
  printLoginsHelp,
  printLoginHelp,
  printPauseHelp,
  printPlanHelp,
  printProposeHelp,
  printPruneHelp,
  printReviewHelp,
  printRewindHelp,
  printResumeHelp,
  printRunHelp,
  printSelfUpdateHelp,
  printStatusHelp,
  printTopHelp,
} from "./help";
import { promptForProposeInput } from "./prompt";
import { showContractStatus } from "./status";
import { listContracts, listLogins } from "./list";
import { renderEvidence, renderReview } from "./review";
import { renderDpcPretty } from "./render_dpc";

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

type PlanChoice = "commit" | "edit" | "prompt_again";

const MAX_PLAN_PROVIDER_ATTEMPTS = 5;
const GRANT_FORMAT_REGEX = /^[a-z0-9]+:[a-z0-9_-]+$/;
const INVALID_GRANT_FORMAT_MESSAGE =
  "Invalid grant format. Expected <namespace>:<permission> (example: local:write).";
const MISSING_PROVIDER_CONFIG_MESSAGE =
  "Missing provider configuration. Set KAIR_LLM_PROVIDER or pass --provider <name>.";
const MULTIPLE_PLAN_PROVIDERS_CONFIGURED_MESSAGE =
  "Multiple providers configured (openai, claude). Pass --provider <name> or set KAIR_LLM_PROVIDER.";
const DPC_DEFAULT_CONSTRAINTS = [
  "LLM output must be strict JSON-only.",
  "Pretty formatting is produced by the CLI renderer only.",
  "--json mode outputs only JSON.",
  "Refine operates on existing plan and preserves step IDs.",
];
const AVAILABLE_GRANTS = [
  "local:read",
  "local:write",
  "local:exec",
  "network:read",
  "network:write",
];

function buildInitialDpc(contractId: string): DpcV1 {
  return {
    version: DPC_VERSION,
    topic: contractId,
    assumptions: [],
    constraints: [...DPC_DEFAULT_CONSTRAINTS],
    decisions: [],
    open_questions: [],
    evidence: [],
    updated_at: now(),
  };
}

function buildDpcEvidenceId(kind: "prompt" | "plan") {
  const timestampPrefix = now().replace(/[^0-9]/g, "");
  const randomSuffix = Math.random().toString(16).slice(2, 8);
  return `${timestampPrefix}-${kind}-${randomSuffix}`;
}

function updateDpcEvidenceForPlanAttempt(params: {
  contractId: string;
  promptArtifactPath: string;
}) {
  const dpcArtifactPath = getDpcPath(params.contractId);
  const dpc = loadDpcV1(params.contractId) || buildInitialDpc(params.contractId);
  dpc.evidence.push({
    id: buildDpcEvidenceId("prompt"),
    kind: "prompt",
    ref: params.promptArtifactPath,
  });
  dpc.evidence.push({
    id: buildDpcEvidenceId("plan"),
    kind: "plan",
    ref: getPlanJsonRef(params.contractId),
  });
  dpc.updated_at = now();
  saveDpcV1(params.contractId, dpc);
  return { dpcArtifactPath, dpc };
}

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
  writePlanMarkdown(params.contractId, params.plan);
  if (contract.current_state !== "PLANNED") {
    transition(
      contract,
      "PLANNED",
      "Structured plan accepted; Contract moved to PLANNED.",
      params.actor
    );
  }
  appendStreamEvent({
    contractId: params.contractId,
    phase: "plan",
    event: "summary",
    message: "Plan persisted and contract-local PLAN.md written.",
  });
}

function buildPlanAutoCommitMessage(params: {
  contractId: string;
  actor?: string;
  mode: "interactive" | "non-interactive";
  provider?: string | null;
  model?: string | null;
}) {
  const lines = [
    `kair(plan): persist contract ${params.contractId}`,
    "",
    `Contract: ${params.contractId}`,
    `Actor: ${String(params.actor || "").trim() || "unknown"}`,
    `Mode: ${params.mode}`,
    `Provider: ${String(params.provider || "").trim() || "n/a"}`,
    `Model: ${String(params.model || "").trim() || "n/a"}`,
    `Timestamp: ${new Date().toISOString()}`,
  ];
  return lines.join("\n");
}

function maybeAutoCommitPlanArtifacts(params: {
  contractId: string;
  actor?: string;
  mode: "interactive" | "non-interactive";
  provider?: string | null;
  model?: string | null;
}) {
  if (!isInsideGitRepo()) {
    return;
  }
  try {
    const commitResult = commitPlanChanges(
      params.contractId,
      buildPlanAutoCommitMessage({
        contractId: params.contractId,
        actor: params.actor,
        mode: params.mode,
        provider: params.provider,
        model: params.model,
      })
    );
    if (commitResult.committed) {
      appendStreamEvent({
        contractId: params.contractId,
        phase: "plan",
        event: "summary",
        message: "Plan artifacts committed to git.",
      });
    }
  } catch (error: any) {
    warn(`Plan commit skipped: ${error.message}`);
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

function hasHelpFlag(args: string[]) {
  return args.includes("-h") || args.includes("--help") || (args.length === 1 && args[0] === "help");
}

function printGrantList() {
  const lines = ["AVAILABLE GRANTS", ...AVAILABLE_GRANTS.map((grant) => `- ${grant}`)];
  console.log(lines.join("\n"));
}

function parsePruneOptions(args: string[]) {
  let all = false;
  for (const token of args) {
    if (token === "-a" || token === "--all") {
      all = true;
      continue;
    }
    fail("Invalid arguments. Usage: prune [-a|--all]");
  }
  return { all };
}

async function promptPruneConfirmation() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const response = (await rl.question("Proceed? [y]es [n]o: ")).trim().toLowerCase();
      if (response === "y" || response === "yes") {
        return true;
      }
      if (response === "n" || response === "no") {
        return false;
      }
      console.log("Please answer y/yes or n/no.");
    }
  } finally {
    rl.close();
  }
}

function resetContractsAndArtifacts() {
  contractStore.contracts.clear();
  contractStore.nextId = 1;
  const contractsRoot = getContractsRoot();
  fs.mkdirSync(contractsRoot, { recursive: true });
  for (const entry of fs.readdirSync(contractsRoot)) {
    fs.rmSync(path.join(contractsRoot, entry), { recursive: true, force: true });
  }
  const dataFile = getDataFile();
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(
    dataFile,
    JSON.stringify(
      {
        nextId: 1,
        contracts: [],
      },
      null,
      2
    )
  );
  return { dataFile, artifactsDir: getArtifactsDir() };
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
    const answer = (await rl.question("Plan options [c]ommit [e]dit [p]rompt again: "))
      .trim()
      .toLowerCase();
    if (answer === "c" || answer === "commit") {
      return "commit" as PlanChoice;
    }
    if (answer === "e" || answer === "edit") {
      return "edit" as PlanChoice;
    }
    if (answer === "p" || answer === "prompt again" || answer === "prompt_again") {
      return "prompt_again" as PlanChoice;
    }
    console.log("Choose c, e, or p.");
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
  dpcArtifactPath?: string;
  dpcPreview?: DpcV1;
}) {
  if (!params.parsed.debug || params.parsed.jsonOutput) {
    return;
  }
  console.log("PLAN DEBUG");
  console.log(`Provider: ${params.sanitizedRequestRecord.provider}`);
  console.log(`Model: ${params.sanitizedRequestRecord.model}`);
  console.log(`Temperature: ${params.sanitizedRequestRecord.temperature}`);
  console.log(`Prompt artifact: ${params.promptArtifactPath}`);
  if (params.dpcArtifactPath && fs.existsSync(params.dpcArtifactPath)) {
    console.log(`DPC artifact: ${params.dpcArtifactPath}`);
    if (params.dpcPreview) {
      console.log("DPC preview:");
      console.log(renderDpcPretty(params.dpcPreview));
    }
  }
  console.log("Sanitized request JSON:");
  console.log(JSON.stringify(params.sanitizedRequestRecord, null, 2));
}

function resolveConfiguredProviderName(providerRaw: string) {
  const explicit = normalizeProviderName(providerRaw);
  if (explicit) {
    return explicit;
  }
  return normalizeProviderName(process.env.KAIR_LLM_PROVIDER || "");
}

function resolvePlanProvider(parsed: ParsedTopLevelPlanOptions, required: boolean) {
  const providerName = resolveConfiguredProviderName(parsed.providerRaw);
  if (!required && !providerName) {
    return { providerName, provider: null as Provider | null };
  }
  if (!providerName) {
    fail(MISSING_PROVIDER_CONFIG_MESSAGE);
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

async function ensurePlanProviderSession(parsed: ParsedTopLevelPlanOptions, allowPrompt: boolean) {
  const explicit = normalizeProviderName(parsed.providerRaw);
  if (explicit === "mock" && (process.env.KAIR_TEST_MODE || "").trim() === "1") {
    process.env.KAIR_LLM_PROVIDER = "mock";
    return "mock";
  }
  let provider = resolveProviderFromInput(parsed.providerRaw);
  let pickedViaPrompt = false;
  if (!provider) {
    const defaultProvider = resolveDefaultProvider();
    if (defaultProvider) {
      const configured = await getConfiguredProviders();
      if (configured.includes(defaultProvider)) {
        provider = defaultProvider;
      }
    }
  }
  if (!provider) {
    const configuredProviders = await getConfiguredProviders();
    if (configuredProviders.length === 1) {
      provider = configuredProviders[0];
    } else if (configuredProviders.length > 1) {
      if (!allowPrompt) {
        fail(MULTIPLE_PLAN_PROVIDERS_CONFIGURED_MESSAGE);
      }
      provider = await promptProviderSelection();
      pickedViaPrompt = true;
    } else {
      if (!allowPrompt) {
        fail(MISSING_PROVIDER_CONFIG_MESSAGE);
      }
      provider = await promptProviderSelection();
      pickedViaPrompt = true;
    }
  }
  if (pickedViaPrompt) {
    setDefaultProvider(provider);
  }
  process.env.KAIR_LLM_PROVIDER = provider;
  await ensureProviderSession(provider);
  return provider;
}

async function ensureRunProviderSession(params: {
  providerRaw: string;
  allowPrompt: boolean;
  required: boolean;
}) {
  let provider = resolveProviderFromInput(params.providerRaw);
  if (!provider) {
    if (!params.required) {
      return "";
    }
    if (!params.allowPrompt) {
      provider = "openai";
    } else {
      provider = await promptProviderSelection();
      process.env.KAIR_LLM_PROVIDER = provider;
    }
  }
  if (params.allowPrompt) {
    await ensureProviderSession(provider);
  }
  process.env.KAIR_LLM_PROVIDER = provider;
  return provider;
}

function resolveContractPlanForRun(contract: any): Plan {
  const plan = resolveContractPlanV1(contract);
  if (!plan) {
    fail("Structured plan required; run `kair plan` first.");
  }
  return plan;
}

function ensureRequiredRunFiles(contractId: string) {
  const requiredPaths = [
    { label: "plan_v1.json", filePath: getContractPlanJsonPath(contractId) },
    { label: "RULES.md", filePath: getContractRulesPath(contractId) },
  ];
  for (const requiredPath of requiredPaths) {
    if (!fs.existsSync(requiredPath.filePath)) {
      fail(`Missing required file: ${requiredPath.filePath} (${requiredPath.label}).`);
    }
  }
}

function runSelfUpdateInstaller() {
  const updateCommand =
    (process.env.KAIR_SELF_UPDATE_CMD || "").trim() ||
    "curl -fsSL https://raw.githubusercontent.com/KairikHub/kair/main/install.sh | sh";
  const result = spawnSync("sh", ["-c", updateCommand], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    fail(`self-update failed to start: ${result.error.message}`);
  }
  if ((result.status ?? 1) !== 0) {
    fail(`self-update failed (exit code ${result.status ?? 1}).`);
  }
}

async function promptRunPull(allowPrompt: boolean) {
  if (!allowPrompt) {
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const answer = (await rl.question("Git repo detected. Pull latest changes before run? [y]es [n]o: "))
        .trim()
        .toLowerCase();
      if (answer === "y" || answer === "yes") {
        return true;
      }
      if (answer === "n" || answer === "no") {
        return false;
      }
      console.log("Please answer y/yes or n/no.");
    }
  } finally {
    rl.close();
  }
}

async function promptRunInteractiveConfirmation(plan: Plan, allowPrompt: boolean) {
  if (!allowPrompt) {
    fail("--interactive run requires a TTY prompt.");
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (const step of plan.steps) {
      while (true) {
        const answer = (await rl.question(`Apply step ${step.id} (${step.summary})? [y]es [n]o: `))
          .trim()
          .toLowerCase();
        if (answer === "y" || answer === "yes") {
          break;
        }
        if (answer === "n" || answer === "no") {
          fail(`Run cancelled at step ${step.id}.`);
        }
        console.log("Please answer y/yes or n/no.");
      }
    }
  } finally {
    rl.close();
  }
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

  let parsed: Plan;
  try {
    parsed = parseAndValidatePlanJson(raw);
  } catch (error: any) {
    const message = error && error.message ? error.message : String(error);
    throw new Error(`Provider produced invalid plan JSON: ${message}`);
  }

  let dpcArtifactPath = "";
  let dpcPreview: DpcV1 | undefined;
  try {
    const dpcUpdate = updateDpcEvidenceForPlanAttempt({
      contractId: params.contractId,
      promptArtifactPath,
    });
    dpcArtifactPath = dpcUpdate.dpcArtifactPath;
    dpcPreview = dpcUpdate.dpc;
  } catch (error: any) {
    const message = error && error.message ? error.message : String(error);
    fail(`Failed to persist DPC for Contract "${params.contractId}": ${message}`);
  }

  return {
    plan: parsed,
    attemptsUsed: params.attemptsUsed + 1,
    promptArtifactPath,
    dpcArtifactPath,
    dpcPreview,
    sanitizedRequestRecord: sanitizedPromptRecord,
  };
}

async function handleTopLevelPlan(rest: string[]) {
  const parsed = parseTopLevelPlanOptions(rest);
  const contractId = resolvePlanContractId(parsed);
  const targetContract = getContract(contractId);
  const existingPlan = resolveContractPlanV1(targetContract);
  const allowPrompt = process.stdin.isTTY && process.stdout.isTTY;
  const actor = parsed.actorRaw || (process.env.KAIR_ACTOR || "").trim()
    ? resolveActor(parsed.actorRaw)
    : undefined;

  let providerName = resolveConfiguredProviderName(parsed.providerRaw);
  let provider: Provider | null = null;
  let providerApiKeyChecked = false;
  const model = parsed.modelRaw || null;

  async function ensureProviderAndApiKey() {
    if (!provider) {
      providerName = await ensurePlanProviderSession(parsed, allowPrompt);
      const resolved = resolvePlanProvider({ ...parsed, providerRaw: providerName }, true);
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
      maybeAutoCommitPlanArtifacts({
        contractId,
        actor,
        mode: "non-interactive",
        provider: providerName || null,
        model,
      });
      process.stdout.write(`${JSON.stringify(planJson, null, 2)}\n`);
      return;
    }

    if (parsed.instructionsRaw.trim()) {
      const activeProvider = await ensureProviderAndApiKey();
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
      maybeAutoCommitPlanArtifacts({
        contractId,
        actor,
        mode: "non-interactive",
        provider: providerName || null,
        model,
      });
      appendStreamEvent({
        contractId,
        phase: "plan",
        event: "summary",
        message: "Non-interactive plan generation completed.",
      });
      printPlanDebugOutput({
        parsed,
        sanitizedRequestRecord: result.sanitizedRequestRecord,
        promptArtifactPath: result.promptArtifactPath,
        dpcArtifactPath: result.dpcArtifactPath,
        dpcPreview: result.dpcPreview,
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
    appendStreamEvent({
      contractId,
      phase: "plan",
      event: "step.start",
      message: "Persisting non-interactive plan input.",
    });
    persistStructuredPlan({
      contractId,
      plan: planJson,
      actor,
      message: "Plan updated via non-interactive refine.",
    });
    maybeAutoCommitPlanArtifacts({
      contractId,
      actor,
      mode: "non-interactive",
      provider: providerName || null,
      model,
    });
    console.log(`Structured plan set for Contract ${contractId}.`);
    return;
  }

  let attempts = 0;
  let candidatePlan = existingPlan;
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    if (!candidatePlan || parsed.instructionsRaw.trim()) {
      const activeProvider = await ensureProviderAndApiKey();
      const initialInstructions = parsed.instructionsRaw.trim() || "Create an initial plan from intent.";
      while (true) {
        try {
          appendStreamEvent({
            contractId,
            phase: "plan",
            event: "step.start",
            message: "Requesting plan from provider.",
            print: true,
            jsonOutput: parsed.jsonOutput,
          });
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
          appendStreamEvent({
            contractId,
            phase: "plan",
            event: "step.done",
            message: "Plan candidate received.",
            print: true,
            jsonOutput: parsed.jsonOutput,
          });
          if (!parsed.jsonOutput && priorPlan) {
            renderPlanDiffSection(diffPlansByStepId(priorPlan, candidatePlan));
          }
          printPlanDebugOutput({
            parsed,
            sanitizedRequestRecord: result.sanitizedRequestRecord,
            promptArtifactPath: result.promptArtifactPath,
            dpcArtifactPath: result.dpcArtifactPath,
            dpcPreview: result.dpcPreview,
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
      if (action === "commit") {
        persistStructuredPlan({
          contractId,
          plan: candidatePlan,
          actor,
          message: buildPlanHistoryMessage("interactive", providerName, model || undefined),
        });
        maybeAutoCommitPlanArtifacts({
          contractId,
          actor,
          mode: "interactive",
          provider: providerName || null,
          model,
        });
        console.log(`Structured plan set for Contract ${contractId}.`);
        return;
      }

      const refineInstructions = (
        await rl.question(action === "edit" ? "Describe manual edits for next refine: " : "Prompt again with request: ")
      ).trim();
      if (!refineInstructions) {
        console.log("Choose c, e, or p.");
        continue;
      }

      while (true) {
        const activeProvider = await ensureProviderAndApiKey();
        try {
          const result = await requestPlanFromProvider({
            provider: activeProvider,
            contractId,
            intent: targetContract.intent,
            currentPlan: candidatePlan,
            currentPlanText: targetContract.plan ?? null,
            instructions: refineInstructions,
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
            dpcArtifactPath: result.dpcArtifactPath,
            dpcPreview: result.dpcPreview,
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
  if (!command) {
    printTopHelp();
    process.exit(0);
  }

  if (command === "-h" || command === "--help") {
    printTopHelp();
    return;
  }

  switch (command) {
    case "self-update": {
      if (hasHelpFlag(rest)) {
        printSelfUpdateHelp();
        return;
      }
      if (rest.length > 0) {
        fail("Invalid arguments. Usage: self-update");
      }
      console.log("Running self-update...");
      runSelfUpdateInstaller();
      console.log("Self-update complete.");
      break;
    }
    case "login": {
      if (rest[0] === "list") {
        if (rest.length === 1) {
          await listLogins();
          return;
        }
        if (hasHelpFlag(rest.slice(1))) {
          printLoginsHelp();
          return;
        }
        fail("Invalid arguments. Usage: login [--provider <openai|claude>] | login list");
      }
      if (hasHelpFlag(rest)) {
        printLoginHelp();
        return;
      }
      let providerRaw = "";
      for (let i = 0; i < rest.length; i += 1) {
        const token = rest[i];
        if (token === "--provider") {
          providerRaw = String(rest[i + 1] || "").trim();
          i += 1;
          continue;
        }
        if (token.startsWith("--provider=")) {
          providerRaw = token.slice("--provider=".length).trim();
          continue;
        }
      }
      const explicitProvider = normalizeProviderName(providerRaw);
      let provider = explicitProvider;
      if (!provider && options.allowPrompt === true) {
        provider = await promptProviderSelection();
      }
      if (!provider) {
        provider = resolveProviderFromInput(providerRaw);
      }
      if (!provider) {
        fail("Missing provider. Pass --provider <openai|claude> or set KAIR_LLM_PROVIDER.");
      }
      provider = await loginProvider(provider, {
        allowInteractiveAuth: options.allowPrompt === true,
      });
      console.log(`OAuth login complete for provider: ${provider}`);
      break;
    }
    case "contract": {
      if (hasHelpFlag(rest)) {
        printContractHelp();
        return;
      }
      let withGit = false;
      const filtered: string[] = [];
      for (const token of rest) {
        if (token === "--with=git") {
          withGit = true;
          continue;
        }
        filtered.push(token);
      }
      const { remaining, idRaw } = extractProposeOptions(filtered);
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
      const contract = proposeContract(intent, [], id);
      console.log(`Created a Kair Contract: ${contract.id}`);
      console.log(`Intent: ${contract.intent}`);
      console.log(`Active version: ${contract.activeVersion ?? "none"}`);
      if (withGit) {
        ensureGitInstalled();
        ensureGitRepo();
        const checkout = checkoutContractBranch(contract.id);
        console.log(`Git branch ready: ${contractBranchName(contract.id)}`);
        console.log(`Git receipt: ${checkout.receiptPath}`);
      }
      console.log(`Next: kair plan ${contract.id}`);
      break;
    }
    case "propose": {
      if (hasHelpFlag(rest)) {
        printProposeHelp();
        return;
      }
      const hasLast = rest.includes("--last");
      const positional = rest.filter((token) => token !== "--last");
      if (hasLast && positional.length > 0) {
        fail("Specify either a contract id or --last, not both.");
      }
      if (positional.length > 1) {
        fail("Invalid arguments. Usage: propose [<contract_id>] [--last]");
      }
      let contractId = "";
      if (positional.length === 0) {
        const lastId = getLastContractId();
        if (!lastId) {
          fail("No Contracts found.");
        }
        contractId = lastId;
      } else {
        contractId = positional[0];
      }
      const contract = getContract(contractId);
      assertState(contract, ["PLANNED"], "propose");
      if (isInsideGitRepo()) {
        try {
          const uncommitted = listUncommittedContractPaths(contract.id);
          if (uncommitted.length > 0) {
            const stageHint = [
              `.kair/contracts/${contract.id}`,
              ".kair/contracts/index.json",
            ].join(" ");
            fail(
              [
                `Uncommitted plan artifacts detected for contract "${contract.id}".`,
                "Commit these files before `kair propose`:",
                ...uncommitted.map((entry) => `- ${entry}`),
                `Suggested next step: git add ${stageHint} && git commit -m "kair(plan): persist contract ${contract.id}"`,
              ].join("\n")
            );
          }
        } catch (error: any) {
          fail(error && error.message ? error.message : String(error));
        }
      }
      if (!enforceControls(contract, "approval request")) {
        return;
      }
      transition(contract, "AWAITING_APPROVAL", "Approval requested for Contract.");
      if (isInsideGitRepo()) {
        try {
          const pushed = pushContractBranch(contract.id);
          console.log(`Pushed branch ${pushed.branch}.`);
        } catch (error: any) {
          warn(`Git push skipped: ${error.message}`);
        }
      }
      break;
    }
    case "plan": {
      if (hasHelpFlag(rest)) {
        printPlanHelp();
        return;
      }
      const hasOptionToken = rest.some((token) => token.startsWith("--"));
      if (!hasOptionToken && rest.length >= 2) {
        const contractId = rest[0];
        const planText = rest.slice(1).join(" ").trim();
        if (planText && !planText.startsWith("{")) {
          const contract = getContract(contractId);
          assertState(contract, ["DRAFT"], "plan");
          contract.plan = planText;
          transition(contract, "PLANNED", `Plan captured for Contract: "${planText}".`);
          break;
        }
      }
      await handleTopLevelPlan(rest);
      break;
    }
    case "approve": {
      if (hasHelpFlag(rest)) {
        printApproveHelp();
        return;
      }
      const { remaining, actorRaw } = extractActorFlags(rest);
      const hasLast = remaining.includes("--last");
      const positional = remaining.filter((token) => token !== "--last");
      if (hasLast && positional.length > 0) {
        fail("Specify either a contract id or --last, not both.");
      }
      let contractId = "";
      let legacyParts: string[] = [];
      if (positional.length === 0) {
        const lastId = getLastContractId();
        if (!lastId) {
          fail("No Contracts found.");
        }
        contractId = lastId;
      } else {
        contractId = positional[0];
        legacyParts = positional.slice(1);
      }
      let legacyActor = "";
      if (legacyParts.length > 0) {
        legacyActor = legacyParts.join(" ").trim();
        warn(
          'Positional approver is deprecated. Use "approve <id> --actor <name>" instead.'
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
      if (rest.length === 0 || hasHelpFlag(rest)) {
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
      if (hasHelpFlag(rest)) {
        printRunHelp();
        return;
      }
      const {
        remaining,
        pauseAt,
        pauseAuthority,
        pauseReason,
        debug,
        jsonOutput,
        force,
        providerRaw,
        modelRaw,
        withGit,
        pull,
        dryRun,
        interactive,
      } = extractRunOptions(rest);
      const hasLast = remaining.includes("--last");
      const positional = remaining.filter((token) => token !== "--last");
      if (hasLast && positional.length > 0) {
        fail("Specify either a contract id or --last, not both.");
      }
      if (positional.length > 1) {
        fail(
          "Invalid arguments. Usage: run [<contract_id>] [--last] [--provider <name>] [--model <name>] [--with=git] [--pull] [--interactive] [--dry-run] [--force] [--debug] [--json]"
        );
      }
      const requestedProvider =
        rest.includes("--provider") || rest.some((token) => token.startsWith("--provider="));
      const requestedModel = rest.includes("--model") || rest.some((token) => token.startsWith("--model="));
      if (requestedProvider && !providerRaw) {
        fail("Missing value for --provider.");
      }
      if (requestedModel && !modelRaw) {
        fail("Missing value for --model.");
      }
      if (pauseAt || pauseAuthority || pauseReason) {
        fail("Run checkpoint pause options are not supported by the native runner.");
      }
      let contractId = "";
      if (positional.length === 0) {
        const lastId = getLastContractId();
        if (!lastId) {
          fail("No Contracts found.");
        }
        contractId = lastId;
      } else {
        contractId = positional[0];
      }
      const contract = getContract(contractId);
      const plan = resolveContractPlanV1(contract);
      const bypassStrictRunGate =
        (process.env.KAIR_TEST_MODE || "").trim() === "1" &&
        (process.env.KAIR_ENFORCE_APPROVAL_GATE || "").trim() !== "1";
      if (!bypassStrictRunGate) {
        ensureRequiredRunFiles(contract.id);
      }

      if (!dryRun && !bypassStrictRunGate && plan) {
        try {
          validateApprovalArtifact({
            contractId: contract.id,
            plan,
          });
        } catch (error: any) {
          fail(error.message);
        }
      }

      if (withGit) {
        ensureGitInstalled();
        ensureGitRepo();
      }
      const gitAvailable = isInsideGitRepo();
      if (pull && !gitAvailable) {
        fail("--pull requires running inside a git repository.");
      }
      if (gitAvailable) {
        const shouldPull = pull || (!pull && (await promptRunPull(options.allowPrompt === true)));
        if (shouldPull) {
          pullCurrentBranch(contract.id);
        }
      }

      if (interactive) {
        if (!plan) {
          fail("Structured plan required for --interactive run; run `kair plan` first.");
        }
        await promptRunInteractiveConfirmation(plan, options.allowPrompt === true);
      }

      const effectiveProviderRaw = await ensureRunProviderSession({
        providerRaw,
        allowPrompt: options.allowPrompt === true,
        required: !dryRun,
      });

      const runActor = resolveActor("");
      if (!jsonOutput) {
        console.log("Delegating execution to native Kair runner...");
      }
      appendStreamEvent({
        contractId: contract.id,
        phase: "run",
        event: "step.start",
        message: dryRun ? "Starting dry-run execution." : "Starting run execution.",
        print: true,
        jsonOutput,
      });
      const previousSuppressAudit = process.env.KAIR_SUPPRESS_AUDIT_LOGS;
      if (jsonOutput) {
        process.env.KAIR_SUPPRESS_AUDIT_LOGS = "1";
      }
      let runOutcome;
      try {
        runOutcome = await runContract(contract, {
          provider: effectiveProviderRaw || providerRaw || undefined,
          model: modelRaw || undefined,
          force,
          actor: runActor,
          dryRun,
        });
      } finally {
        if (jsonOutput) {
          if (previousSuppressAudit === undefined) {
            delete process.env.KAIR_SUPPRESS_AUDIT_LOGS;
          } else {
            process.env.KAIR_SUPPRESS_AUDIT_LOGS = previousSuppressAudit;
          }
        }
      }

      if (jsonOutput) {
        process.stdout.write(
          `${JSON.stringify(
            {
              contract_id: contract.id,
              status: runOutcome.result.status,
              summary: runOutcome.result.summary,
              request_path: runOutcome.requestPath,
              result_path: runOutcome.resultPath,
              enabled_tools: runOutcome.enabledTools,
              logs_path: runOutcome.result.logsPath || null,
              evidence_paths: runOutcome.result.evidencePaths || [],
              failure_reason: runOutcome.failureReason,
              missing_evidence_paths: runOutcome.missingEvidencePaths,
              claimed_evidence_paths: runOutcome.claimedEvidencePaths,
              out_of_scope_claimed_evidence_paths: runOutcome.outOfScopeClaimedEvidencePaths,
              dry_run: Boolean(dryRun),
            },
            null,
            2
          )}\n`
        );
      } else {
        console.log(`Run status: ${runOutcome.result.status}`);
        console.log(`Summary: ${runOutcome.result.summary}`);
        console.log(`Run request artifact: ${runOutcome.requestPath}`);
        console.log(`Run result artifact: ${runOutcome.resultPath}`);
        if (runOutcome.result.logsPath) {
          console.log(`Run logs: ${runOutcome.result.logsPath}`);
        }
        if (runOutcome.result.status !== "completed" && runOutcome.evidenceValidationFailed) {
          const logsRef = runOutcome.result.logsPath || "run-result.json";
          console.log(`FAILED: runner evidence validation failed. See ${logsRef} and run-result.json`);
        }
        if (debug) {
          const grants = Array.isArray(contract.controlsApproved) ? contract.controlsApproved : [];
          const runnerOutputs = runOutcome.result?.outputs || {};
          console.log("RUN DEBUG");
          console.log(`Approved grants: ${grants.length ? grants.join(", ") : "none"}`);
          console.log(`Enabled tools: ${runOutcome.enabledTools.length ? runOutcome.enabledTools.join(", ") : "none"}`);
          console.log(
            `Claimed evidence paths: ${
              runOutcome.claimedEvidencePaths.length ? runOutcome.claimedEvidencePaths.join(", ") : "none"
            }`
          );
          console.log(
            `Missing evidence paths: ${
              runOutcome.missingEvidencePaths.length ? runOutcome.missingEvidencePaths.join(", ") : "none"
            }`
          );
          console.log(
            `Out-of-scope evidence paths: ${
              runOutcome.outOfScopeClaimedEvidencePaths.length
                ? runOutcome.outOfScopeClaimedEvidencePaths.join(", ")
                : "none"
            }`
          );
          console.log(`Run request path: ${runOutcome.requestPath}`);
          console.log(`Run result path: ${runOutcome.resultPath}`);
          if (runnerOutputs.commandPath) {
            console.log(`Runner command: ${runnerOutputs.commandPath}`);
          }
          if (runnerOutputs.effectiveProvider) {
            console.log(`Runner provider: ${runnerOutputs.effectiveProvider}`);
          }
          if (runnerOutputs.effectiveModel) {
            console.log(`Runner model: ${runnerOutputs.effectiveModel}`);
          }
          if (runnerOutputs.stateDir) {
            console.log(`Runner state dir: ${runnerOutputs.stateDir}`);
          }
          if (runnerOutputs.configPath) {
            console.log(`Runner config path: ${runnerOutputs.configPath}`);
          }
          if (runnerOutputs.stdoutLogPath) {
            console.log(`Runner stdout log: ${runnerOutputs.stdoutLogPath}`);
          }
          if (runnerOutputs.stderrLogPath) {
            console.log(`Runner stderr log: ${runnerOutputs.stderrLogPath}`);
          }
          if (runnerOutputs.parserMode) {
            console.log(`Runner parser mode: ${runnerOutputs.parserMode}`);
          }
        }
      }

      appendStreamEvent({
        contractId: contract.id,
        phase: "run",
        event: "summary",
        level: runOutcome.result.status === "completed" ? "info" : "error",
        message: `Run finished with status: ${runOutcome.result.status}.`,
        data: { dry_run: Boolean(dryRun) },
      });

      if (runOutcome.result.status !== "completed") {
        fail(runOutcome.result.summary || "Execution failed.");
      }
      break;
    }
    case "pause": {
      if (hasHelpFlag(rest)) {
        printPauseHelp();
        return;
      }
      const { remaining, actorRaw } = extractActorFlags(rest);
      const hasLast = remaining.includes("--last");
      const positional = remaining.filter((token) => token !== "--last");
      if (hasLast && positional.length > 0) {
        fail("Specify either a contract id or --last, not both.");
      }
      let contractId = "";
      let legacyParts: string[] = [];
      if (positional.length === 0) {
        const lastId = getLastContractId();
        if (!lastId) {
          fail("No Contracts found.");
        }
        contractId = lastId;
      } else {
        contractId = positional[0];
        legacyParts = positional.slice(1);
      }
      let legacyActor = "";
      if (legacyParts.length > 0) {
        legacyActor = legacyParts.join(" ").trim();
        warn('Positional actor is deprecated. Use "pause <id> --actor <name>" instead.');
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
      if (hasHelpFlag(rest)) {
        printResumeHelp();
        return;
      }
      const { remaining } = extractActorFlags(rest);
      const hasLast = remaining.includes("--last");
      const positional = remaining.filter((token) => token !== "--last");
      if (hasLast && positional.length > 0) {
        fail("Specify either a contract id or --last, not both.");
      }
      if (positional.length > 1) {
        fail("Invalid arguments. Usage: resume [<contract_id>] [--last]");
      }
      const contractId = (() => {
        if (positional.length === 0) {
          const lastId = getLastContractId();
          if (!lastId) {
            fail("No Contracts found.");
          }
          return lastId;
        }
        return positional[0];
      })();
      const contract = getContract(contractId);
      await resumeContract(contract);
      break;
    }
    case "rewind": {
      if (hasHelpFlag(rest)) {
        printRewindHelp();
        return;
      }
      const { remaining, actorRaw } = extractActorFlags(rest);
      const hasLast = remaining.includes("--last");
      const positional = remaining.filter((token) => token !== "--last");
      if (hasLast && positional.length > 0) {
        fail("Specify either a contract id or --last, not both.");
      }
      let contractId = "";
      let reasonParts: string[] = [];
      if (positional.length === 0) {
        const lastId = getLastContractId();
        if (!lastId) {
          fail("No Contracts found.");
        }
        contractId = lastId;
      } else {
        contractId = positional[0];
        reasonParts = positional.slice(1);
      }
      const contract = getContract(contractId);
      assertState(contract, ["RUNNING", "PAUSED", "FAILED", "COMPLETED"], "rewind");
      let legacyActor = "";
      let reasonText = "";
      if (!actorRaw && reasonParts.length >= 2) {
        legacyActor = reasonParts[0].trim();
        reasonText = reasonParts.slice(1).join(" ").trim();
        warn(
          'Positional actor is deprecated. Use "rewind <id> --actor <name> <reason>" instead.'
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
      if (hasHelpFlag(rest)) {
        printStatusHelp();
        return;
      }
      let contractId = "";
      if (rest.length === 0 || (rest.length === 1 && rest[0] === "--last")) {
        const lastId = getLastContractId();
        if (!lastId) {
          fail("No Contracts found.");
        }
        contractId = lastId;
      } else if (rest.length === 1) {
        contractId = rest[0];
      } else {
        fail("Invalid arguments. Usage: status [<contract_id>] [--last]");
      }
      const contract = getContract(contractId);
      showContractStatus(contract);
      break;
    }
    case "review": {
      if (hasHelpFlag(rest)) {
        printReviewHelp();
        return;
      }
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
      if (hasHelpFlag(rest)) {
        printAcceptHelp();
        return;
      }
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
      if (hasHelpFlag(rest)) {
        printEmitHelp();
        return;
      }
      const hasLast = rest.includes("--last");
      const positional = rest.filter((token) => token !== "--last");
      if (hasLast && positional.length > 0) {
        fail("Specify either a contract id or --last, not both.");
      }
      if (positional.length > 1) {
        fail("Invalid arguments. Usage: emit [<contract_id>] [--last]");
      }
      let contractId = "";
      if (positional.length === 0) {
        const lastId = getLastContractId();
        if (!lastId) {
          fail("No Contracts found.");
        }
        contractId = lastId;
      } else {
        contractId = positional[0];
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
    case "contracts": {
      if (hasHelpFlag(rest)) {
        printContractsHelp();
        return;
      }
      requireArgs(rest, 0, "contracts");
      listContracts();
      break;
    }
    case "logins": {
      if (hasHelpFlag(rest)) {
        printLoginsHelp();
        return;
      }
      requireArgs(rest, 0, "logins");
      await listLogins();
      break;
    }
    case "prune": {
      if (rest.length === 0 || hasHelpFlag(rest)) {
        printPruneHelp();
        return;
      }
      const parsedPrune = parsePruneOptions(rest);
      if (!parsedPrune.all) {
        printPruneHelp();
        return;
      }
      const contractIds = [...contractStore.contracts.keys()].sort((a, b) => a.localeCompare(b));
      const artifactsDir = getArtifactsDir();
      console.log("PRUNE PREVIEW");
      console.log("Contracts to delete:");
      if (contractIds.length === 0) {
        console.log("- (none)");
      } else {
        for (const id of contractIds) {
          console.log(`- ${id}`);
        }
      }
      console.log(`Artifacts directory to clear: ${artifactsDir}`);
      const confirmed = await promptPruneConfirmation();
      if (!confirmed) {
        console.log("Prune cancelled.");
        return;
      }
      const { dataFile } = resetContractsAndArtifacts();
      console.log(`Prune complete. Deleted ${contractIds.length} contract(s).`);
      console.log(`Contracts store reset: ${dataFile}`);
      console.log(`Artifacts cleared: ${artifactsDir}`);
      break;
    }
    default:
      failWithHelp(`Unknown command "${command}".`, "top");
  }
}
