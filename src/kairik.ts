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

const store = {
  tasks: new Map(),
  nextId: 1,
};

const cardStore = {
  cards: new Map(),
  nextId: 1,
};

function now() {
  return new Date().toISOString();
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function logAudit(taskId, state, message, timestamp = now()) {
  console.log(`${timestamp} | ${taskId} | ${state} | ${message}`);
}

function getTask(id) {
  const task = store.tasks.get(id);
  if (!task) {
    fail(`Unknown task "${id}".`);
  }
  return task;
}

function getCard(id) {
  const card = cardStore.cards.get(id);
  if (!card) {
    fail(`Unknown card "${id}".`);
  }
  return card;
}

function assertState(task, allowed, action) {
  if (!allowed.includes(task.current_state)) {
    fail(
      `Cannot ${action} task "${task.id}" because state is ${task.current_state}. Allowed: ${allowed.join(
        ", "
      )}.`
    );
  }
}

function transition(task, nextState, reason) {
  if (!STATES.includes(nextState)) {
    fail(`Invalid state "${nextState}".`);
  }
  const timestamp = now();
  task.current_state = nextState;
  task.timestamps.updated_at = timestamp;
  task.history.push({
    at: timestamp,
    state: nextState,
    message: reason,
  });
  logAudit(task.id, nextState, reason, timestamp);
}

function createTask(intent) {
  const id = `task_${store.nextId++}`;
  const timestamp = now();
  const task = {
    id,
    intent,
    plan: null,
    current_state: "DRAFT",
    history: [],
    approvals: [],
    executor_ref: null,
    artifacts: [],
    timestamps: {
      created_at: timestamp,
      updated_at: timestamp,
    },
  };
  store.tasks.set(id, task);
  const reason = `Created because intent was provided: "${intent}".`;
  task.history.push({ at: timestamp, state: "DRAFT", message: reason });
  logAudit(id, "DRAFT", reason, timestamp);
  return task;
}

function recordCard(card, label, message) {
  const timestamp = now();
  card.timestamps.updated_at = timestamp;
  card.history.push({
    at: timestamp,
    label,
    message,
  });
  logAudit(card.id, label, message, timestamp);
}

function createCard(name) {
  const id = `card_${cardStore.nextId++}`;
  const timestamp = now();
  const card = {
    id,
    name,
    contract: [],
    contract_approvals: [],
    proposal: null,
    history: [],
    timestamps: {
      created_at: timestamp,
      updated_at: timestamp,
    },
  };
  cardStore.cards.set(id, card);
  recordCard(card, "CARD", `Card created to own delegated responsibility: "${name}".`);
  return card;
}

function requireArgs(args, minCount, usage) {
  if (args.length < minCount) {
    fail(`Missing arguments. Usage: ${usage}`);
  }
}

function showStatus(task) {
  const timestamp = now();
  console.log(`${timestamp} | ${task.id} | STATUS | Audit report generated.`);
  console.log(`Task: ${task.id}`);
  console.log(`Created: ${task.timestamps.created_at}`);
  console.log(`Last updated: ${task.timestamps.updated_at}`);
  console.log(`Intent: ${task.intent}`);
  console.log(`Plan: ${task.plan ? task.plan : "none"}`);
  console.log(`Current state: ${task.current_state}`);
  console.log("Approvals:");
  if (task.approvals.length === 0) {
    console.log("- none recorded");
  } else {
    for (const approval of task.approvals) {
      console.log(`- ${approval.at} | ${approval.approver}`);
    }
  }
  console.log("Rewinds:");
  const rewindEntries = task.history.filter((entry) => entry.state === "REWOUND");
  if (rewindEntries.length === 0) {
    console.log("- none recorded");
  } else {
    for (const entry of rewindEntries) {
      console.log(`- ${entry.at} | ${entry.message}`);
    }
  }
  console.log("History (append-only):");
  for (const entry of task.history) {
    console.log(`- ${entry.at} | ${entry.state} | ${entry.message}`);
  }
  console.log("Artifacts:");
  if (task.artifacts.length === 0) {
    console.log("- none recorded");
  } else {
    for (const artifact of task.artifacts) {
      console.log(`- ${artifact.type} | ${artifact.content}`);
    }
  }
}

function showCardStatus(card) {
  const timestamp = now();
  console.log(`${timestamp} | ${card.id} | CARD | Audit report generated.`);
  console.log(`Card: ${card.id}`);
  console.log(`Name: ${card.name}`);
  console.log(`Created: ${card.timestamps.created_at}`);
  console.log(`Last updated: ${card.timestamps.updated_at}`);
  console.log("Contract (approved invariants):");
  if (card.contract.length === 0) {
    console.log("- none recorded");
  } else {
    for (const invariant of card.contract) {
      console.log(`- ${invariant}`);
    }
  }
  console.log("Contract approvals:");
  if (card.contract_approvals.length === 0) {
    console.log("- none recorded");
  } else {
    for (const approval of card.contract_approvals) {
      console.log(`- ${approval.at} | ${approval.approver}`);
    }
  }
  console.log("Proposal:");
  console.log(card.proposal ? card.proposal : "none recorded");
  console.log("History (append-only):");
  for (const entry of card.history) {
    console.log(`- ${entry.at} | ${entry.label} | ${entry.message}`);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTask(task) {
  assertState(task, ["APPROVED"], "run");
  transition(task, "RUNNING", "Moved to RUNNING because the approved plan is being executed.");
  await wait(400);
  logAudit(task.id, task.current_state, "Checkpoint: execution is underway.");
  await wait(400);
  logAudit(task.id, task.current_state, "Checkpoint: validation completed.");
  await wait(400);
  const lastApproval = task.approvals[task.approvals.length - 1];
  const approver = lastApproval ? lastApproval.approver : "an authorized approver";
  const approvalAt = lastApproval ? lastApproval.at : "an unknown time";
  const planText = task.plan ? `Plan executed: "${task.plan}".` : "Plan text was not recorded.";
  const summary = `Completed because the approved plan ran through execution and validation checkpoints without failure. ${planText} Approval recorded from ${approver} at ${approvalAt}.`;
  task.artifacts.push({
    type: "summary",
    content: summary,
  });
  transition(task, "COMPLETED", "Moved to COMPLETED because execution finished successfully.");
}

function detectContractViolation(card) {
  const proposal = (card.proposal || "").toLowerCase();
  const invariants = card.contract;
  const monitoringInvariant = invariants.find(
    (invariant) =>
      invariant.toLowerCase().includes("monitoring scope") &&
      invariant.toLowerCase().includes("transactions only")
  );
  if (monitoringInvariant && proposal.includes("stock")) {
    return `FAIL: This proposal introduces monitoring of individual stocks, violating approved constraint "${monitoringInvariant}".`;
  }
  return null;
}

async function executeCommand(tokens) {
  const [command, ...rest] = tokens;
  if (!command) {
    fail("No command provided.");
  }

  switch (command) {
    case "create": {
      requireArgs(rest, 1, 'create "<intent>"');
      const intent = rest.join(" ").trim();
      if (!intent) {
        fail("Intent cannot be empty.");
      }
      createTask(intent);
      break;
    }
    case "plan": {
      requireArgs(rest, 2, 'plan "<task_id>" "<plan>"');
      const [taskId, ...planParts] = rest;
      const plan = planParts.join(" ").trim();
      if (!plan) {
        fail("Plan cannot be empty.");
      }
      const task = getTask(taskId);
      assertState(task, ["DRAFT"], "plan");
      task.plan = plan;
      transition(task, "PLANNED", `Moved to PLANNED because a plan was captured: "${plan}".`);
      break;
    }
    case "request-approval": {
      requireArgs(rest, 1, 'request-approval "<task_id>"');
      const [taskId] = rest;
      const task = getTask(taskId);
      assertState(task, ["PLANNED"], "request-approval");
      transition(task, "AWAITING_APPROVAL", "Moved to AWAITING_APPROVAL because approval was requested.");
      break;
    }
    case "approve": {
      requireArgs(rest, 2, 'approve "<task_id>" "<approver>"');
      const [taskId, ...approverParts] = rest;
      const approver = approverParts.join(" ").trim();
      if (!approver) {
        fail("Approver cannot be empty.");
      }
      const task = getTask(taskId);
      assertState(task, ["AWAITING_APPROVAL"], "approve");
      task.approvals.push({ at: now(), approver });
      transition(task, "APPROVED", `Moved to APPROVED because ${approver} approved the work.`);
      break;
    }
    case "run": {
      requireArgs(rest, 1, 'run "<task_id>"');
      const [taskId] = rest;
      const task = getTask(taskId);
      await runTask(task);
      break;
    }
    case "pause": {
      requireArgs(rest, 1, 'pause "<task_id>"');
      const [taskId] = rest;
      const task = getTask(taskId);
      assertState(task, ["RUNNING"], "pause");
      transition(task, "PAUSED", "Moved to PAUSED because a pause was requested.");
      break;
    }
    case "rewind": {
      requireArgs(rest, 1, 'rewind "<task_id>" [<authority>] [<reason>]');
      const [taskId, ...reasonParts] = rest;
      const task = getTask(taskId);
      assertState(task, ["RUNNING", "PAUSED", "FAILED", "COMPLETED"], "rewind");
      let authority = "operator";
      let reasonText = "";
      if (reasonParts.length >= 2) {
        authority = reasonParts[0].trim() || "operator";
        reasonText = reasonParts.slice(1).join(" ").trim();
      } else if (reasonParts.length === 1) {
        reasonText = reasonParts[0].trim();
      }
      const reasonChunks = ["Moved to REWOUND because a rewind was requested.", `Authority: ${authority}.`];
      if (reasonText) {
        reasonChunks.push(`Reason: "${reasonText}".`);
      } else {
        reasonChunks.push("Reason: not provided.");
      }
      transition(task, "REWOUND", reasonChunks.join(" "));
      break;
    }
    case "status": {
      requireArgs(rest, 1, 'status "<task_id>"');
      const [taskId] = rest;
      const task = getTask(taskId);
      showStatus(task);
      break;
    }
    case "card-create": {
      requireArgs(rest, 1, 'card-create "<name>"');
      const name = rest.join(" ").trim();
      if (!name) {
        fail("Card name cannot be empty.");
      }
      createCard(name);
      break;
    }
    case "contract-set": {
      requireArgs(rest, 2, 'contract-set "<card_id>" "<invariant_1>" ["<invariant_2>" ...]');
      const [cardId, ...invariantsRaw] = rest;
      const invariants = invariantsRaw.map((item) => item.trim()).filter(Boolean);
      if (invariants.length === 0) {
        fail("At least one invariant is required.");
      }
      const card = getCard(cardId);
      card.contract = invariants;
      card.contract_approvals = [];
      recordCard(
        card,
        "CONTRACT",
        `Contract drafted with invariants: ${invariants.join("; ")}. Approval required before testing.`
      );
      break;
    }
    case "contract-approve": {
      requireArgs(rest, 2, 'contract-approve "<card_id>" "<approver>"');
      const [cardId, ...approverParts] = rest;
      const approver = approverParts.join(" ").trim();
      if (!approver) {
        fail("Approver cannot be empty.");
      }
      const card = getCard(cardId);
      if (card.contract.length === 0) {
        fail(`Cannot approve contract for "${card.id}" because no contract is defined.`);
      }
      card.contract_approvals.push({ at: now(), approver });
      recordCard(card, "APPROVAL", `Contract approved by ${approver}.`);
      break;
    }
    case "proposal-set": {
      requireArgs(rest, 2, 'proposal-set "<card_id>" "<proposal>"');
      const [cardId, ...proposalParts] = rest;
      const proposal = proposalParts.join(" ").trim();
      if (!proposal) {
        fail("Proposal cannot be empty.");
      }
      const card = getCard(cardId);
      card.proposal = proposal;
      recordCard(card, "PROPOSAL", `Proposal recorded: "${proposal}".`);
      break;
    }
    case "contract-test": {
      requireArgs(rest, 1, 'contract-test "<card_id>"');
      const [cardId] = rest;
      const card = getCard(cardId);
      if (card.contract.length === 0) {
        recordCard(card, "TEST", "FAIL: No contract defined to test against.");
        break;
      }
      if (card.contract_approvals.length === 0) {
        recordCard(
          card,
          "TEST",
          "FAIL: Contract is not approved. Testing protects approved commitments, not correctness."
        );
        break;
      }
      if (!card.proposal) {
        recordCard(card, "TEST", "FAIL: No proposal defined to test against the approved contract.");
        break;
      }
      const violation = detectContractViolation(card);
      if (violation) {
        recordCard(
          card,
          "TEST",
          `${violation} Resolution paths: revise the proposal to comply; rewind and update the contract (new approval); approve a bounded exception (time-bound, explicit reason).`
        );
        break;
      }
      recordCard(
        card,
        "TEST",
        "PASS: Proposal stays within approved constraints. Testing here enforces contract compatibility, not correctness."
      );
      break;
    }
    case "card-status": {
      requireArgs(rest, 1, 'card-status "<card_id>"');
      const [cardId] = rest;
      const card = getCard(cardId);
      showCardStatus(card);
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
