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

const contractStore = {
  contracts: new Map(),
  nextId: 1,
};

function now() {
  return new Date().toISOString();
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function logAudit(contractId, label, message, timestamp = now()) {
  console.log(`${timestamp} | ${contractId} | ${label} | ${message}`);
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

function recordHistory(contract, label, message) {
  const timestamp = now();
  contract.timestamps.updated_at = timestamp;
  contract.history.push({
    at: timestamp,
    state: label,
    message,
  });
  logAudit(contract.id, label, message, timestamp);
}

function transition(contract, nextState, reason) {
  if (!STATES.includes(nextState)) {
    fail(`Invalid state "${nextState}".`);
  }
  contract.current_state = nextState;
  recordHistory(contract, nextState, reason);
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
  const approved = new Set(contract.controls_approved);
  return contract.controls_required.filter((control) => !approved.has(control));
}

function describeControls(list) {
  return list.length === 0 ? "none" : list.join(", ");
}

function enforceControls(contract, context) {
  const missing = missingControls(contract);
  if (missing.length > 0) {
    const message = `Blocked: proposal requires missing Controls: ${missing.join(
      ", "
    )}. Resolution paths: revise the proposal; add/approve the required Controls; rewind to update the Contract; or fork into a new Contract.`;
    recordHistory(contract, "CONTROLS", message);
    fail(`Contract "${contract.id}" blocked due to missing Controls: ${missing.join(", ")}.`);
  }
  recordHistory(
    contract,
    "CONTROLS",
    `Controls check passed for ${context}. Required: ${describeControls(
      contract.controls_required
    )}. Approved: ${describeControls(contract.controls_approved)}.`
  );
}

function proposeContract(intent, controlsRequired) {
  const id = `contract_${contractStore.nextId++}`;
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
    controls_required: controlsRequired,
    controls_approved: [],
    timestamps: {
      created_at: timestamp,
      updated_at: timestamp,
    },
  };
  contractStore.contracts.set(id, contract);
  const controlsNote = controlsRequired.length
    ? ` Controls required by this proposal: ${controlsRequired.join(", ")}.`
    : " Controls required by this proposal: none.";
  const reason = `Proposed Contract because intent was provided: "${intent}".${controlsNote}`;
  contract.history.push({ at: timestamp, state: "DRAFT", message: reason });
  logAudit(id, "DRAFT", reason, timestamp);
  return contract;
}

function requireArgs(args, minCount, usage) {
  if (args.length < minCount) {
    fail(`Missing arguments. Usage: ${usage}`);
  }
}

function showContractStatus(contract) {
  const timestamp = now();
  console.log(`${timestamp} | ${contract.id} | STATUS | Audit report generated.`);
  console.log(`Contract: ${contract.id}`);
  console.log(`Created: ${contract.timestamps.created_at}`);
  console.log(`Last updated: ${contract.timestamps.updated_at}`);
  console.log(`Intent: ${contract.intent}`);
  console.log(`Plan: ${contract.plan ? contract.plan : "none"}`);
  console.log(`Current state: ${contract.current_state}`);
  console.log(`Controls required: ${describeControls(contract.controls_required)}`);
  console.log(`Controls approved: ${describeControls(contract.controls_approved)}`);
  const missing = missingControls(contract);
  console.log(`Controls missing: ${describeControls(missing)}`);
  console.log("Approvals:");
  if (contract.approvals.length === 0) {
    console.log("- none recorded");
  } else {
    for (const approval of contract.approvals) {
      console.log(`- ${approval.at} | ${approval.approver}`);
    }
  }
  console.log("Rewinds:");
  const rewindEntries = contract.history.filter((entry) => entry.state === "REWOUND");
  if (rewindEntries.length === 0) {
    console.log("- none recorded");
  } else {
    for (const entry of rewindEntries) {
      console.log(`- ${entry.at} | ${entry.message}`);
    }
  }
  console.log("History (append-only):");
  for (const entry of contract.history) {
    console.log(`- ${entry.at} | ${entry.state} | ${entry.message}`);
  }
  console.log("Artifacts:");
  if (contract.artifacts.length === 0) {
    console.log("- none recorded");
  } else {
    for (const artifact of contract.artifacts) {
      console.log(`- ${artifact.type} | ${artifact.content}`);
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runContract(contract) {
  assertState(contract, ["APPROVED"], "run");
  enforceControls(contract, "execution");
  transition(contract, "RUNNING", "Execution started for the approved Contract.");
  await wait(400);
  logAudit(contract.id, contract.current_state, "Checkpoint: execution is underway.");
  await wait(400);
  logAudit(contract.id, contract.current_state, "Checkpoint: validation completed.");
  await wait(400);
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
  transition(contract, "COMPLETED", "Execution completed successfully for the approved Contract.");
}

function parseContractCommand(tokens) {
  let command = tokens[0];
  let args = tokens.slice(1);
  if (command === "contract") {
    if (args.length === 0) {
      fail("Missing contract subcommand.");
    }
    command = args[0];
    args = args.slice(1);
  }
  return { command, args };
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

async function executeCommand(tokens) {
  const parsed = parseContractCommand(tokens);
  const command = parsed.command;
  const rest = parsed.args;
  if (!command) {
    fail("No command provided.");
  }

  switch (command) {
    case "propose":
    case "create": {
      const { remaining, requiredRaw } = extractRequires(rest);
      requireArgs(remaining, 1, 'contract propose "<intent>" [--requires <controls_csv>]');
      const intent = remaining.join(" ").trim();
      if (!intent) {
        fail("Intent cannot be empty.");
      }
      const controlsRequired = normalizeControls(parseControls(requiredRaw));
      validateControls(controlsRequired);
      proposeContract(intent, controlsRequired);
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
      contract.controls_required = controlsRequired;
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
      enforceControls(contract, "approval request");
      transition(contract, "AWAITING_APPROVAL", "Approval requested for Contract.");
      break;
    }
    case "approve": {
      requireArgs(rest, 2, 'contract approve "<contract_id>" "<approver>"');
      const [contractId, ...approverParts] = rest;
      const approver = approverParts.join(" ").trim();
      if (!approver) {
        fail("Approver cannot be empty.");
      }
      const contract = getContract(contractId);
      assertState(contract, ["AWAITING_APPROVAL"], "approve");
      contract.approvals.push({ at: now(), approver });
      transition(contract, "APPROVED", `Approved Contract by ${approver}.`);
      break;
    }
    case "approve-control":
    case "add-control": {
      requireArgs(rest, 3, 'contract approve-control "<contract_id>" "<control>" "<approver>"');
      const [contractId, control, ...approverParts] = rest;
      const approver = approverParts.join(" ").trim();
      if (!approver) {
        fail("Approver cannot be empty.");
      }
      validateControls([control]);
      const contract = getContract(contractId);
      if (!contract.controls_approved.includes(control)) {
        contract.controls_approved.push(control);
        recordHistory(contract, "CONTROLS", `Control "${control}" approved by ${approver}.`);
      } else {
        recordHistory(contract, "CONTROLS", `Control "${control}" reaffirmed by ${approver}.`);
      }
      break;
    }
    case "run":
    case "execute": {
      requireArgs(rest, 1, 'contract run "<contract_id>"');
      const [contractId] = rest;
      const contract = getContract(contractId);
      await runContract(contract);
      break;
    }
    case "pause": {
      requireArgs(rest, 1, 'contract pause "<contract_id>"');
      const [contractId] = rest;
      const contract = getContract(contractId);
      assertState(contract, ["RUNNING"], "pause");
      transition(contract, "PAUSED", "Paused Contract execution.");
      break;
    }
    case "rewind": {
      requireArgs(rest, 1, 'contract rewind "<contract_id>" [<authority>] [<reason>]');
      const [contractId, ...reasonParts] = rest;
      const contract = getContract(contractId);
      assertState(contract, ["RUNNING", "PAUSED", "FAILED", "COMPLETED"], "rewind");
      let authority = "operator";
      let reasonText = "";
      if (reasonParts.length >= 2) {
        authority = reasonParts[0].trim() || "operator";
        reasonText = reasonParts.slice(1).join(" ").trim();
      } else if (reasonParts.length === 1) {
        reasonText = reasonParts[0].trim();
      }
      const reasonChunks = [
        "Rewound Contract because a rewind was requested.",
        `Authority: ${authority}.`,
      ];
      if (reasonText) {
        reasonChunks.push(`Reason: "${reasonText}".`);
      } else {
        reasonChunks.push("Reason: not provided.");
      }
      transition(contract, "REWOUND", reasonChunks.join(" "));
      break;
    }
    case "status": {
      requireArgs(rest, 1, 'contract status "<contract_id>"');
      const [contractId] = rest;
      const contract = getContract(contractId);
      showContractStatus(contract);
      break;
    }
    default:
      fail(`Unknown command "${command}".`);
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0) {
    fail("No command provided.");
  }

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

  for (const group of commandGroups) {
    await executeCommand(group);
  }
}

main().catch((err) => {
  fail(err && err.message ? err.message : String(err));
});
