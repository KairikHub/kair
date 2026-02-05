# Architecture

## v0 Execution Surface
Kairik v0 is a CLI-first control plane.

## Card = Repo (Responsibility Boundary)

A **Card** is the unit of responsibility in Kairik. It behaves like a Git repo:

- **One Card = one responsibility boundary**
- **One active truth** inside a card (no branching)
- History is **append-only**
- A new responsibility boundary is created by **forking into a new Card**

**Why “no branching” matters**
- Branches create multiple simultaneous “truth candidates”
- Kairik enforces **one active contract** so accountability is unambiguous:
  - “What are we currently accountable to?”
  - “What was approved?”
  - “What changed, and when?”

### Versioning inside a Card

- **Approval = Commit**
  - An approval creates a new immutable version (commit-like) of the Card’s contract.
- **Execution = Deploy**
  - Running a card executes against the currently active approved version.
- **Rewind = Revert (never reset / force-push)**
  - Rewind creates a new version that invalidates a prior active version and selects a new active contract.
  - Rewind does not erase history.

> Rewind doesn’t undo the past — it changes what you’re accountable to.

### Forking

Forking is the only way to change the responsibility boundary.
- You do **not** expand a Card’s scope silently.
- You either:
  - revise the proposal to fit the existing contract,
  - rewind + explicitly update the contract,
  - approve a bounded exception,
  - or fork into a new Card.

## Testing = Contract / Invariant Compatibility

Testing in Kairik is not “correctness.”  
Testing answers one question:

> Does this proposed change violate or expand the scope of an existing approved commitment?

### Contract + Proposed Change

Each Card version contains:
- `contract` (the approved scope + invariants)
- `proposal` (what is being requested/changed)
- `tests` (pure functions) that return:
  - PASS (compatible)
  - FAIL (violates/expands scope)
  - WARN (compatible but noteworthy)

### Example: Scope Expansion (Schwab Strategy)

Existing approved contract:
- “Index funds only”
- “Monitor only purchases of QQQ / SPY / VTI”
- “No alerts for individual stocks”

Proposal:
- “Alert me when I buy individual stocks”

Result:
- FAIL — expands monitoring scope beyond the approved contract.

### Resolution Paths (explicit)

On FAIL, the user must choose one:

1. **Revise proposal** to fit the contract  
   - Remove the scope-expanding behavior.

2. **Rewind + update contract**  
   - Create a new approved contract that includes the expanded scope.
   - (History remains; accountability shifts.)

3. **Approve a bounded exception**
   - Add a narrowly scoped exception (time-boxed, symbol-boxed, or action-boxed)
   - Example: “Allow alerts for AAPL only, for 7 days.”

### Non-goal

Kairik tests do not prove “the world is correct.”
They prove: **the new version stays inside (or explicitly updates) what you previously approved.**

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
