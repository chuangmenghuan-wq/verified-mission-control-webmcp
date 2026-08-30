# Verified Mission Control

**Goal Contracts, verification, recovery, and evidence for the agent-native web.**

Built for **The WebMCP Challenge 2026** by Future Ability.

WebMCP gives agents structured tools. Verified Mission Control adds a missing layer: a human-defined goal and authority boundary, outcome verification, recovery when the first path fails, and an evidence receipt when the mission is actually complete.

## The demo

The user needs to source 500 industrial sensors under a locked Goal Contract:

- Budget: <= $10,000
- Delivery: <= 7 days
- Restricted regions remain blocked
- Final commitment requires explicit human approval

The agent discovers three suppliers. Atlas Components is cheaper but fails the delivery constraint. The agent recovers without weakening the contract, verifies Nova Supply, stops at the human approval boundary, and only then commits the selection and issues a receipt.
## Why this is a strong WebMCP use case

A normal browser agent can click buttons, but the page does not clearly tell it which actions are safe, what constraints define success, or when it must stop for a human.

This app exposes the workflow as native browser tools using `document.modelContext.registerTool(...)`. The agent can discover the same capabilities the human sees on screen and invoke the same application logic.

WebMCP is central to the experience, not an add-on: the tools expose the goal contract, candidate search, verification, recovery, bounded selection, human approval checkpoint, commitment, and evidence receipt.

## Native WebMCP tools

1. `get_goal_contract()` — read the locked goal and authority boundary.
2. `search_suppliers()` — discover candidate suppliers.
3. `verify_supplier({ supplier_id })` — test a candidate against all contract constraints.
4. `recover_from_failure({ failed_supplier_id })` — choose an untried path without weakening the contract.
5. `select_supplier({ supplier_id })` — select only a verified-passing candidate.
6. `request_human_approval()` — stop at the human authority boundary.
7. `commit_selection()` — blocked until verification and required approval are present.
8. `get_evidence_receipt()` — return the goal status, verification evidence, recovery count, approval state, and receipt ID.
## Human + agent experience

The human owns the Goal Contract. The agent may search, evaluate, recover, and recommend inside that contract, but it cannot silently expand authority or commit an irreversible choice when human approval is required.

The page and the agent share one state machine. A tool call immediately updates the visible UI, so the human can see candidate discovery, a failed verification, recovery, approval requests, and the final verified outcome as they happen.

## Run locally

No application dependencies or API keys are required.

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173`.

For native WebMCP testing in Chrome, enable `chrome://flags/#enable-webmcp-testing`, relaunch Chrome, open the app, and inspect:

```js
const tools = await document.modelContext.getTools();
tools.map((tool) => tool.name);
```
Chrome's current testing implementation expects tool inputs as a JSON string:

```js
const tools = await document.modelContext.getTools();
const verify = tools.find((tool) => tool.name === "verify_supplier");
await document.modelContext.executeTool(
  verify,
  JSON.stringify({ supplier_id: "atlas" })
);
```

## What is new for the hackathon

This submission is a new standalone WebMCP application created during the WebMCP Challenge submission period. Its Goal Contract UI, procurement state machine, native WebMCP registration, verification/recovery behavior, human approval boundary, and evidence receipt were all implemented for this challenge.

## Safety and authority design

- No credentials or secrets are stored in the client.
- The demo uses deterministic local supplier data; it does not place a real order.
- A candidate cannot be selected unless verification passes.
- Final commitment is blocked when human approval is required and missing.
- Recovery changes the route, not the human-defined constraints.
- Read-only tools are annotated with `readOnlyHint: true`.

## Browser verification

The full UI flow has been browser-tested end-to-end: first candidate fails delivery, recovery selects a second candidate, human approval is required, and the final state produces a verification receipt.
