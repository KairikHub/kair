Confidential & Proprietary. Not for distribution.

# Kairik

## Kairik Contracts
A Kairik Contract is a repository for delegated authority and responsibility.

## Run via Docker

Build the image:

```bash
docker compose build
```

Run the full demo sequence in one container invocation:

```bash
docker compose run --rm kairik contract propose "..." -- contract plan contract_1 "..." -- contract request-approval contract_1 -- contract approve contract_1 Damien -- contract run contract_1 -- contract status contract_1
```

Args after the service name are passed directly to Kairik because the image ENTRYPOINT is `npm run kairik --`.
The compose config mounts `/app/node_modules` as a separate volume so the image dependencies stay available.

## Contract Model
See `docs/ARCHITECTURE.md` for the Contract model and Controls rules.

## Damien Walkthrough

Copy/paste demo (one command):

```bash
docker compose run --rm kairik contract propose "Upgrade Laravel 9 to 10 without breaking checkout" -- contract plan contract_1 "Upgrade dependencies, run migrations in dry-run, run tests, validate checkout" -- contract request-approval contract_1 -- contract approve contract_1 Damien -- contract run contract_1 -- contract rewind contract_1 Damien "Checkout regression risk identified; rewind to review migration plan." -- contract status contract_1
```

Narrative:
- The Contract is proposed in plain English.
- The plan is recorded and approval is explicitly requested.
- Damien approves, establishing the authority gate before execution.
- After completion, Damien rewinds with a stated reason and authority.
- Status prints an audit report with history, approvals, rewind authority, controls, and the completion summary.

## Controls Demo (Blocked Proposal)

This command intentionally fails because the proposal requires a Control that is not approved:

```bash
docker compose run --rm kairik contract propose "Schwab Strategy: alert on individual stock buys" --requires schwab:read -- contract plan contract_1 "Alert on individual stock buys" -- contract request-approval contract_1
```

Resolution paths:
- Revise the proposal to avoid the missing Control.
- Add and approve the missing Control, then request approval again.
- Rewind to update the Contract (or fork into a new Contract).
