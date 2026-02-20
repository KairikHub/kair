# Kair Protocol CLI Commands

## Run Mode
Run commands from inside the container:

```bash
docker compose up -d --build
docker exec -it kair bash

# Then run short CLI commands
kair <command>
```

## Execution Paths

- No-clone installer (macOS host, no Node/npm):
  - `curl -fsSL https://raw.githubusercontent.com/KairikHub/kair/main/install.sh | sh`
  - Installs the committed prebuilt `.kair` payload from `main` (not raw `src/`).
  - then use `kair <command>` (or `~/bin/kair <command>` or `~/.kair/bin/kair <command>`)
- Embedded runtime (no host Node/npm required):
  - `./.kair/bin/kair <command>`
- Local dev script:
  - `npm run kair -- <command>`
- Docker fallback:
  - `docker compose up -d --build`
  - `docker exec -it kair kair <command>`

## Command Groups

### Contract Creation and Planning
- `kair login --provider <openai|claude>`
  - Browser OAuth login with localhost callback.
  - Stores tokens in keychain (fallback file in test/dev environments).
  - Persists default provider in `.kair/config.json` after successful login.
  - If OAuth client config is missing, opens provider API-key page and prompts for key paste.
- `kair logins` (alias: `kair login list`)
  - Lists provider status for `openai` and `claude`.
  - Reports configured state, source (`env`/`keychain`/`fallback`/`mixed`/`none`), and default marker.
- `kair contract "<intent>" [--id <contract_id>] [--with=git]`
  - Create a contract in `DRAFT`.
  - If `--id` is omitted, kair generates an id from intent.
  - `--with=git` creates/switches branch `kair-contract/<contract_id>` and logs git receipts.
- `kair plan [<contract_id>] [--last] [--provider <name>] [--model <name>] [--interactive <true|false>] [--json] [--debug] [--actor <name>|--by <name>] [<plan_json>]`
  - Interactive by default; generates/refines strict `kair.plan.v1` JSON and persists on accept.
  - Provider resolution order: `--provider`, then `KAIR_LLM_PROVIDER`, then `.kair/config.json` default provider (if configured).
  - If exactly one provider is configured with a key/token, it is auto-selected.
  - If multiple providers are configured, interactive mode prompts; non-interactive mode requires `--provider` or `KAIR_LLM_PROVIDER`.
  - Use `kair logins` to diagnose why provider selection prompts.
  - In a git repo, successful structured plan persistence auto-commits contract-local `.kair` artifacts.
  - Writes `.kair/contracts/<contract_id>/plan/PLAN.md` and `.kair/contracts/<contract_id>/plan/plan_v1.json` when persisted.
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
  - In a git repo, propose fails until contract plan artifacts are committed.
  - If in a git repo, pushes `kair-contract/<contract_id>` to origin.
- `kair approve [<contract_id>] [--last] [--actor <name>]`
  - Approve the contract and create a new immutable version.
  - With no args, defaults to the most recently updated contract.

### Execution and Recovery
- `kair run [<contract_id>] [--last] [--provider <name>] [--model <name>] [--with=git] [--pull] [--interactive] [--dry-run] [--debug] [--json]`
  - Execute the approved contract via the native runner.
  - With no contract id, defaults to the most recently updated contract.
  - Requires `.kair/contracts/<id>/plan/plan_v1.json`, `.kair/contracts/<id>/plan/RULES.md`, and matching approval artifact `.kair/contracts/<id>/approvals/<plan_hash>.json` unless `--dry-run`.
  - `--with=git` verifies git repo and enables pull prompt behavior.
  - `--pull` auto-runs git pull before execution.
  - `--interactive` prompts per plan step before execution.
  - `--dry-run` skips approval gate and runner execution.
  - Always writes `.kair/contracts/<contract_id>/artifacts/run/run-request.json` and `.kair/contracts/<contract_id>/artifacts/run/run-result.json`.
  - Writes streaming events to `.kair/contracts/<contract_id>/artifacts/run/stream.jsonl`.
  - `--debug` prints enabled tool grants and run artifact paths.
  - `--json` prints machine-readable output only.
- `kair pause [<contract_id>] [--last] [--actor <name>]`
  - Pause a running contract.
  - With no args, defaults to the most recently updated contract.
- `kair resume [<contract_id>] [--last] [--actor <name>]`
  - Resume from pause (not currently supported by the native runner path).
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
  - List evidence checklist from `.kair/contracts/<contract_id>/artifacts/evidence/index.json`.
  - With no args, defaults to the most recently updated contract.
  - `--last` targets the most recently updated contract.

### Inspection
- `kair status [<contract_id>] [--last]`
  - Print detailed contract state, versions, history, and artifacts.
  - With no args, defaults to the most recently updated contract.
- `kair contracts`
  - List known contract IDs.

### Maintenance
- `kair self-update`
  - Re-runs the hosted installer to refresh local kair runtime/launcher.
  - Equivalent install source: `https://raw.githubusercontent.com/KairikHub/kair/main/install.sh`.
  - `KAIR_SELF_UPDATE_CMD` can override command execution for advanced/test usage.

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

## Embedded Payload Maintainer Checklist
When source changes should be available via installer:

1. `./scripts/package-kair-runtime.sh`
2. `./scripts/verify-kair-manifest.sh`
3. `./scripts/check-kair-embed-sync.sh`
4. Commit updated `.kair/*` payload files.
