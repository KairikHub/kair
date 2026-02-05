# Architecture

## v0 Execution Surface
Kairik v0 is a CLI-first control plane.

## State Machine

The system models work as a strict, explicit state machine with the following states:

- DRAFT
- PLANNED
- AWAITING_APPROVAL
- APPROVED
- RUNNING
- PAUSED
- FAILED
- COMPLETED
- REWOUND

Do NOT describe transitions yet.

## Core Object: Task

The Task is the single authoritative object in the system.

It contains the following fields:

- id
- intent
- plan
- current_state
- history (append-only)
- approvals
- executor_ref
- artifacts
- timestamps

Do NOT add types.
Do NOT add validation logic.
Do NOT add implementation notes.

## Card Model (Repo Mental Model)
- Card = repo (unit of responsibility)
- Approval = commit
- Execution = deploy
- Rewind = revert (never reset/force-push)
- History is append-only
- No branching in a single card; one active truth at a time
- Forking = new card (new responsibility boundary)

## Testing (Contract/Invariant Checks)
- Testing checks contract/invariant compatibility, not correctness.
- Tests protect commitments, not code quality.
- A test answers: “Does this proposed change expand scope or violate an existing approved constraint?”
- Tests must be explainable in plain English.
- No moralizing, no advice, no optimization. Only consistency enforcement.
- If a change increases scope of what’s tracked or acted on, it must trigger a check and require explicit approval.

Example: Schwab Strategy card
- Approved invariants: “No trades outside index funds.” “Max 2 trades/week.” “Monitoring scope: transactions only.”
- Proposed change: “Alert on individual stock buys.”
- Expected failure: “FAIL: This proposal introduces monitoring of individual stocks, violating approved constraint X.”
- Resolution paths must be explicit and logged:
- Revise proposal to comply
- Rewind and update contract (new approval)
- Approve a bounded exception (time-bound, explicit reason)

## CLI Demo (Contract Testing)

```bash
docker compose run --rm kairik card-create "Schwab Strategy" -- contract-set card_1 "No trades outside index funds" "Max 2 trades/week" "Monitoring scope: transactions only" -- contract-approve card_1 "Risk Owner" -- proposal-set card_1 "Alert on individual stock buys" -- contract-test card_1 -- card-status card_1
```
