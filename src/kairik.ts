import * as fs from "node:fs";
import * as path from "node:path";
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";

const STATES = [
  "DRAFT",
  "PLANNED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "RUNNING",
  "PAUSED",
  "FAILED",
  "COMPLETED",
  "REWOUND",
];

const CONTROL_REGISTRY = new Set([
  "cloudflare:read",
  "cloudflare:write",
  "github:read",
  "github:write",
  "schwab:read",
  "local:read",
  "local:write",
]);

const RUN_CHECKPOINTS = [
  { id: "checkpoint_1", message: "Checkpoint: execution is underway." },
  { id: "checkpoint_2", message: "Checkpoint: validation completed." },
];
const RUN_CHECKPOINT_IDS = new Set(RUN_CHECKPOINTS.map((checkpoint) => checkpoint.id));
const MAX_ID_LENGTH = 80;
const ID_PATTERN = /^[a-z0-9][a-z0-9-_]*$/;

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "contracts.json");

const contractStore = {
  contracts: new Map(),
  nextId: 1,
};

const USE_COLOR = process.stdout.isTTY;
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function style(text, ...styles) {
  if (!USE_COLOR) {
    return text;
  }
  return `${styles.join("")}${text}${COLORS.reset}`;
}

function label(text) {
  return style(text, COLORS.dim);
}

function heading(text) {
  return style(text, COLORS.bold, COLORS.cyan);
}

function stateColor(state) {
  switch (state) {
    case "DRAFT":
      return COLORS.gray;
    case "PLANNED":
      return COLORS.blue;
    case "AWAITING_APPROVAL":
      return COLORS.yellow;
    case "APPROVED":
      return COLORS.green;
    case "RUNNING":
      return COLORS.blue;
    case "PAUSED":
      return COLORS.yellow;
    case "FAILED":
      return COLORS.red;
    case "COMPLETED":
      return COLORS.green;
    case "REWOUND":
      return COLORS.magenta;
    case "RESUMED":
      return COLORS.cyan;
    default:
      return COLORS.gray;
  }
}

function formatState(state) {
  return style(state, stateColor(state), COLORS.bold);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function formatTimestampForId(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}`;
}

function suggestContractId(intent) {
  const stamp = formatTimestampForId();
  const words = intent
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  const slugBase = slugify(words.join(" ")) || "contract";
  const maxSlugLength = Math.max(8, MAX_ID_LENGTH - stamp.length - 1);
  const slug = slugBase.slice(0, maxSlugLength);
  return `${slug}-${stamp}`.slice(0, MAX_ID_LENGTH);
}

function validateContractId(id) {
  if (!id) {
    return "Contract id cannot be empty.";
  }
  if (id.length > MAX_ID_LENGTH) {
    return `Contract id must be ${MAX_ID_LENGTH} characters or fewer.`;
  }
  if (!ID_PATTERN.test(id)) {
    return "Contract id must use only lowercase letters, numbers, hyphens, or underscores.";
  }
  return null;
}

function printTopHelp() {
  console.log(`Kairik CLI

Usage:
  kairik contract <subcommand> [args]
  kairik propose "<intent>" [--requires <controls_csv>] [--id <contract_id>]

Common subcommands:
  propose "<intent>" [--requires <controls_csv>]
  plan "<contract_id>" "<plan>"
  require-controls "<contract_id>" "<controls_csv>"
  add-control "<contract_id>" "<control>" [--actor <name>]
  request-approval "<contract_id>"
  approve "<contract_id>" [--actor <name>]
  run "<contract_id>" [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]
  resume "<contract_id>" [--actor <name>]
  pause "<contract_id>" [--actor <name>]
  rewind "<contract_id>" [--actor <name>] [<reason>]
  status "<contract_id>"
  list

Checkpoints:
  ${RUN_CHECKPOINTS.map((checkpoint) => checkpoint.id).join(", ")}

Alias:
  kairik propose (shorthand for contract propose)

Actor flags:
  --actor <name> (alias: --by)

Run "kairik contract --help" for full details.`);
}

function printContractHelp() {
  console.log(`Kairik Contract Commands

Usage:
  kairik contract <subcommand> [args]

Subcommands:
  propose "<intent>" [--requires <controls_csv>] [--id <contract_id>]
  plan "<contract_id>" "<plan>"
  require-controls "<contract_id>" "<controls_csv>"
  add-control "<contract_id>" "<control>" [--actor <name>]
  request-approval "<contract_id>"
  approve "<contract_id>" [--actor <name>]
  run "<contract_id>" [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]
  resume "<contract_id>" [--actor <name>]
  pause "<contract_id>" [--actor <name>]
  rewind "<contract_id>" [--actor <name>] [<reason>]
  status "<contract_id>"
  list

Checkpoints:
  ${RUN_CHECKPOINTS.map((checkpoint) => checkpoint.id).join(", ")}

Alias:
  kairik propose (shorthand for contract propose)

Actor flags:
  --actor <name> (alias: --by)
`);
}

function now() {
  return new Date().toISOString();
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function failWithHelp(message, context = "top") {
  if (context === "contract") {
    printContractHelp();
  } else {
    printTopHelp();
  }
  console.error(`Error: ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`Warning: ${message}`);
}

function readGitActor() {
  try {
    const result = spawnSync("git", ["config", "user.name"], { encoding: "utf8" });
    if (result.status === 0) {
      const name = String(result.stdout || "").trim();
      if (name) {
        return name;
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

function readWhoAmI() {
  try {
    const result = spawnSync("whoami", [], { encoding: "utf8" });
    if (result.status === 0) {
      const name = String(result.stdout || "").trim();
      if (name) {
        return name;
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

function resolveActor(explicit) {
  const explicitActor = (explicit || "").trim();
  if (explicitActor) {
    return explicitActor;
  }
  const envActor = (process.env.KAIRIK_ACTOR || "").trim();
  if (envActor) {
    return envActor;
  }
  const gitActor = readGitActor();
  if (gitActor) {
    return gitActor;
  }
  const envUser = (process.env.USER || process.env.USERNAME || "").trim();
  if (envUser) {
    return envUser;
  }
  const whoami = readWhoAmI();
  if (whoami) {
    return whoami;
  }
  return "unknown";
}

function logAudit(contractId, label, message, timestamp = now()) {
  console.log(`${timestamp} | ${contractId} | ${label} | ${message}`);
}

function loadStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    if (!raw.trim()) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.contracts)) {
      return;
    }
    contractStore.contracts.clear();
    for (const contract of parsed.contracts) {
      if (contract && contract.id) {
        contractStore.contracts.set(contract.id, contract);
      }
    }
    contractStore.nextId = Number(parsed.nextId) || contractStore.contracts.size + 1;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    fail(`Failed to load contracts store: ${error.message}`);
  }
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload = {
    nextId: contractStore.nextId,
    contracts: [...contractStore.contracts.values()],
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2));
}

function getContract(id) {
  const contract = contractStore.contracts.get(id);
  if (!contract) {
    fail(`Unknown Contract "${id}".`);
  }
  return contract;
}

function assertState(contract, allowed, action) {
  if (!allowed.includes(contract.current_state)) {
    fail(
      `Cannot ${action} Contract "${contract.id}" because state is ${contract.current_state}. Allowed: ${allowed.join(
        ", "
      )}.`
    );
  }
}

function recordHistory(contract, label, message, actor) {
  const timestamp = now();
  contract.timestamps.updated_at = timestamp;
  const entry = {
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

function transition(contract, nextState, reason, actor) {
  if (!STATES.includes(nextState)) {
    fail(`Invalid state "${nextState}".`);
  }
  contract.current_state = nextState;
  recordHistory(contract, nextState, reason, actor);
}

function parseControls(input) {
  if (!input) {
    return [];
  }
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeControls(list) {
  const seen = new Set();
  const result = [];
  for (const item of list) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function validateControls(list) {
  const invalid = list.filter((control) => !CONTROL_REGISTRY.has(control));
  if (invalid.length > 0) {
    fail(`Unknown Controls: ${invalid.join(", ")}. Allowed: ${[...CONTROL_REGISTRY].join(", ")}.`);
  }
}

function missingControls(contract) {
  const approved = new Set(contract.controlsApproved);
  return contract.controlsRequired.filter((control) => !approved.has(control));
}

function describeControls(list) {
  return list.length === 0 ? "none" : list.join(", ");
}

function enforceControls(contract, context, options = {}) {
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

function proposeContract(intent, controlsRequired, idOverride) {
  const id = idOverride || `contract_${contractStore.nextId}`;
  contractStore.nextId += 1;
  const timestamp = now();
  const contract = {
    id,
    intent,
    plan: null,
    current_state: "DRAFT",
    history: [],
    approvals: [],
    executor_ref: null,
    artifacts: [],
    controlsRequired: controlsRequired,
    controlsApproved: [],
    activeVersion: null,
    versions: [],
    pauseContext: null,
    timestamps: {
      created_at: timestamp,
      updated_at: timestamp,
    },
  };
  contractStore.contracts.set(id, contract);
  const controlsNote = controlsRequired.length
    ? ` Controls required by this proposal: ${controlsRequired.join(", ")}.`
    : " Controls required by this proposal: none.";
  const reason = `Propose a Kairik Contract: "${intent}".${controlsNote}`;
  recordHistory(contract, "DRAFT", reason);
  return contract;
}

function requireArgs(args, minCount, usage) {
  if (args.length < minCount) {
    fail(`Missing arguments. Usage: ${usage}`);
  }
}

async function promptForProposeInput({ intent, idRaw }) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    let finalIntent = intent;
    while (!finalIntent) {
      const answer = await rl.question("What is the intent of your proposed contract? ");
      finalIntent = answer.trim();
    }

    let finalId = idRaw;
    if (!finalId) {
      const suggested = suggestContractId(finalIntent);
      while (true) {
        const answer = await rl.question(`Contract id [${suggested}]: `);
        const candidate = (answer.trim() || suggested).trim();
        const error = validateContractId(candidate);
        if (error) {
          console.log(error);
          continue;
        }
        if (contractStore.contracts.has(candidate)) {
          console.log(`Contract id "${candidate}" already exists. Choose a different id.`);
          continue;
        }
        finalId = candidate;
        break;
      }
    }

    return { intent: finalIntent, id: finalId };
  } finally {
    rl.close();
  }
}

function writeArtifact(contract, proposalSummary) {
  const dir = path.join("artifacts", contract.id);
  fs.mkdirSync(dir, { recursive: true });
  const safeTimestamp = now().replace(/[:.]/g, "-");
  const filename = `${safeTimestamp}-run.json`;
  const payload = {
    contract_id: contract.id,
    executedVersion: contract.activeVersion,
    controlsApproved: [...contract.controlsApproved],
    proposal: proposalSummary,
    outcome: "mock ok",
  };
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  contract.artifacts.push({
    type: "run",
    content: filePath,
  });
}

function showContractStatus(contract) {
  const timestamp = now();
  console.log(`${timestamp} | ${contract.id} | STATUS | Audit report generated.`);
  console.log(`\n${heading("Contract Summary")}`);
  console.log(`${label("Contract")}: ${contract.id}`);
  console.log(`${label("Created")}: ${contract.timestamps.created_at}`);
  console.log(`${label("Last updated")}: ${contract.timestamps.updated_at}`);
  console.log(`${label("Intent")}: ${contract.intent}`);
  console.log(`${label("Plan")}: ${contract.plan ? contract.plan : "none"}`);
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
  const rewindEntries = contract.history.filter((entry) => entry.state === "REWOUND");
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

function listContracts() {
  const contracts = [...contractStore.contracts.values()];
  if (contracts.length === 0) {
    console.log("No Contracts found.");
    return;
  }
  const sorted = contracts.sort((a, b) => {
    const aTime = new Date(a.timestamps?.created_at || 0).getTime();
    const bTime = new Date(b.timestamps?.created_at || 0).getTime();
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return String(a.id).localeCompare(String(b.id));
  });
  for (const contract of sorted) {
    console.log(contract.id);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCheckpoints(contract, startIndex, options) {
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

function finalizeRun(contract) {
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

async function runContract(contract, options = {}) {
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

async function resumeContract(contract, authority) {
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

function parseContractCommand(tokens) {
  let command = tokens[0];
  let args = tokens.slice(1);
  let isContractGroup = false;
  if (command === "contract") {
    isContractGroup = true;
    if (args.length === 0) {
      printContractHelp();
      process.exit(0);
    }
    if (args[0] === "-h" || args[0] === "--help") {
      printContractHelp();
      process.exit(0);
    }
    command = args[0];
    args = args.slice(1);
  }
  return { command, args, isContractGroup };
}

function extractRequires(args) {
  const remaining = [];
  let requiredRaw = "";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--requires") {
      requiredRaw = args[i + 1] || "";
      i += 1;
      continue;
    }
    remaining.push(args[i]);
  }
  return { remaining, requiredRaw };
}

function extractActorFlags(args) {
  const remaining = [];
  let actorRaw = "";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--actor" || args[i] === "--by") {
      actorRaw = args[i + 1] || "";
      i += 1;
      continue;
    }
    remaining.push(args[i]);
  }
  return { remaining, actorRaw };
}

function extractProposeOptions(args) {
  const remaining = [];
  let requiredRaw = "";
  let idRaw = "";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--requires") {
      requiredRaw = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (args[i] === "--id") {
      idRaw = args[i + 1] || "";
      i += 1;
      continue;
    }
    remaining.push(args[i]);
  }
  return { remaining, requiredRaw, idRaw };
}

function extractRunOptions(args) {
  const remaining = [];
  let pauseAt = "";
  let pauseAuthority = "";
  let pauseReason = "";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--pause-at") {
      pauseAt = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (args[i] === "--pause-authority") {
      pauseAuthority = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (args[i] === "--pause-reason") {
      pauseReason = args[i + 1] || "";
      i += 1;
      continue;
    }
    remaining.push(args[i]);
  }
  return { remaining, pauseAt, pauseAuthority, pauseReason };
}

function normalizePauseAt(pauseAtRaw) {
  if (!pauseAtRaw) {
    return null;
  }
  const pauseAt = pauseAtRaw.trim();
  if (!pauseAt) {
    return null;
  }
  if (!RUN_CHECKPOINT_IDS.has(pauseAt)) {
    fail(
      `Unknown pause checkpoint "${pauseAt}". Allowed: ${RUN_CHECKPOINTS.map(
        (checkpoint) => checkpoint.id
      ).join(", ")}.`
    );
  }
  return pauseAt;
}

async function executeCommand(tokens, options = {}) {
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
      console.log(`Next: kairik contract plan ${contract.id} "..."`);
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
      contract.approvals.push({ at: now(), approver: actor, actor });
      const version = contract.versions.length + 1;
      contract.activeVersion = version;
      contract.versions.push({
        version,
        kind: "approval",
        at: now(),
        note: `Approved by ${actor}.`,
        controlsApproved: [...contract.controlsApproved],
        plan: contract.plan,
        intent: contract.intent,
      });
      transition(
        contract,
        "APPROVED",
        `Approve a Kairik Contract. Actor: ${actor}.`,
        actor
      );
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
      const previousVersion = contract.activeVersion;
      const version = contract.versions.length + 1;
      contract.activeVersion = version;
      contract.versions.push({
        version,
        kind: "rewind",
        at: now(),
        note: `Rewound by ${actor}. Supersedes v${previousVersion ?? "none"}.`,
        controlsApproved: [...contract.controlsApproved],
        plan: contract.plan,
        intent: contract.intent,
      });
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

async function main() {
  let rawArgs = process.argv.slice(2);
  if (rawArgs[0] === "kairik") {
    rawArgs = rawArgs.slice(1);
  }
  if (rawArgs.length === 0) {
    printTopHelp();
    return;
  }
  if (rawArgs.length === 1 && (rawArgs[0] === "-h" || rawArgs[0] === "--help")) {
    printTopHelp();
    return;
  }

  loadStore();

  const commandGroups = [];
  let current = [];
  for (const arg of rawArgs) {
    if (arg === "--") {
      if (current.length > 0) {
        commandGroups.push(current);
        current = [];
      }
      continue;
    }
    current.push(arg);
  }
  if (current.length > 0) {
    commandGroups.push(current);
  }

  const allowPrompt = process.stdin.isTTY && process.stdout.isTTY;
  const isChained = commandGroups.length > 1;

  for (const group of commandGroups) {
    await executeCommand(group, { allowPrompt, isChained });
  }
}

main().catch((err) => {
  fail(err && err.message ? err.message : String(err));
});
