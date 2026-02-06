const state = {
  contracts: [],
  selectedId: null,
  controls: [],
  notice: null,
};

const elements = {
  list: document.getElementById("contract-list"),
  detail: document.getElementById("contract-detail"),
  history: document.getElementById("history"),
  controls: document.getElementById("controls-detail"),
  selectedId: document.getElementById("selected-id"),
  notice: document.getElementById("notice"),
  refresh: document.getElementById("refresh"),
  proposeForm: document.getElementById("propose-form"),
  intent: document.getElementById("intent"),
  controlsInput: document.getElementById("controls"),
  plan: document.getElementById("plan"),
  planBtn: document.getElementById("plan-btn"),
  approver: document.getElementById("approver"),
  requestApproval: document.getElementById("request-approval"),
  approve: document.getElementById("approve"),
  run: document.getElementById("run"),
  pause: document.getElementById("pause"),
  rewind: document.getElementById("rewind"),
  rewindReason: document.getElementById("rewind-reason"),
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function setNotice(message, type = "error") {
  state.notice = { message, type };
  renderNotice();
}

function clearNotice() {
  state.notice = null;
  renderNotice();
}

function renderNotice() {
  if (!state.notice) {
    elements.notice.classList.add("hidden");
    elements.notice.textContent = "";
    elements.notice.className = "notice hidden";
    return;
  }
  elements.notice.className = `notice ${state.notice.type}`;
  elements.notice.textContent = state.notice.message;
}

async function loadContracts() {
  const data = await api("/api/contracts");
  state.contracts = data.contracts || [];
  state.controls = data.controls || [];
  if (!state.selectedId && state.contracts.length > 0) {
    state.selectedId = state.contracts[0].id;
  }
  render();
}

function selectContract(id) {
  state.selectedId = id;
  render();
}

function getSelected() {
  return state.contracts.find((item) => item.id === state.selectedId) || null;
}

function renderContracts() {
  elements.list.innerHTML = "";
  if (state.contracts.length === 0) {
    elements.list.innerHTML = "<p class='hint'>No contracts yet.</p>";
    return;
  }
  state.contracts.forEach((contract) => {
    const div = document.createElement("div");
    div.className = `card-item ${contract.id === state.selectedId ? "active" : ""}`;
    div.innerHTML = `
      <div class="id truncate">${contract.id}</div>
      <div class="intent">${contract.intent}</div>
      <div class="state">${contract.current_state}</div>
    `;
    div.onclick = () => selectContract(contract.id);
    elements.list.appendChild(div);
  });
}

function renderDetail() {
  const contract = getSelected();
  if (!contract) {
    elements.selectedId.textContent = "";
    elements.detail.innerHTML = "<p class='hint'>Select a contract to inspect.</p>";
    elements.history.innerHTML = "";
    elements.controls.innerHTML = "";
    return;
  }
  elements.selectedId.textContent = contract.id;
  const missing = contract.controlsRequired.filter(
    (control) => !contract.controlsApproved.includes(control)
  );
  const gating = missing.length ? `BLOCKED (${missing.join(", ")})` : "CLEAR";
  elements.detail.innerHTML = `
    <div><strong>Intent:</strong> ${contract.intent}</div>
    <div><strong>Plan:</strong> ${contract.plan || "none"}</div>
    <div><strong>State:</strong> ${contract.current_state}</div>
    <div><strong>Active version:</strong> ${contract.activeVersion ?? "none"}</div>
    <div><strong>Controls required:</strong> ${contract.controlsRequired.join(", ") || "none"}</div>
    <div><strong>Controls approved:</strong> ${contract.controlsApproved.join(", ") || "none"}</div>
    <div><strong>Controls gating:</strong> ${gating}</div>
  `;

  renderControls(contract, missing);
  renderHistory(contract);
}

function renderControls(contract, missing) {
  const rows = [];
  rows.push(`<div class="control-chip">Approved: ${contract.controlsApproved.join(", ") || "none"}</div>`);
  if (missing.length > 0) {
    missing.forEach((control) => {
      rows.push(`
        <div class="control-chip missing">
          Missing: ${control}
          <button data-control="${control}">Approve Control</button>
        </div>
      `);
    });
  } else {
    rows.push(`<div class="control-chip">No missing controls</div>`);
  }
  elements.controls.innerHTML = rows.join("");
  elements.controls.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const control = button.getAttribute("data-control");
        await postAction("add-control", { control, approver: elements.approver.value });
      } catch (error) {
        setNotice(error.message);
      }
    });
  });
}

function renderHistory(contract) {
  if (!contract.history || contract.history.length === 0) {
    elements.history.innerHTML = "<p class='hint'>No history yet.</p>";
    return;
  }
  elements.history.innerHTML = contract.history
    .slice()
    .reverse()
    .map(
      (entry) => `
      <div class="history-entry">
        <strong>${entry.state}</strong>
        <div class="mono">${entry.at}</div>
        <div>${entry.message}</div>
      </div>
    `
    )
    .join("");
}

async function postAction(action, payload = {}) {
  const contract = getSelected();
  if (!contract) {
    setNotice("Select a contract first.");
    return;
  }
  clearNotice();
  try {
    await api(`/api/contracts/${contract.id}/action`, {
      method: "POST",
      body: JSON.stringify({ action, ...payload }),
    });
    await loadContracts();
  } catch (error) {
    setNotice(error.message);
    await loadContracts();
  }
}

function render() {
  renderContracts();
  renderDetail();
  renderNotice();
}

elements.refresh.addEventListener("click", () => loadContracts());

elements.proposeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();
  try {
    await api("/api/contracts", {
      method: "POST",
      body: JSON.stringify({
        intent: elements.intent.value,
        controlsRequired: elements.controlsInput.value,
      }),
    });
    elements.intent.value = "";
    elements.controlsInput.value = "";
    await loadContracts();
  } catch (error) {
    setNotice(error.message);
  }
});

elements.planBtn.addEventListener("click", async () => {
  try {
    await postAction("plan", { plan: elements.plan.value });
  } catch (error) {
    setNotice(error.message);
  }
});

elements.requestApproval.addEventListener("click", async () => {
  try {
    await postAction("request-approval");
  } catch (error) {
    setNotice(error.message);
  }
});

elements.approve.addEventListener("click", async () => {
  try {
    await postAction("approve", { approver: elements.approver.value });
  } catch (error) {
    setNotice(error.message);
  }
});

elements.run.addEventListener("click", async () => {
  try {
    await postAction("run");
  } catch (error) {
    setNotice(error.message);
  }
});

elements.pause.addEventListener("click", async () => {
  try {
    await postAction("pause");
  } catch (error) {
    setNotice(error.message);
  }
});

elements.rewind.addEventListener("click", async () => {
  try {
    await postAction("rewind", {
      authority: elements.approver.value,
      reason: elements.rewindReason.value,
    });
  } catch (error) {
    setNotice(error.message);
  }
});

loadContracts();
