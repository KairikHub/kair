import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";

const UI_DIR = path.join(process.cwd(), "src", "ui");
const IMG_DIR = path.join(process.cwd(), "src", "img");
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "contracts.json");
const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts");
const PORT = Number(process.env.KAIRIK_UI_PORT || 3000);

const CONTROL_REGISTRY = [
  "cloudflare:read",
  "cloudflare:write",
  "github:read",
  "github:write",
  "schwab:read",
  "local:read",
  "local:write",
];

function now() {
  return new Date().toISOString();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      resolve(data);
    });
    req.on("error", reject);
  });
}

function send(res, status, body, type = "text/plain") {
  res.writeHead(status, {
    "Content-Type": type,
  });
  res.end(body);
}

function sendBytes(req, res, status, body, type) {
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": String(body.length),
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(body);
}

function serveAsset(req, res, pathname, routePath, fileName, contentType) {
  if (!(req.method === "GET" || req.method === "HEAD")) {
    return false;
  }
  if (pathname !== routePath) {
    return false;
  }
  const filePath = path.join(IMG_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    send(res, 404, "Not found");
    return true;
  }
  const content = fs.readFileSync(filePath);
  sendBytes(req, res, 200, content, contentType);
  return true;
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload, null, 2), "application/json");
}

function loadStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    if (!raw.trim()) {
      return { nextId: 1, contracts: [] };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.contracts)) {
      return { nextId: 1, contracts: [] };
    }
    const contracts = parsed.contracts.map(normalizeContract);
    return {
      nextId: Number(parsed.nextId) || contracts.length + 1,
      contracts,
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { nextId: 1, contracts: [] };
    }
    throw error;
  }
}

function saveStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function normalizeContract(contract) {
  return {
    id: contract.id,
    intent: contract.intent || "",
    plan: contract.plan ?? null,
    current_state: contract.current_state || "DRAFT",
    history: Array.isArray(contract.history) ? contract.history : [],
    approvals: Array.isArray(contract.approvals) ? contract.approvals : [],
    executor_ref: contract.executor_ref ?? null,
    artifacts: Array.isArray(contract.artifacts) ? contract.artifacts : [],
    controlsRequired: Array.isArray(contract.controlsRequired) ? contract.controlsRequired : [],
    controlsApproved: Array.isArray(contract.controlsApproved) ? contract.controlsApproved : [],
    activeVersion: contract.activeVersion ?? null,
    versions: Array.isArray(contract.versions) ? contract.versions : [],
    timestamps: contract.timestamps || {
      created_at: now(),
      updated_at: now(),
    },
  };
}

function recordHistory(contract, label, message) {
  const timestamp = now();
  contract.timestamps.updated_at = timestamp;
  contract.history.push({ at: timestamp, state: label, message });
}

function transition(contract, nextState, reason) {
  contract.current_state = nextState;
  recordHistory(contract, nextState, reason);
}

function validateControls(list) {
  const invalid = list.filter((control) => !CONTROL_REGISTRY.includes(control));
  if (invalid.length > 0) {
    throw new Error(`Unknown Controls: ${invalid.join(", ")}.`);
  }
}

function missingControls(contract) {
  const approved = new Set(contract.controlsApproved);
  return contract.controlsRequired.filter((control) => !approved.has(control));
}

function ensureContract(store, id) {
  const contract = store.contracts.find((item) => item.id === id);
  if (!contract) {
    throw new Error(`Unknown Contract "${id}".`);
  }
  return contract;
}

function enforceControls(contract, context) {
  const missing = missingControls(contract);
  if (missing.length > 0) {
    const message = `Blocked: proposal requires controls not approved: ${missing.join(
      ", "
    )}. Resolution paths: revise the proposal; add/approve the required controls; rewind the Contract to update authority; or fork into a new Contract.`;
    recordHistory(contract, "CONTROLS", message);
    return { ok: false, message };
  }
  recordHistory(
    contract,
    "CONTROLS",
    `Controls check passed for ${context}. Required: ${contract.controlsRequired.join(
      ", "
    ) || "none"}. Approved: ${contract.controlsApproved.join(", ") || "none"}.`
  );
  return { ok: true };
}

function writeArtifact(contract, proposalSummary) {
  const dir = path.join(ARTIFACTS_DIR, contract.id);
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
  contract.artifacts.push({ type: "run", content: filePath });
}

function handlePropose(store, body) {
  const intent = (body.intent || "").trim();
  if (!intent) {
    throw new Error("Intent cannot be empty.");
  }
  const controlsRequired = Array.isArray(body.controlsRequired)
    ? body.controlsRequired
    : (body.controlsRequired || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  validateControls(controlsRequired);
  const id = `contract_${store.nextId++}`;
  const timestamp = now();
  const contract = normalizeContract({
    id,
    intent,
    plan: null,
    current_state: "DRAFT",
    controlsRequired,
    controlsApproved: [],
    activeVersion: null,
    versions: [],
    timestamps: { created_at: timestamp, updated_at: timestamp },
    history: [],
    approvals: [],
    artifacts: [],
  });
  const controlsNote = controlsRequired.length
    ? ` Controls required by this proposal: ${controlsRequired.join(", ")}.`
    : " Controls required by this proposal: none.";
  recordHistory(contract, "DRAFT", `Propose a Kairik Contract: "${intent}".${controlsNote}`);
  store.contracts.push(contract);
  saveStore(store);
  return contract;
}

function handlePlan(contract, body) {
  if (contract.current_state !== "DRAFT") {
    throw new Error(`Plan is only allowed from DRAFT.`);
  }
  const plan = (body.plan || "").trim();
  if (!plan) {
    throw new Error("Plan cannot be empty.");
  }
  contract.plan = plan;
  transition(contract, "PLANNED", `Plan captured for Contract: "${plan}".`);
}

function handleRequestApproval(contract) {
  if (contract.current_state !== "PLANNED") {
    throw new Error(`Request approval is only allowed from PLANNED.`);
  }
  const gating = enforceControls(contract, "approval request");
  if (!gating.ok) {
    return { blocked: true, message: gating.message };
  }
  transition(contract, "AWAITING_APPROVAL", "Approval requested for Contract.");
  return { blocked: false };
}

function handleApprove(contract, body) {
  if (contract.current_state !== "AWAITING_APPROVAL") {
    throw new Error(`Approve is only allowed from AWAITING_APPROVAL.`);
  }
  const approver = (body.approver || "").trim();
  if (!approver) {
    throw new Error("Approver cannot be empty.");
  }
  contract.approvals.push({ at: now(), approver });
  const version = contract.versions.length + 1;
  contract.activeVersion = version;
  contract.versions.push({
    version,
    kind: "approval",
    at: now(),
    note: `Approved by ${approver}.`,
    controlsApproved: [...contract.controlsApproved],
    plan: contract.plan,
    intent: contract.intent,
  });
  transition(contract, "APPROVED", `Approve a Kairik Contract: approved by ${approver}.`);
}

function handleAddControl(contract, body) {
  const control = (body.control || "").trim();
  const approver = (body.approver || "").trim();
  if (!control) {
    throw new Error("Control cannot be empty.");
  }
  validateControls([control]);
  if (!approver) {
    throw new Error("Approver cannot be empty.");
  }
  if (!contract.controlsApproved.includes(control)) {
    contract.controlsApproved.push(control);
    recordHistory(contract, "CONTROLS", `Control "${control}" approved by ${approver}.`);
  } else {
    recordHistory(contract, "CONTROLS", `Control "${control}" reaffirmed by ${approver}.`);
  }
}

function handleRun(contract) {
  if (contract.current_state !== "APPROVED") {
    throw new Error(`Run is only allowed from APPROVED.`);
  }
  const gating = enforceControls(contract, "execution");
  if (!gating.ok) {
    return { blocked: true, message: gating.message };
  }
  transition(contract, "RUNNING", "Execution started for the approved Contract.");
  transition(contract, "COMPLETED", "Execution completed successfully for the approved Contract.");
  contract.artifacts.push({
    type: "summary",
    content:
      "Completed because the approved Contract ran through execution and validation checkpoints without failure.",
  });
  writeArtifact(contract, { intent: contract.intent, plan: contract.plan });
  return { blocked: false };
}

function handlePause(contract) {
  if (contract.current_state !== "RUNNING") {
    throw new Error(`Pause is only allowed from RUNNING.`);
  }
  transition(contract, "PAUSED", "Paused Contract execution.");
}

function handleRewind(contract, body) {
  if (!(["RUNNING", "PAUSED", "FAILED", "COMPLETED"].includes(contract.current_state))) {
    throw new Error(`Rewind is only allowed from RUNNING, PAUSED, FAILED, or COMPLETED.`);
  }
  const authority = (body.authority || "operator").trim() || "operator";
  const reason = (body.reason || "").trim();
  const previousVersion = contract.activeVersion;
  const version = contract.versions.length + 1;
  contract.activeVersion = version;
  contract.versions.push({
    version,
    kind: "rewind",
    at: now(),
    note: `Rewound by ${authority}. Supersedes v${previousVersion ?? "none"}.`,
    controlsApproved: [...contract.controlsApproved],
    plan: contract.plan,
    intent: contract.intent,
  });
  const chunks = [
    "Rewind a Kairik Contract because a rewind was requested.",
    `Authority: ${authority}.`,
    reason ? `Reason: "${reason}".` : "Reason: not provided.",
  ];
  transition(contract, "REWOUND", chunks.join(" "));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") {
    const html = fs.readFileSync(path.join(UI_DIR, "index.html"), "utf8");
    return send(res, 200, html, "text/html");
  }

  if (req.method === "GET" && url.pathname === "/app.js") {
    const js = fs.readFileSync(path.join(UI_DIR, "app.js"), "utf8");
    return send(res, 200, js, "text/javascript");
  }

  if (req.method === "GET" && url.pathname === "/styles.css") {
    const css = fs.readFileSync(path.join(UI_DIR, "styles.css"), "utf8");
    return send(res, 200, css, "text/css");
  }

  if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/favicon.ico") {
    const primary = path.join(IMG_DIR, "favicon.ico");
    const fallback = path.join(IMG_DIR, "favicon.cio");
    const iconPath = fs.existsSync(primary) ? primary : fallback;
    if (!fs.existsSync(iconPath)) {
      return send(res, 404, "Not found");
    }
    const favicon = fs.readFileSync(iconPath);
    return sendBytes(req, res, 200, favicon, "image/x-icon");
  }

  if (serveAsset(req, res, url.pathname, "/favicon-16x16.png", "favicon-16x16.png", "image/png")) {
    return;
  }

  if (serveAsset(req, res, url.pathname, "/favicon-32x32.png", "favicon-32x32.png", "image/png")) {
    return;
  }

  if (serveAsset(req, res, url.pathname, "/apple-touch-icon.png", "apple-touch-icon.png", "image/png")) {
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/site.webmanifest") {
    const filePath = path.join(IMG_DIR, "site.webmanifest");
    if (!fs.existsSync(filePath)) {
      return send(res, 404, "Not found");
    }
    const file = fs.readFileSync(filePath, "utf8");
    return sendBytes(req, res, 200, Buffer.from(file, "utf8"), "application/manifest+json");
  }

  if (url.pathname.startsWith("/api/contracts")) {
    try {
      const store = loadStore();
      const parts = url.pathname.split("/").filter(Boolean);

      if (req.method === "GET" && parts.length === 2) {
        const contracts = store.contracts.sort((a, b) =>
          (b.timestamps?.created_at || "").localeCompare(a.timestamps?.created_at || "")
        );
        return sendJson(res, 200, { contracts, controls: CONTROL_REGISTRY });
      }

      if (req.method === "POST" && parts.length === 2) {
        const body = JSON.parse((await readBody(req)) || "{}");
        const contract = handlePropose(store, body);
        return sendJson(res, 201, { contract });
      }

      if (parts.length === 3 && req.method === "GET") {
        const contract = ensureContract(store, parts[2]);
        return sendJson(res, 200, { contract });
      }

      if (parts.length === 4 && parts[3] === "action" && req.method === "POST") {
        const contract = ensureContract(store, parts[2]);
        const body = JSON.parse((await readBody(req)) || "{}");
        const action = body.action;
        if (!action) {
          throw new Error("Action is required.");
        }
        let result = null;
        if (action === "plan") {
          handlePlan(contract, body);
        } else if (action === "request-approval") {
          result = handleRequestApproval(contract);
        } else if (action === "approve") {
          handleApprove(contract, body);
        } else if (action === "add-control") {
          handleAddControl(contract, body);
        } else if (action === "run") {
          result = handleRun(contract);
        } else if (action === "pause") {
          handlePause(contract);
        } else if (action === "rewind") {
          handleRewind(contract, body);
        } else {
          throw new Error(`Unknown action "${action}".`);
        }
        saveStore(store);
        if (result && result.blocked) {
          return sendJson(res, 409, { error: result.message, contract });
        }
        return sendJson(res, 200, { contract, result });
      }

      return sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || String(error) });
    }
  }

  send(res, 404, "Not found");
});

server.listen(PORT, () => {
  console.log(`Kairik UI running at http://localhost:${PORT}`);
});
