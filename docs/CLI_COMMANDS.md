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

### Contract Creation and Planning
- `kair contract "<intent>" [--id <contract_id>]`
  - Create a contract in `DRAFT`.
  - If `--id` is omitted, kair generates an id from intent.
- `kair plan [<contract_id>] [--last] [--provider <name>] [--model <name>] [--interactive <true|false>] [--json] [--debug] [--actor <name>|--by <name>] [<plan_json>]`
  - Interactive by default; generates/refines strict `kair.plan.v1` JSON and persists on accept.
  - Accepted plan shape: top-level `version`, `title`, `steps`; each step requires `id` + `summary`, with optional `details`.
  - With no contract id, defaults to the most recently updated contract.
  - `--interactive=false` accepts JSON from positional argument or stdin.
  - `--json` implies `--interactive=false`, requires JSON from positional argument or stdin, and prints only validated JSON.
  - `--actor` (alias: `--by`) attributes plan history entries.
- `kair plan <contract_id> "<plan>"`
  - Attach a legacy text plan and transition to `PLANNED`.

### Controls and Approval
- `kair grant list`
  - List static starter grants.
- `kair grant <grant> [--actor <name>]`
  - Approve a namespaced grant on the most recently updated contract.
- `kair grant <contract_id> <grant> [--actor <name>]`
  - Approve a namespaced grant on a specific contract.
- `kair propose [<contract_id>] [--last]`
  - Move a planned contract into approval request state.
  - With no args, defaults to the most recently updated contract.
- `kair approve [<contract_id>] [--last] [--actor <name>]`
  - Approve the contract and create a new immutable version.
  - With no args, defaults to the most recently updated contract.

### Execution and Recovery
- `kair run [<contract_id>] [--last] [--provider <name>] [--model <name>] [--debug] [--json]`
  - Execute the approved contract via the OpenClaw runner.
  - With no contract id, defaults to the most recently updated contract.
  - Always writes `artifacts/<contract_id>/run/run-request.json` and `artifacts/<contract_id>/run/run-result.json`.
  - `--debug` prints enabled tool grants and run artifact paths.
  - `--json` prints machine-readable output only.
- `kair pause [<contract_id>] [--last] [--actor <name>]`
  - Pause a running contract.
  - With no args, defaults to the most recently updated contract.
- `kair resume [<contract_id>] [--last] [--actor <name>]`
  - Resume from pause (not currently supported by the OpenClaw runner path).
  - With no args, defaults to the most recently updated contract.
- `kair rewind [<contract_id>] [--last] [--actor <name>] [<reason>]`
  - Append a rewind/supersession event.
  - With no args, defaults to the most recently updated contract.

### Review and Evidence
- `kair review [<contract_id>] [--last]`
  - Show one-screen review for a specific contract, or the most recently updated contract.
  - With no args, defaults to the same behavior as `--last`.
- `kair accept <contract_id> [--actor <name>]`
  - Record explicit acceptance-of-responsibility as an append-only history event (audit trail).
  - Keeps lifecycle state unchanged; this is a governance acknowledgment step after reviewing evidence.
- `kair emit [<contract_id>] [--last]`
  - List evidence checklist from `artifacts/<contract_id>/evidence/index.json`.
  - With no args, defaults to the most recently updated contract.
  - `--last` targets the most recently updated contract.

### Inspection
- `kair status [<contract_id>] [--last]`
  - Print detailed contract state, versions, history, and artifacts.
  - With no args, defaults to the most recently updated contract.
- `kair contracts`
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
kair contract --id contract_demo "Contract Demo"
kair plan contract_demo --interactive=false '{"version":"kair.plan.v1","title":"Contract demo plan","steps":[{"id":"prepare-change","summary":"Prepare implementation details","details":"Gather change context and expected touchpoints."},{"id":"validate-change","summary":"Run tests and verify outcomes","details":"Run automated checks and capture evidence."}]}'
kair propose
kair approve contract_demo --actor Damien
kair run
kair review
kair accept contract_demo --actor Damien
kair emit
```
