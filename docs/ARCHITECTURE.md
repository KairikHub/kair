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
- Per-contract snapshots: `.kair/contracts/<contract_id>/contract.json`.
- Lightweight index: `.kair/contracts/index.json`.
- Append-only history log: `.kair/contracts/<contract_id>/history.jsonl`.
- Append‑only history is preserved across runs.
- v0 best practices:
  - Write to a temp file, then rename (atomic write).
  - Avoid partial writes on failure.
  - Future: contract‑per‑file storage to avoid a single large JSON.
  - Future: file locking for concurrency.

## Artifacts
- Written on `run` under `.kair/contracts/<contract_id>/artifacts/run/`.
- Canonical files:
  - `run-request.json`
  - `run-result.json`
- Additional pointers may include native runner session logs and tool-produced evidence file paths.

## DPC (Decision-Preserving Compression)
- DPC is a compact, structured decision-state artifact used to preserve planning/refinement-critical context in a portable form.
- Canonical shape (`kair.dpc.v1`) maps to A/C/D/Q/E semantics:
  - A = `assumptions`
  - C = `constraints`
  - D = `decisions`
  - Q = `open_questions`
  - E = `evidence`
  - Plus `topic`, `version`, and `updated_at`.
- Storage path: `.kair/contracts/<contract_id>/dpc/dpc_v1.json`.
- Current plan generate/refine flows append prompt/plan evidence into DPC so context remains deterministic and replay-friendly across runs.
- DPC is not narrative prose; it is decision-critical state meant for validation, portability, and auditability.
- Debug visibility: `kair plan --debug` prints the prompt payload plus the DPC artifact path (and a DPC preview). `--json` mode suppresses this debug output.

## Interface Boundary
- Kair is CLI-only.
- Contract lifecycle, governance, artifacts, and audit semantics are implemented in the CLI/runtime.
- Any future interface lives outside this repository and must treat the CLI as source of truth.

## Execution Backend (v0)
- `kair run` delegates execution to the native runner npm runner adapter.
- Kair remains the authority layer; native runner remains an implementation detail.
