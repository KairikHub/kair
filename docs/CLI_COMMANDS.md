# Kair Protocol CLI Commands

## Run Mode
Run commands from inside the container:

```bash
docker compose up -d --build
docker exec -it kair bash

# Then run short CLI commands
kair <command>
```

## Command Groups

### Propose and Plan
- `kair propose "<intent>" [--id <contract_id>] [--requires <controls_csv>]`
  - Top-level shorthand for contract propose.
- `kair contract create --id <contract_id> "<intent>"`
  - Create a new contract with an explicit ID.
- `kair contract propose "<intent>" [--id <contract_id>] [--requires <controls_csv>]`
  - Propose a contract with optional required controls.
- `kair plan [<contract_id>] [--last] [--provider <name>] [--model <name>] [--interactive <true|false>] [--instructions <text>] [--file <path>] [--json] [<plan_json>]`
  - Interactive by default; generates/refines strict `kair.plan.v1` JSON and persists on accept.
  - With no contract id, defaults to the most recently updated contract.
  - `--interactive=false --instructions "<text>"` performs one provider refine and persists.
  - `--interactive=false` without instructions accepts JSON from `--file`, positional argument, or stdin.
- `kair contract plan <contract_id> "<plan>"`
  - Attach a legacy text plan and transition to `PLANNED`.

### Controls and Approval
- `kair contract require-controls <contract_id> "<controls_csv>"`
  - Set required controls on an existing contract.
- `kair grant list`
  - List static starter grants.
- `kair grant <grant> [--actor <name>]`
  - Approve a namespaced grant on the most recently updated contract.
- `kair grant <contract_id> <grant> [--actor <name>]`
  - Approve a namespaced grant on a specific contract.
- `kair contract request-approval <contract_id>`
  - Move a planned contract into approval request state.
- `kair contract approve <contract_id> [--actor <name>]`
  - Approve the contract and create a new immutable version.

### Execution and Recovery
- `kair contract run <contract_id> [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]`
  - Execute the approved contract.
- `kair contract pause <contract_id> [--actor <name>]`
  - Pause a running contract.
- `kair contract resume <contract_id> [--actor <name>]`
  - Resume from pause.
- `kair contract rewind <contract_id> [--actor <name>] [<reason>]`
  - Append a rewind/supersession event.

### Review and Evidence
- `kair review [<contract_id>] [--last]`
  - Show one-screen review for a specific contract, or the most recently updated contract.
  - With no args, defaults to the same behavior as `--last`.
- `kair accept <contract_id> [--actor <name>]`
  - Record explicit acceptance-of-responsibility as an append-only history event (audit trail).
  - Keeps lifecycle state unchanged; this is a governance acknowledgment step after reviewing evidence.
- `kair emit <contract_id> [--last]`
  - List evidence checklist from `artifacts/<contract_id>/evidence/index.json`.
  - `--last` targets the most recently updated contract.

### Inspection
- `kair contract status <contract_id>`
  - Print detailed contract state, versions, history, and artifacts.
- `kair contract list`
  - List known contract IDs.

## Review Output (What It Includes)
`kair review` and `kair review <id>` include:
- Contract ID, state, active version
- Approved intent (or current intent)
- Constraints (required/approved controls, budget)
- Execution summary (artifact count, last run artifact timestamp)
- Evidence checklist
- Decision action prompts for accept/grant/rewind/evidence

## Minimal Demo Flow

```bash
kair propose --id contract_demo "Contract Demo"
kair plan contract_demo --interactive=false '{"version":"kair.plan.v1","title":"Contract demo plan","steps":[{"id":"prepare-change","summary":"Prepare implementation details"},{"id":"validate-change","summary":"Run tests and verify outcomes"}]}'
kair contract request-approval contract_demo
kair contract approve contract_demo --actor Damien
kair contract run contract_demo
kair review
kair accept contract_demo --actor Damien
kair emit contract_demo
```
