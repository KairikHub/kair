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

function now() {
  return new Date().toISOString();
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function logAudit(taskId, state, message) {
  console.log(`${now()} | ${taskId} | ${state} | ${message}`);
}

function getTask(id) {
  const task = store.tasks.get(id);
  if (!task) {
    fail(`Unknown task "${id}".`);
  }
  return task;
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
  task.current_state = nextState;
  task.timestamps.updated_at = now();
  task.history.push({
    at: now(),
    state: nextState,
    message: reason,
  });
  logAudit(task.id, nextState, reason);
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
  logAudit(id, "DRAFT", reason);
  return task;
}

function requireArgs(args, minCount, usage) {
  if (args.length < minCount) {
    fail(`Missing arguments. Usage: ${usage}`);
  }
}

function showStatus(task) {
  console.log(`${now()} | ${task.id} | STATUS | Current state: ${task.current_state}`);
  console.log(`Intent: ${task.intent}`);
  console.log("History:");
  for (const entry of task.history) {
    console.log(`- ${entry.at} | ${entry.state} | ${entry.message}`);
  }
  console.log("Approvals:");
  if (task.approvals.length === 0) {
    console.log("- none");
  } else {
    for (const approval of task.approvals) {
      console.log(`- ${approval.at} | ${approval.approver}`);
    }
  }
  console.log("Artifacts:");
  if (task.artifacts.length === 0) {
    console.log("- none");
  } else {
    for (const artifact of task.artifacts) {
      console.log(`- ${artifact.type} | ${artifact.content}`);
    }
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
  task.artifacts.push({
    type: "summary",
    content: "Why this task completed successfully",
  });
  transition(task, "COMPLETED", "Moved to COMPLETED because execution finished successfully.");
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
      requireArgs(rest, 1, 'rewind "<task_id>"');
      const [taskId, ...reasonParts] = rest;
      const task = getTask(taskId);
      assertState(task, ["RUNNING", "PAUSED", "FAILED", "COMPLETED"], "rewind");
      const reasonInput = reasonParts.join(" ").trim();
      const reason = reasonInput
        ? `Moved to REWOUND because a rewind was requested: "${reasonInput}".`
        : "Moved to REWOUND because a rewind was requested.";
      transition(task, "REWOUND", reason);
      break;
    }
    case "status": {
      requireArgs(rest, 1, 'status "<task_id>"');
      const [taskId] = rest;
      const task = getTask(taskId);
      showStatus(task);
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
