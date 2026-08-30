# Verified Mission Control

> **Goal Contracts for the Agent-Native Web**

**WebMCP gives agents tools. Verified Mission Control gives those tools accountability.**

Live production: https://verified-mission-control-webmcp.vercel.app

Built for **The WebMCP Challenge 2026** by Future Ability. Licensed under the **MIT License**.

## What this is

Verified Mission Control is a **WebMCP-native governance and execution layer for agents**. It puts a human-defined Goal Contract around typed browser tools, verifies whether actions actually satisfy that contract, recovers from failed paths without weakening the original goal, enforces human authority before irreversible actions, and emits an evidence receipt when the mission is complete.

**Supplier selection is only the demo scenario.** Procurement makes the control loop easy to inspect, but the product idea is the reusable governance layer:

`Goal → Authority → Typed WebMCP tools → Verification → Recovery → Human gate → Evidence`

## Why WebMCP

Traditional browser automation often has to infer intent from text, selectors, screenshots, and layout. WebMCP lets the website expose explicit typed actions with schemas and descriptions.

Verified Mission Control uses that typed surface as the execution boundary, then adds the layer WebMCP itself does not provide:

- a human-owned Goal Contract,
- outcome verification,
- recovery that preserves the original constraints,
- technically enforced human authority,
- and an inspectable evidence receipt.

The human and the agent share the same application state. Tool calls update the visible UI immediately.

## Native WebMCP implementation

The app registers eight native tools with `document.modelContext.registerTool(...)`:

1. `get_goal_contract()`
2. `search_suppliers()`
3. `verify_supplier({ supplier_id })`
4. `recover_from_failure({ failed_supplier_id })`
5. `select_supplier({ supplier_id })`
6. `request_human_approval()`
7. `commit_selection()`
8. `get_evidence_receipt()`

The native tool source is in [`app.js`](./app.js).

Example:

```js
document.modelContext.registerTool({
  name: "commit_selection",
  description: "Finalize only after verification and any required human approval.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  execute: toolCommitSelection
});
```

## The enforced authority proof

`commit_selection()` is not a visual warning. It is a real gate in the tool implementation.

If a verified supplier is selected but human approval is required and has not been granted, the tool returns:

```json
{
  "ok": false,
  "error": "HUMAN_APPROVAL_REQUIRED",
  "next": "Call request_human_approval and wait for the human."
}
```

The guided judge path intentionally attempts this blocked commit before requesting approval, so the behavior is visible in the live UI.

## 60-second judge path

1. Run **Run the judge path**.
2. The human Goal Contract is locked.
3. Atlas Components is discovered but fails the 7-day delivery constraint.
4. The agent recovers to Nova Supply **without changing the Goal Contract**.
5. Nova passes verification and is selected.
6. The app intentionally calls `commit_selection()` before approval.
7. The commit is blocked with `HUMAN_APPROVAL_REQUIRED`.
8. The human clicks **Approve selection**.
9. Only then can the commit succeed.
10. A verification receipt is generated.

This single flow demonstrates the core claims: native WebMCP, outcome verification, recovery, enforced human authority, and evidence.

## Tool behavior summary

| Tool | Purpose | Guardrail |
|---|---|---|
| `get_goal_contract` | Read goal + authority | Requires locked contract |
| `search_suppliers` | Discover candidates | Results remain unverified |
| `verify_supplier` | Check every constraint | Produces explicit pass/fail |
| `recover_from_failure` | Choose alternate route | Cannot weaken the contract |
| `select_supplier` | Select candidate | Requires verified pass |
| `request_human_approval` | Pause at authority boundary | Requires a selection |
| `commit_selection` | Irreversible final action | Blocks without required approval |
| `get_evidence_receipt` | Read mission evidence | Returns status, verification, approval and receipt |

## Run locally

No application dependencies, credentials, API keys, or external services are required.

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`.

For Chrome WebMCP testing, enable:

```text
chrome://flags/#enable-webmcp-testing
```

Then relaunch Chrome and inspect:

```js
const tools = await document.modelContext.getTools();
tools.map((tool) => tool.name);
```

Chrome's current testing implementation accepts tool input as a JSON string:

```js
const tools = await document.modelContext.getTools();
const verify = tools.find((tool) => tool.name === "verify_supplier");
await document.modelContext.executeTool(
  verify,
  JSON.stringify({ supplier_id: "atlas" })
);
```

## Safety, trust, and implementation evidence

- No credentials or secrets are stored in the client.
- The supplier dataset is deterministic demo data and does not place a real order.
- A candidate cannot be selected unless verification passes.
- Final commitment is technically blocked when required human approval is missing.
- Recovery changes the route, never the locked human constraints.
- Read-only tools are annotated with `readOnlyHint: true`.
- Production sends a restrictive Content Security Policy plus `nosniff`, Referrer Policy, and Permissions Policy headers.
- Source is public and inspectable.
- MIT license: [`LICENSE`](./LICENSE).

## Hackathon scope

This is a standalone WebMCP application created during the WebMCP Challenge submission period. The Goal Contract UI, state machine, native WebMCP registration, verification and recovery behavior, human approval gate, evidence receipt, and judge-facing proof surface were implemented for this challenge.
