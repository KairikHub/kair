Confidential & Proprietary. Not for distribution.

# Kairik

## Kairik Contracts
A Kairik Contract is a repository for delegated authority and responsibility.

## Run via Docker

Start everything (UI + API) with one command:

```bash
docker compose up -d --build
```

Open the UI at `http://localhost:3000`.

Run the full CLI demo sequence in one container invocation:

```bash
docker compose --profile cli run --rm kairik contract propose "..." -- contract plan contract_1 "..." -- contract request-approval contract_1 -- contract approve contract_1 Damien -- contract run contract_1 -- contract status contract_1
```

All commands run inside containers; no host `npm install` is required.

## Contract Model
See `docs/ARCHITECTURE.md` for the Contract model and Controls rules.

## Damien Walkthrough

Copy/paste demo:

```bash
docker compose --profile cli run --rm kairik \
  contract propose "Upgrade Laravel 9 to 10 without breaking checkout" --requires local:write \
  -- contract plan contract_1 "Upgrade dependencies, run migrations in dry-run, run tests, validate checkout" \
  -- contract request-approval contract_1 \
  -- contract add-control contract_1 local:write Damien \
  -- contract request-approval contract_1 \
  -- contract approve contract_1 Damien \
  -- contract run contract_1 \
  -- contract rewind contract_1 Damien "Checkout regression risk identified; rewind to review migration plan." \
  -- contract status contract_1
```

Narrative:
- Propose a Kairik Contract in plain English, including required Controls.
- Controls are killable authority grants; missing Controls block approval and execution.
- The request for approval is blocked because `local:write` is missing, then Damien approves the Control and approval succeeds.
- Approve a Kairik Contract to accept responsibility before execution.
- Run produces a durable artifact on disk.
- Rewind a Kairik Contract with a stated reason and authority.
- Status shows append-only history, active version, and approved Controls.

## Controls Demo (Blocked Proposal)

This command intentionally blocks approval because the proposal requires a Control that is not approved:

```bash
docker compose --profile cli run --rm kairik contract propose "Schwab Strategy: alert on individual stock buys" --requires schwab:read -- contract plan contract_1 "Alert on individual stock buys" -- contract request-approval contract_1
```

Resolution paths:
- Revise the proposal to avoid the missing Control.
- Add and approve the missing Control, then request approval again.
- Rewind to update the Contract (or fork into a new Contract).
