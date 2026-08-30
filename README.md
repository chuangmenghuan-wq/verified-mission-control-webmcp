# Verified Mission Control

> **Goal Contracts for the Agent-Native Web**

**WebMCP gives agents tools. Verified Mission Control decides what the agent may decide.**

Live production: https://verified-mission-control-webmcp.vercel.app

Built for **The WebMCP Challenge 2026** by Future Ability. MIT licensed.

## What this is

Verified Mission Control is a **WebMCP-native decision control plane for agents**. It keeps the original human goal immutable, lets the agent explore and compose many plans, compresses the meaningful trade-offs for human judgment, turns those judgments into a bounded authority envelope, repairs execution inside that envelope, and records the full decision provenance.

**Sensor fulfillment is only the demo scenario.** The reusable loop is:

`Goal → Explore → Generate plans → Verify → Compress trade-offs → Human decision → Bounded repair → Final authority → Evidence`

## The upgraded demo

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

No single option satisfies every original constraint. The agent composes **17 raw combinations**, rejects impossible or dominated routes, and compresses them to three human-relevant plans:

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
2. `discover_fulfillment_options()`
3. `generate_candidate_plans()`
4. `verify_candidate_plans()`
5. `request_human_decision()`
6. `repair_plan()`
7. `request_final_approval()`
8. `commit_plan()`
9. `get_evidence_receipt()`

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
- 17 → 3 plan compression
- human trade-off decision
- execution disruption
- autonomous repair
- final human approval
- final verified outcome

This is stronger than a success log: it explains **why the agent was allowed to do what it did**.

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

## Judge path

1. Run **Run the decision demo**.
2. Watch the market exploration and 17 → 3 decision compression.
3. Choose **Preserve deadline + exact spec**.
4. Watch Cobalt fail from 200 → 150.
5. Watch the agent repair locally to Atlas 300 + Cobalt 150 + Echo 100.
6. Observe `FINAL_COMMIT_APPROVAL_REQUIRED`.
7. Approve final commitment.
8. Inspect the decision provenance receipt.
