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
