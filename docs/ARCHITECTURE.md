Confidential & Proprietary. Not for distribution.

# Architecture

## Core Principles
- CLI‑first: the CLI is the source of truth for Contracts, Controls, Approvals, Rewinds, Audit history, and Artifacts.
- One active truth per Contract; history is append‑only.
- Controls are user‑facing authority grants; skills are implementation details only.

## Contract Mental Model
- **Contract = repo** (authority boundary).
- **Approve a Kairik Contract = commit‑like approval**.
- **Run/Execute = deploy‑like run**.
- **Rewind a Kairik Contract = revert‑like supersession (never reset / force‑push)**.

## Contract Lifecycle
Propose → Plan → Controls → Request Approval → Approve → Run/Execute → Observe → Rewind → Artifact

Controls enforcement rule:
- If required Controls are not approved, approval/execution is blocked until resolved.

## Contract Data Model (v0)
- id
- intent
- plan
- current_state
- history (append‑only)
- approvals
- controlsRequired
- controlsApproved
- activeVersion
- versions (append‑only)
- executor_ref
- artifacts
- timestamps

## Controls
- Controls are explicit, revocable authority grants (kill switches).
- Missing Controls block approval/execution.
- Controls are recorded in audit history, status output, and artifacts.

Built‑in Controls (v0):
- cloudflare:read / cloudflare:write
- github:read / github:write
- schwab:read
- local:read / local:write

## Persistence
- Local JSON store: `data/contracts.json`.
- Append‑only history is preserved across runs.

## Artifacts
- Written on `run` to `artifacts/<contract_id>/<timestamp>-run.json`.
- Artifacts include contract id, active version, controls approved, and outcome.

## UI Shell
- Local UI is a thin shell over the same CLI engine and store.
- UI focuses on readability, audit trail, Controls gating, and Rewind visibility.

## Execution Backends (Planned)
- OpenClaw can be used as an execution backend during `run`.
- Kairik remains the authority layer; OpenClaw remains an implementation detail.
