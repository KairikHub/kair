Confidential & Proprietary. Not for distribution.

# Kairik

## What It Is
Kairik is a CLI-first control plane for delegated cognition and AI work, built around Contracts and Controls.

## Quickstart (Docker Only)
Start the local UI service with one command:

```bash
docker compose up -d --build
```

Open the UI at `http://localhost:3000`.

Run the CLI demo inside the container:

```bash
docker compose --profile cli run --rm kairik contract propose "..." -- contract plan contract_1 "..." -- contract request-approval contract_1 -- contract approve contract_1 --actor Damien -- contract run contract_1 -- contract status contract_1
```

All commands run inside containers; no host `npm install` is required.

Verify OpenClaw runs inside the CLI container:

```bash
docker compose --profile cli run --rm kairik node vendor/openclaw/openclaw.mjs --help
```

## Damien Walkthrough (CLI)
Copy/paste demo:

```bash
docker compose --profile cli run --rm kairik \
  contract propose "Upgrade Laravel 9 to 10 without breaking checkout" --requires local:write \
  -- contract plan contract_1 "Upgrade dependencies, run migrations in dry-run, run tests, validate checkout" \
  -- contract request-approval contract_1 \
  -- contract add-control contract_1 local:write --actor Damien \
  -- contract request-approval contract_1 \
  -- contract approve contract_1 --actor Damien \
  -- contract run contract_1 --pause-at checkpoint_1 --pause-authority Damien --pause-reason "Hold for checkout verification" \
  -- contract status contract_1 \
  -- contract resume contract_1 --actor Damien \
  -- contract rewind contract_1 --actor Damien "Checkout regression risk identified; rewind to review migration plan." \
  -- contract status contract_1
```

What it proves:
- Propose a Kairik Contract in plain English.
- Controls are explicit, killable authority grants.
- Missing Controls block approval/execution until explicitly approved.
- Approve a Kairik Contract before execution.
- Run produces a durable artifact on disk.
- Pause is a deterministic checkpoint stop; `status` shows PAUSED and history stays append-only.
- Resume continues execution to completion without losing history.
- Rewind a Kairik Contract changes the active version without deleting history.

## Core Concepts
- **Contract**: unit of authority and responsibility (repo-like boundary).
- **Approve a Kairik Contract**: commit-like approval that creates a new immutable version.
- **Run/Execute**: deploy-like execution against the active version.
- **Pause**: temporary halt during execution; recorded in history with no data loss.
- **Rewind a Kairik Contract**: revert-like supersession (append-only history).
- **Controls**: explicit, revocable authority grants (kill switches).
- **Audit History**: append-only record of who approved what and why.
- **Artifacts**: durable outputs written on run.

## Architecture (Short)
- CLI is the source of truth for Contracts, Controls enforcement, Approvals, Rewinds, Audit history, and Artifacts.
- UI is a thin local shell served by the same Node process that exposes a local HTTP API.
- There is no separate API service/container; the UI and API live together in `kairik-ui`.
- Persistence is local (`data/contracts.json`).
- Execution backends (e.g., OpenClaw) are invoked only during `run` under approved Controls.

## Documentation
- Architecture: `docs/ARCHITECTURE.md`
- Roadmap: `ROADMAP.md`
- Changelog: `CHANGELOG.md`
