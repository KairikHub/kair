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
Propose → Plan → Grant Controls → Request Approval → Approve → Run/Execute → Pause/Resume → Review/Accept → Rewind → Artifact

Controls enforcement rule:
- If required Controls are not approved, approval/execution is blocked until resolved.

Pause definition (v0):
- Pause is a temporary halt during RUNNING that records state/history without deleting anything.

## Contract Data Model (v0)
- id
- intent
- plan (legacy text plan)
- plan_v1 (structured `kair.plan.v1` object)
- planJson (compatibility field for structured plan reads/writes)
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
- Required controls are validated against a registry.
- Granted controls (`kair grant`) must match `<namespace>:<permission>` format and are append-only history events.

Required Controls Registry (v0):
- cloudflare:read / cloudflare:write
- github:read / github:write
- schwab:read
- local:read / local:write

Grant List Output (current static set):
- local:read / local:write / local:exec
- network:read / network:write

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

## DPC (Decision-Preserving Compression)
- DPC is a compact, structured decision-state artifact used to preserve planning/refinement-critical context in a portable form.
- Canonical shape (`kair.dpc.v1`) maps to A/C/D/Q/E semantics:
  - A = `assumptions`
  - C = `constraints`
  - D = `decisions`
  - Q = `open_questions`
  - E = `evidence`
  - Plus `topic`, `version`, and `updated_at`.
- Storage path: `artifacts/<contract_id>/dpc/dpc_v1.json`.
- Current plan generate/refine flows append prompt/plan evidence into DPC so context remains deterministic and replay-friendly across runs.
- DPC is not narrative prose; it is decision-critical state meant for validation, portability, and auditability.
- Debug visibility: `kair plan --debug` prints the prompt payload plus the DPC artifact path (and a DPC preview). `--json` mode suppresses this debug output.

## UI Shell
- Local UI is a thin shell over the same CLI engine and store.
- The UI server exposes a local HTTP API in the same process; there is no separate API service/container.
- UI focuses on readability, audit trail, Controls gating, and Rewind visibility.

## Execution Backends (Planned)
- OpenClaw can be used as an execution backend during `run`.
- Kair remains the authority layer; OpenClaw remains an implementation detail.
