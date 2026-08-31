# Verified Mission Control

> **Goal Contracts for the Agent-Native Web**

**WebMCP gives agents tools. Verified Mission Control decides what the agent may decide.**

Live production: https://verified-mission-control-webmcp.vercel.app

Built for **The WebMCP Challenge 2026** by Future Ability. MIT licensed.

## What this is

Verified Mission Control is a **WebMCP-native decision control plane for agents**. It keeps the original human goal immutable, lets the agent explore and compose many plans, compresses the meaningful trade-offs for human judgment, turns those judgments into a bounded authority envelope, repairs execution inside that envelope, and records the full decision provenance.

**The domain is configuration, not control logic.** Sensor fulfillment and production deployment now run through the same reusable loop:

`Goal → Explore → Generate plans → Verify → Compress trade-offs → Human decision → Bounded repair → Final authority → Evidence`

## Generic Decision / Policy Engine

The control logic is split from domain data:

- [`decision-engine.mjs`](./decision-engine.mjs) — generic constraint evaluation, decision-frontier compression, authority envelopes, and authorized repair selection. It contains no supplier or deployment-specific logic.
- [`scenarios.mjs`](./scenarios.mjs) — domain configuration: Goal Contract, candidates, proposed authority envelopes, disruptions, and repair candidates.
- [`app.js`](./app.js) — WebMCP tools + human UI. The same nine tools operate on whichever scenario is active.

Current proof scenarios:

1. **Sensor fulfillment** — quantity / deadline / budget / specification.
2. **Production deployment** — completion / downtime / change cost / rollback safety.

Both compress 7 candidate plans into 3 human-relevant trade-offs, enforce the same two human authority gates, repair an execution disruption inside bounded authority, and finish with a provenance receipt.

## Sensor fulfillment demo

The human Goal Contract is:

- Need at least **500 sensors**
- Delivery **≤ 7 days**
- Base budget **≤ $8,500**
- **Exact model** required
- Final irreversible commitment requires explicit human approval

The market is intentionally fragmented:

- Atlas: 300 units / 6 days / $4,500 / exact spec
- Beacon: 500 units / 11 days / $8,400 / exact spec
- Cobalt: 200 units / 6 days / $5,900 / exact spec
- Delta: 500 units / 5 days / $8,200 / substitute model

No single option satisfies every original constraint. The agent composes **7 candidate plans**, rejects impossible or dominated routes, and compresses them to three human-relevant plans:

1. Preserve deadline + exact spec → Atlas 300 + Cobalt 200 → **budget +$1,900**
2. Preserve budget + exact spec → Beacon 500 → **deadline +4 days**
3. Preserve deadline + budget → Delta 500 → **substitute model**

The human does not approve a supplier. The human chooses which constraint may move.

## Bounded authority + local plan repair

In the recommended path, the human says:

- Deadline stays ≤ 7 days
- Exact specification stays required
- Budget may increase to $10,500
- Split orders are allowed
- Recovery may overbuy up to 10%

Execution then changes: Cobalt drops from 200 available units to 150. The agent does **not restart** and does not ask the human to solve the arithmetic. It preserves Atlas 300 + Cobalt 150 and adds Echo Reserve MOQ 100.

Final repaired plan:

- 550 exact-spec units
- 6 days
- $10,125
- inside the human-authorized decision envelope

Because the repair stays inside the pre-authorized decision space, the agent may repair autonomously. Final irreversible commitment is still blocked until a second explicit human decision.

## Native WebMCP tools

The app registers nine native tools with `document.modelContext.registerTool(...)`:

1. `get_goal_contract()`
2. `discover_options()`
3. `generate_candidate_plans()`
4. `verify_candidate_plans()`
5. `request_human_decision()`
6. `repair_plan()`
7. `request_final_approval()`
8. `commit_plan()`
9. `get_evidence_receipt()`

In a WebMCP-enabled browser, the guided demo itself executes these tools through `document.modelContext.executeTool(...)`. The live UI includes a native execution trace showing each typed call and its machine-readable result. Ordinary browsers use the same underlying functions only as a preview fallback.

Human authorization itself is deliberately **not** exposed as an agent-callable tool. The agent can request a decision, but only a human UI action can create or expand authority.

## Enforced gates

Before a human trade-off decision:

```json
{ "ok": false, "error": "HUMAN_TRADEOFF_DECISION_REQUIRED" }
```

After the trade-off is authorized and the plan is repaired, but before final irreversible approval:

```json
{ "ok": false, "error": "FINAL_COMMIT_APPROVAL_REQUIRED" }
```

Only after explicit final approval can `commit_plan()` return `GOAL_ACHIEVED`.

## Decision provenance receipt

The final receipt records:

- original Goal Contract
- options explored
- 7 → 3 plan compression
- human trade-off decision
- execution disruption
- autonomous repair
- final human approval
- final verified outcome

This is stronger than a success log: it explains **why the agent was allowed to do what it did**.

## Durable + replayable provenance

Completed missions are persisted in the browser as append-only provenance runs. Each event stores its sequence number, timestamp, structured payload, previous hash, and SHA-256 event hash. The final receipt exposes the durable run id, event count, final chain hash, and integrity result.

The **Durable Provenance Vault** survives a page refresh. A judge can verify the latest chain or replay every recorded event in order. Replay is deliberately read-only: it never re-executes `commit_plan()` or any irreversible action.

The current competition demo uses browser-persistent storage, so it proves reload durability and replayability without external credentials. The hash chain is **tamper-evident, not externally signed**; cross-device/server-backed attestation would be a production hardening step rather than something this demo pretends to provide.

## Why WebMCP

Traditional UI automation can click the next-looking button. WebMCP gives the site a typed action surface. Verified Mission Control uses that surface as the substrate for a governed decision loop: machine-readable goals, explicit plan verification, typed errors at authority boundaries, bounded repair, and inspectable evidence.

## Trust + implementation

- Public source code
- MIT license
- Native `document.modelContext.registerTool(...)`
- No credentials or secrets required
- Deterministic demo data; no real order is placed
- `Origin-Agent-Cluster: ?1` for current Chrome WebMCP isolation requirements
- `Permissions-Policy: tools=(self)`
- CSP, `nosniff`, Referrer Policy, and Vercel HSTS

## Reproducible evaluations

The repository includes dependency-free Node tests plus a production Native WebMCP acceptance harness.

```bash
node --test tests/*.test.mjs
node scripts/verify-production-native-webmcp.mjs
```

The unit suite verifies both domains use the same decision engine, non-relaxable goal failures never enter the human decision frontier, authorized repair stays inside the human envelope, provenance survives store re-instantiation, tampering breaks verification, and replay is ordered/read-only.

The production harness launches a temporary WebMCP-enabled Chrome profile and verifies the live Vercel app end-to-end: nine native tools, both human authority gates, Sensor + Deployment completion, durable provenance, page-reload persistence, read-only replay, and SHA-256 chain integrity. It cleans up its temporary Chrome profile after the run.

Latest local run before submission: **8/8 unit evals PASS + production Native WebMCP acceptance PASS**.

## Judge path

Use the scenario switcher to run **Sensor fulfillment** or **Production deployment**. The native tool surface does not change when the domain changes.


1. Run **Run the decision demo**.
2. Watch the market exploration and 7 → 3 decision compression.
3. Choose **Preserve deadline + exact spec**.
4. Watch Cobalt fail from 200 → 150.
5. Watch the agent repair locally to Atlas 300 + Cobalt 150 + Echo 100.
6. Observe `FINAL_COMMIT_APPROVAL_REQUIRED`.
7. Approve final commitment.
8. Inspect the decision provenance receipt.
9. Refresh the page and confirm the durable run is still listed.
10. Click **Verify latest chain**, then **Replay latest evidence** to inspect the read-only event history.
