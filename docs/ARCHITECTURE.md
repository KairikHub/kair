Confidential & Proprietary. Not for distribution.

# Architecture

## v0 Execution Surface
Kairik v0 is a CLI-first control plane.

## Persistence (v0)
Contracts are persisted to a local JSON store (`data/contracts.json`) so audits survive across runs.

## Contract = Repo (Authority Boundary)

A **Contract** is the unit of authority in Kairik. It behaves like a Git repo:

- **One Contract = one responsibility boundary**
- **One active truth** inside a Contract (no branching)
- History is **append-only**
- A new responsibility boundary is created by **forking into a new Contract**

**Why “no branching” matters**
- Branches create multiple simultaneous “truth candidates”
- Kairik enforces **one active Contract** so accountability is unambiguous:
  - “What are we currently accountable to?”
  - “What was approved?”
  - “What changed, and when?”

### Versioning inside a Contract

- **Approve a Kairik Contract = Commit**
  - An approval creates a new immutable version (commit-like) of the Contract.
- **Execution = Deploy**
  - Running a Contract executes against the currently active approved version.
- **Rewind a Kairik Contract = Revert (never reset / force-push)**
  - Rewind creates a new version that supersedes a prior active version.
  - Rewind does not erase history.

> Rewind doesn’t undo the past — it changes what you’re accountable to.

### Forking

Forking is the only way to change the responsibility boundary.
- You do **not** expand a Contract’s scope silently.
- You either:
  - revise the proposal to fit the existing Contract,
  - rewind and explicitly update the Contract,
  - approve a bounded exception,
  - or fork into a new Contract.

## Controls

Controls are explicit, revocable authority grants (killable access points).

- Controls limit power, not correctness.
- Controls are enforced at execution time and recorded in audit history.
- Rewind can remove Controls without erasing history.
- Controls are user-facing; skills are implementation details only.
- If a proposal requires a Control that is not approved, the proposal is blocked until explicitly resolved.

### Example: Schwab Strategy (missing Control)

Approved Controls:
- none

Proposal:
- “Alert on individual stock buys”

Result:
- FAIL — this proposal expands scope and requires `schwab:read`, which is not approved.

Resolution paths must be explicit and logged:
1. Revise the proposal to avoid the missing Control.
2. Add and approve the missing Control.
3. Rewind and update the Contract (new approval).
4. Fork into a new Contract.

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

## Core Object: Contract

The Contract is the single authoritative object in the system.

It contains the following fields:

- id
- intent
- plan
- current_state
- history (append-only)
- approvals
- controlsRequired
- controlsApproved
- activeVersion
- versions (append-only)
- executor_ref
- artifacts
- timestamps

Do NOT add types.
Do NOT add validation logic.
Do NOT add implementation notes.

## CLI Demo (Controls Enforcement)

```bash
docker compose run --rm kairik contract propose "Schwab Strategy" --requires schwab:read -- contract plan contract_1 "Alert on individual stock buys" -- contract request-approval contract_1
```
