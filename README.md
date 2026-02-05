# Kairik

## Kairik Cards 
A Kairik card is a repository for decisions that affect the real world.

## Run via Docker

Build the image:

```bash
docker compose build
```

Run the full demo sequence in one container invocation:

```bash
docker compose run --rm kairik create "..." -- plan task_1 "..." -- request-approval task_1 -- approve task_1 Damien -- run task_1 -- status task_1
```

Args after the service name are passed directly to Kairik because the image ENTRYPOINT is `npm run kairik --`.
The compose config mounts `/app/node_modules` as a separate volume so the image dependencies stay available.

## Card/Contract Model
See `docs/ARCHITECTURE.md` for the card/repo model and contract testing rules.

## Damien Walkthrough

Copy/paste demo (one command):

```bash
docker compose run --rm kairik create "Upgrade Laravel 9 to 10 without breaking checkout" -- plan task_1 "Upgrade dependencies, run migrations in dry-run, run tests, validate checkout" -- request-approval task_1 -- approve task_1 Damien -- run task_1 -- rewind task_1 Damien "Checkout regression risk identified; rewind to review migration plan." -- status task_1
```

Narrative:
- The intent is captured in plain English.
- The plan is recorded and approval is explicitly requested.
- Damien approves, establishing the authority gate before execution.
- After completion, Damien rewinds with a stated reason and authority.
- Status prints an audit report with history, approvals, rewind authority, and the completion summary.
