Confidential & Proprietary. Not for distribution.

# Kairik CLI Commands

## Run Mode
Use either style:

```bash
# Single command in a disposable container
docker compose --profile cli run --rm kairik kairik <command>

# Interactive shell in persistent container
docker compose --profile cli up -d kairik
docker exec -it kairik bash
kairik <command>
```

## Command Groups

### Propose and Plan
- `kairik contract create --id <contract_id> "<intent>"`
  - Create a new contract with an explicit ID.
- `kairik contract propose "<intent>" [--id <contract_id>] [--requires <controls_csv>]`
  - Propose a contract with optional required controls.
- `kairik contract plan <contract_id> "<plan>"`
  - Attach an execution plan.
- `kairik contract co-plan <contract_id>`
  - Generate a plan using the configured LLM provider.

### Controls and Approval
- `kairik contract require-controls <contract_id> "<controls_csv>"`
  - Set required controls on an existing contract.
- `kairik contract add-control <contract_id> <control> [--actor <name>]`
  - Approve one required control.
- `kairik contract request-approval <contract_id>`
  - Move a planned contract into approval request state.
- `kairik contract approve <contract_id> [--actor <name>]`
  - Approve the contract and create a new immutable version.

### Execution and Recovery
- `kairik contract run <contract_id> [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]`
  - Execute the approved contract.
- `kairik contract pause <contract_id> [--actor <name>]`
  - Pause a running contract.
- `kairik contract resume <contract_id> [--actor <name>]`
  - Resume from pause.
- `kairik contract rewind <contract_id> [--actor <name>] [<reason>]`
  - Append a rewind/supersession event.

### Review and Evidence
- `kairik review --last`
  - Show one-screen review for the most recently updated contract.
- `kairik contract review <contract_id>`
  - Show one-screen review for a specific contract.
- `kairik contract accept <contract_id> [--actor <name>]`
  - Record explicit acceptance-of-responsibility as an append-only history event (audit trail).
  - Keeps lifecycle state unchanged; this is a governance acknowledgment step after reviewing evidence.
- `kairik contract evidence <contract_id>`
  - List evidence checklist from `artifacts/<contract_id>/evidence/index.json`.

### Inspection
- `kairik contract status <contract_id>`
  - Print detailed contract state, versions, history, and artifacts.
- `kairik contract list`
  - List known contract IDs.

## Review Output (What It Includes)
`kairik review --last` and `kairik contract review <id>` include:
- Contract ID, state, active version
- Approved intent (or current intent)
- Constraints (required/approved controls, budget)
- Execution summary (artifact count, last run artifact timestamp)
- Evidence checklist
- Decision action prompts for accept/rewind/evidence

## Minimal Demo Flow

```bash
kairik contract create --id contract_demo "Upgrade Laravel safely"
kairik contract plan contract_demo "Upgrade deps, run tests, verify checkout"
kairik contract request-approval contract_demo
kairik contract approve contract_demo --actor Damien
kairik contract run contract_demo
kairik review --last
kairik contract accept contract_demo --actor Damien
kairik contract evidence contract_demo
```
