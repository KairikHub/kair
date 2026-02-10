# Architecture

## Core Principles
- CLI‑first: the CLI is the source of truth for Contracts, Controls, Approvals, Rewinds, Audit history, and Artifacts.
- One active truth per Contract; history is append‑only.
- Controls are user‑facing authority grants; skills are implementation details only.

## Actor Attribution
- An **actor** is the name recorded for authority‑affecting actions (approve, control grants, rewind, pause/resume).
- Kair uses **actor** instead of **user** to avoid implying authentication or identity systems too early.
- Actor attribution is always recorded, but it can be **implicit** (resolved from CLI flags, environment, git user, or OS user).
- This keeps the authority model consistent across local‑first usage, CI/automation, and future multi‑user systems.

## Contract Mental Model
- **Contract = repo** (authority boundary).
- **Approve a Kair Contract = commit‑like approval**.
- **Run/Execute = deploy‑like run**.
- **Rewind a Kair Contract = revert‑like supersession (never reset / force‑push)**.

## Contract Lifecycle
Propose → Plan → Controls → Request Approval → Approve → Run/Execute → Pause → Observe → Rewind → Artifact

Controls enforcement rule:
- If required Controls are not approved, approval/execution is blocked until resolved.

Pause definition (v0):
- Pause is a temporary halt during RUNNING that records state/history without deleting anything.

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
- v0 best practices:
  - Write to a temp file, then rename (atomic write).
  - Avoid partial writes on failure.
  - Future: contract‑per‑file storage to avoid a single large JSON.
  - Future: file locking for concurrency.

## Artifacts
- Written on `run` to `artifacts/<contract_id>/<timestamp>-run.json`.
- Artifacts include `executedVersion`, `controlsApproved`, an intent/plan snapshot, and outcome.

## UI Shell
- Local UI is a thin shell over the same CLI engine and store.
- The UI server exposes a local HTTP API in the same process; there is no separate API service/container.
- UI focuses on readability, audit trail, Controls gating, and Rewind visibility.

## Execution Backends (Planned)
- OpenClaw can be used as an execution backend during `run`.
- Kair remains the authority layer; OpenClaw remains an implementation detail.
