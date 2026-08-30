const suppliers = [
  { id: "atlas", name: "Atlas Components", price: 8200, deliveryDays: 12, region: "United States", stock: 500 },
  { id: "nova", name: "Nova Supply", price: 9700, deliveryDays: 6, region: "Taiwan", stock: 500 },
  { id: "meridian", name: "Meridian Tech", price: 10600, deliveryDays: 5, region: "Japan", stock: 500 },
];

const els = Object.fromEntries([
  "webmcpStatus", "goalInput", "budgetInput", "daysInput", "blockedInput", "approvalInput",
  "applyContractBtn", "contractSeal", "runDemoBtn", "resetBtn", "missionState", "supplierList",
  "approvalBox", "approvalTitle", "approvalCopy", "approveBtn", "receiptEmpty", "receipt",
  "receiptSupplier", "metricTools", "metricFailures", "metricApprovals", "receiptId", "timeline", "toolChips",
].map((id) => [id, document.getElementById(id)]));

const freshState = () => ({
  contract: null,
  candidates: [],
  verified: {},
  selected: null,
  approvalRequested: false,
  approved: false,
  committed: false,
  toolCalls: 0,
  failures: 0,
  approvals: 0,
  receiptId: null,
  events: [],
});

let state = freshState();
let demoRunning = false;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));function nowLabel() {
  return new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function addEvent(kind, message) {
  state.events.unshift({ at: nowLabel(), kind, message });
  state.events = state.events.slice(0, 8);
  renderTimeline();
}

function countTool(name) {
  state.toolCalls += 1;
  addEvent("tool", `WebMCP 繚 ${name}`);
}

function setMission(icon, title, copy) {
  els.missionState.innerHTML = `<span class="state-icon">${icon}</span><div><strong>${title}</strong><p>${copy}</p></div>`;
}

function renderTimeline() {
  els.timeline.innerHTML = state.events.map((event) =>
    `<div class="event ${event.kind}"><span>${event.at}</span><span>${event.message}</span></div>`
  ).join("");
}

function renderSuppliers() {
  els.supplierList.innerHTML = state.candidates.map((supplier) => {
    const result = state.verified[supplier.id];
    const klass = result ? (result.pass ? "pass" : "fail") : (state.selected === supplier.id ? "active" : "");
    const resultText = result ? (result.pass ? "Verified" : "Failed") : "Candidate";
    return `<div class="supplier ${klass}" data-id="${supplier.id}">
      <div><h3>${supplier.name}</h3><div class="supplier-meta"><span>$${supplier.price.toLocaleString()}</span><span>${supplier.deliveryDays} days</span><span>${supplier.region}</span><span>${supplier.stock} units</span></div></div>
      <div class="supplier-result">${resultText}</div>
    </div>`;
  }).join("");
}

function makeReceiptId() {
  const seed = `${state.contract.goal}|${state.selected}|${state.toolCalls}|${state.failures}`;
  let hash = 2166136261;
  for (const ch of seed) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return `VMC-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}function renderReceipt() {
  if (!state.committed) {
    els.receiptEmpty.classList.remove("hidden");
    els.receipt.classList.add("hidden");
    return;
  }
  const supplier = suppliers.find((item) => item.id === state.selected);
  els.receiptEmpty.classList.add("hidden");
  els.receipt.classList.remove("hidden");
  els.receiptSupplier.textContent = `${supplier.name} 繚 $${supplier.price.toLocaleString()} 繚 ${supplier.deliveryDays}-day delivery`;
  els.metricTools.textContent = String(state.toolCalls);
  els.metricFailures.textContent = String(state.failures);
  els.metricApprovals.textContent = String(state.approvals);
  els.receiptId.textContent = state.receiptId;
}

function contractFromInputs() {
  return {
    goal: els.goalInput.value.trim() || "Source 500 industrial sensors",
    budget: Number(els.budgetInput.value),
    maxDeliveryDays: Number(els.daysInput.value),
    blockedRegions: els.blockedInput.value.split(",").map((v) => v.trim()).filter(Boolean),
    approvalRequired: els.approvalInput.checked,
    locked: true,
  };
}

function setContractInputsDisabled(disabled) {
  [els.goalInput, els.budgetInput, els.daysInput, els.blockedInput, els.approvalInput].forEach((el) => { el.disabled = disabled; });
  els.applyContractBtn.disabled = disabled;
}

function lockContract() {
  state.contract = contractFromInputs();
  setContractInputsDisabled(true);
  els.contractSeal.textContent = "Goal Contract locked - agent authority bounded";
  els.contractSeal.classList.add("locked");
  setMission("LOCK", "Contract locked", "The agent may now discover and verify options inside this authority boundary.");
  addEvent("pass", "Human locked Goal Contract");
  return structuredClone(state.contract);
}

function resetMission({ preserveInputs = true } = {}) {
  state = freshState();
  demoRunning = false;
  setContractInputsDisabled(false);
  els.contractSeal.textContent = "Contract unlocked";
  els.contractSeal.classList.remove("locked");
  els.approvalBox.classList.add("hidden");
  els.supplierList.innerHTML = "";
  setMission("WAIT", "Waiting for mission", "Lock a Goal Contract or run the guided demo.");
  renderTimeline();
  renderReceipt();
  if (!preserveInputs) {
    els.goalInput.value = "Source 500 industrial sensors";
    els.budgetInput.value = "10000";
    els.daysInput.value = "7";
    els.blockedInput.value = "Restricted regions";
    els.approvalInput.checked = true;
  }
}function requireContract() {
  if (!state.contract?.locked) return { ok: false, error: "GOAL_CONTRACT_NOT_LOCKED", next: "Ask the human to lock the contract first." };
  return null;
}

function toolGetGoalContract() {
  countTool("get_goal_contract");
  const blocked = requireContract();
  if (blocked) return blocked;
  return { ok: true, contract: structuredClone(state.contract), authority: "Agent may evaluate and select; final commitment may require human approval." };
}

function toolSearchSuppliers() {
  countTool("search_suppliers");
  const blocked = requireContract();
  if (blocked) return blocked;
  state.candidates = suppliers.map((item) => ({ ...item }));
  renderSuppliers();
  setMission("FIND", "3 candidates discovered", "The agent must verify each candidate against the Goal Contract before selection.");
  return { ok: true, candidates: state.candidates };
}

function toolVerifySupplier({ supplier_id }) {
  countTool("verify_supplier");
  const blocked = requireContract();
  if (blocked) return blocked;
  const supplier = suppliers.find((item) => item.id === supplier_id);
  if (!supplier) return { ok: false, error: "SUPPLIER_NOT_FOUND" };
  const checks = {
    budget: supplier.price <= state.contract.budget,
    delivery: supplier.deliveryDays <= state.contract.maxDeliveryDays,
    region: !state.contract.blockedRegions.map((v) => v.toLowerCase()).includes(supplier.region.toLowerCase()),
    stock: supplier.stock >= 500,
  };
  const pass = Object.values(checks).every(Boolean);
  const result = { pass, checks, supplier: { ...supplier } };
  state.verified[supplier.id] = result;
  if (!pass) {
    state.failures += 1;
    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key).join(", ");
    addEvent("fail", `${supplier.name} failed verification 繚 ${failed}`);
    setMission("!", "Outcome verification failed", `${supplier.name} violates ${failed}. Recovery is required.`);
  } else {
    addEvent("pass", `${supplier.name} satisfies every contract constraint`);
    setMission("PASS", "Candidate verified", `${supplier.name} satisfies budget, delivery, region and stock constraints.`);
  }
  renderSuppliers();
  return { ok: true, ...result };
}function toolRecoverFromFailure({ failed_supplier_id }) {
  countTool("recover_from_failure");
  const failed = state.verified[failed_supplier_id];
  if (!failed || failed.pass) return { ok: false, error: "NO_VERIFIED_FAILURE_TO_RECOVER" };
  const next = state.candidates.find((item) => item.id !== failed_supplier_id && !state.verified[item.id]);
  if (!next) return { ok: false, error: "NO_UNTRIED_CANDIDATE" };
  addEvent("tool", `Recovery route 繚 ${next.name}`);
  setMission("REC", "Recovery path selected", `The first path failed. The agent is switching to ${next.name} without changing the Goal Contract.`);
  return { ok: true, next_supplier: next, instruction: "Verify this supplier before selecting it." };
}

function toolSelectSupplier({ supplier_id }) {
  countTool("select_supplier");
  const verification = state.verified[supplier_id];
  if (!verification?.pass) return { ok: false, error: "SUPPLIER_NOT_VERIFIED_PASS", next: "Call verify_supplier first." };
  state.selected = supplier_id;
  renderSuppliers();
  const supplier = suppliers.find((item) => item.id === supplier_id);
  addEvent("pass", `Agent selected ${supplier.name} inside contract boundary`);
  return { ok: true, selected: supplier, commitment_allowed: !state.contract.approvalRequired, human_approval_required: state.contract.approvalRequired };
}

function toolRequestHumanApproval() {
  countTool("request_human_approval");
  if (!state.selected) return { ok: false, error: "NO_SELECTED_SUPPLIER" };
  const supplier = suppliers.find((item) => item.id === state.selected);
  state.approvalRequested = true;
  els.approvalTitle.textContent = `${supplier.name} is verified and ready`;
  els.approvalCopy.textContent = `$${supplier.price.toLocaleString()} 繚 ${supplier.deliveryDays} days 繚 final commitment remains human-controlled.`;
  els.approvalBox.classList.remove("hidden");
  setMission("HUMAN", "Human decision required", "The agent has reached its authority boundary and cannot commit on its own.");
  addEvent("tool", "Human approval requested before irreversible commitment");
  return { ok: true, status: "AWAITING_HUMAN_APPROVAL", selected: supplier };
}

function humanApprove() {
  if (!state.approvalRequested || !state.selected) return false;
  state.approved = true;
  state.approvals += 1;
  els.approvalBox.classList.add("hidden");
  addEvent("pass", "Human approved final selection");
  return true;
}function toolCommitSelection() {
  countTool("commit_selection");
  if (!state.selected) return { ok: false, error: "NO_SELECTED_SUPPLIER" };
  if (state.contract.approvalRequired && !state.approved) {
    addEvent("fail", "Commit blocked 繚 human approval missing");
    return { ok: false, error: "HUMAN_APPROVAL_REQUIRED", next: "Call request_human_approval and wait for the human." };
  }
  const verification = state.verified[state.selected];
  if (!verification?.pass) return { ok: false, error: "OUTCOME_NOT_VERIFIED" };
  state.committed = true;
  state.receiptId = makeReceiptId();
  const supplier = suppliers.find((item) => item.id === state.selected);
  addEvent("pass", `Goal achieved 繚 ${supplier.name} committed`);
  setMission("PASS", "Mission complete", "The final outcome satisfies the Goal Contract and a verification receipt is available.");
  renderReceipt();
  return { ok: true, status: "GOAL_ACHIEVED", supplier, receipt_id: state.receiptId };
}

function toolGetEvidenceReceipt() {
  countTool("get_evidence_receipt");
  return {
    ok: true,
    goal_status: state.committed ? "PASS" : "IN_PROGRESS",
    contract: state.contract,
    selected_supplier: suppliers.find((item) => item.id === state.selected) || null,
    verification: state.selected ? state.verified[state.selected] : null,
    human_approval: state.approved,
    recovered_failures: state.failures,
    receipt_id: state.receiptId,
    recent_events: state.events.slice(0, 6),
  };
}

const emptySchema = { type: "object", properties: {}, additionalProperties: false };
const supplierSchema = {
  type: "object",
  properties: { supplier_id: { type: "string", enum: suppliers.map((item) => item.id), description: "Supplier identifier from search_suppliers." } },
  required: ["supplier_id"],
  additionalProperties: false,
};

const toolDefinitions = [
  { name: "get_goal_contract", title: "Read Goal Contract", description: "Read the human-locked mission constraints and authority boundary. Call this before taking action.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: toolGetGoalContract },
  { name: "search_suppliers", title: "Search Suppliers", description: "Discover supplier candidates for the active procurement mission. Results are unverified until verify_supplier passes.", inputSchema: emptySchema, annotations: { readOnlyHint: false }, execute: toolSearchSuppliers },
  { name: "verify_supplier", title: "Verify Supplier", description: "Verify one supplier against every locked Goal Contract constraint. Never select a supplier that fails this tool.", inputSchema: supplierSchema, annotations: { readOnlyHint: false }, execute: toolVerifySupplier },
  { name: "recover_from_failure", title: "Recover From Failure", description: "When a verified candidate fails, choose an untried alternative without weakening or changing the human Goal Contract.", inputSchema: { ...supplierSchema, properties: { failed_supplier_id: { type: "string", enum: suppliers.map((item) => item.id) } }, required: ["failed_supplier_id"] }, annotations: { readOnlyHint: false }, execute: toolRecoverFromFailure },
];toolDefinitions.push(
  { name: "select_supplier", title: "Select Verified Supplier", description: "Select a supplier only after verify_supplier returns pass=true. Selection does not bypass the human approval boundary.", inputSchema: supplierSchema, annotations: { readOnlyHint: false }, execute: toolSelectSupplier },
  { name: "request_human_approval", title: "Request Human Approval", description: "Pause at the authority boundary and ask the human to approve the currently selected verified supplier before commitment.", inputSchema: emptySchema, annotations: { readOnlyHint: false }, execute: toolRequestHumanApproval },
  { name: "commit_selection", title: "Commit Selection", description: "Finalize the selected supplier. This is blocked unless verification passed and any required human approval has been granted.", inputSchema: emptySchema, annotations: { readOnlyHint: false }, execute: toolCommitSelection },
  { name: "get_evidence_receipt", title: "Get Verification Receipt", description: "Read the current goal status, verification evidence, human approval state, recovered failures and final receipt identifier.", inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: toolGetEvidenceReceipt },
);

function renderToolChips() {
  els.toolChips.innerHTML = toolDefinitions.map((tool) => `<span class="tool-chip">${tool.name}()</span>`).join("");
}

async function registerWebMCPTools() {
  const modelContext = document.modelContext || navigator.modelContext;
  if (!modelContext?.registerTool) {
    els.webmcpStatus.innerHTML = '<span class="dot"></span>WebMCP preview mode';
    els.webmcpStatus.title = "Open in ChatGPT in-app browser or Chrome with WebMCP enabled to expose the native tool surface.";
    return false;
  }
  try {
    for (const tool of toolDefinitions) await modelContext.registerTool(tool);
    els.webmcpStatus.classList.add("ready");
    els.webmcpStatus.innerHTML = `<span class="dot"></span>${toolDefinitions.length} WebMCP tools live`;
    addEvent("pass", `${toolDefinitions.length} native WebMCP tools registered`);
    return true;
  } catch (error) {
    console.error("WebMCP registration failed", error);
    els.webmcpStatus.innerHTML = '<span class="dot"></span>WebMCP registration error';
    return false;
  }
}

async function runGuidedDemo() {
  if (demoRunning) return;
  resetMission({ preserveInputs: false });
  demoRunning = true;
  els.runDemoBtn.disabled = true;
  els.runDemoBtn.textContent = "Agent running...";
  lockContract();
  await sleep(650);
  toolGetGoalContract();
  await sleep(650);
  toolSearchSuppliers();
  await sleep(850);
  toolVerifySupplier({ supplier_id: "atlas" });
  await sleep(1050);
  toolRecoverFromFailure({ failed_supplier_id: "atlas" });
  await sleep(900);
  toolVerifySupplier({ supplier_id: "nova" });
  await sleep(850);
  toolSelectSupplier({ supplier_id: "nova" });
  await sleep(650);
  toolRequestHumanApproval();
  els.runDemoBtn.textContent = "Waiting for human approval";
  demoRunning = false;
}els.applyContractBtn.addEventListener("click", () => {
  if (!state.contract?.locked) lockContract();
});

els.resetBtn.addEventListener("click", () => {
  resetMission({ preserveInputs: false });
  els.runDemoBtn.disabled = false;
  els.runDemoBtn.textContent = "Run guided demo";
});

els.runDemoBtn.addEventListener("click", runGuidedDemo);

els.approveBtn.addEventListener("click", async () => {
  if (!humanApprove()) return;
  els.runDemoBtn.textContent = "Human approved - committing...";
  await sleep(550);
  const result = toolCommitSelection();
  if (result.ok) {
    els.runDemoBtn.disabled = false;
    els.runDemoBtn.textContent = "Replay guided demo";
  }
});

window.verifiedMissionControl = {
  get state() { return state; },
  lockContract,
  resetMission,
  tools: Object.fromEntries(toolDefinitions.map((tool) => [tool.name, tool.execute])),
  humanApprove,
  runGuidedDemo,
};

renderToolChips();
resetMission({ preserveInputs: false });
registerWebMCPTools();
