Confidential & Proprietary. Not for distribution.

# Kair Protocol CLI Commands

## Run Mode
Use either style:

```bash
# Single command in a disposable container
docker compose --profile cli run --rm kairik kair <command>

# Interactive shell in persistent container
docker compose --profile cli up -d kairik
docker exec -it kairik bash
kair <command>
```

## Command Groups

### Propose and Plan
- `kair contract create --id <contract_id> "<intent>"`
  - Create a new contract with an explicit ID.
- `kair contract propose "<intent>" [--id <contract_id>] [--requires <controls_csv>]`
  - Propose a contract with optional required controls.
- `kair contract plan <contract_id> "<plan>"`
  - Attach an execution plan.
- `kair contract co-plan <contract_id>`
  - Generate a plan using the configured LLM provider.

### Controls and Approval
- `kair contract require-controls <contract_id> "<controls_csv>"`
  - Set required controls on an existing contract.
- `kair contract add-control <contract_id> <control> [--actor <name>]`
  - Approve one required control.
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
- `kair review --last`
  - Show one-screen review for the most recently updated contract.
- `kair contract review <contract_id>`
  - Show one-screen review for a specific contract.
- `kair contract accept <contract_id> [--actor <name>]`
  - Record explicit acceptance-of-responsibility as an append-only history event (audit trail).
  - Keeps lifecycle state unchanged; this is a governance acknowledgment step after reviewing evidence.
- `kair contract evidence <contract_id>`
  - List evidence checklist from `artifacts/<contract_id>/evidence/index.json`.

### Inspection
- `kair contract status <contract_id>`
  - Print detailed contract state, versions, history, and artifacts.
- `kair contract list`
  - List known contract IDs.

## Review Output (What It Includes)
`kair review --last` and `kair contract review <id>` include:
- Contract ID, state, active version
- Approved intent (or current intent)
- Constraints (required/approved controls, budget)
- Execution summary (artifact count, last run artifact timestamp)
- Evidence checklist
- Decision action prompts for accept/rewind/evidence

## Minimal Demo Flow

```bash
kair propose --id contract_demo "Contract Demo"
kair contract plan contract_demo "Upgrade deps, run tests, verify checkout"
kair contract request-approval contract_demo
kair contract approve contract_demo --actor Damien
kair contract run contract_demo
kair review --last
kair contract accept contract_demo --actor Damien
kair contract evidence contract_demo
```
