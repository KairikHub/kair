import { label, title } from "./format";

export function printTopHelp() {
  console.log(`${title("Kair")}

${label("usage:")} kair [--help] <command> [<args>]

These are common Kair commands used in various situations:

${label("start a workflow")}
  login                   OAuth login for OpenAI/Claude providers.
  contract                Create a new Contract in DRAFT.
  plan                    Generate/refine a structured plan (kair.plan.v1).
  propose                 Submit a planned Contract for approval.
  approve                 Approve a Contract version.
  run                     Execute an approved Contract.

${label("governance and controls")}
  grant                   Approve a control grant.
  pause                   Pause execution.
  resume                  Resume execution.
  rewind                  Rewind/supersede a Contract version.

${label("review and inspection")}
  review                  Show one-screen review summary.
  accept                  Record acceptance of responsibility.
  emit                    Show evidence checklist.
  status                  Show full Contract status.
  contracts               List known Contracts.

${label("maintenance")}
  self-update             Update local kair install using hosted installer.

See "kair contract --help" for contract creation usage.
See "kair grant --help" for grant usage.`);
}

export function printContractHelp() {
  console.log(`${title("Kair Contract Command")}

${label("Usage:")}
  kair contract "<intent>" [--id <contract_id>] [--with=git]

${label("Description:")}
  Create a new Contract in DRAFT state.

${label("Notes:")}
  If --id is omitted, kair generates a suggested contract id from intent.
`);
}

export function printProposeHelp() {
  console.log(`${title("Kair Propose Command")}

${label("Usage:")}
  kair propose [<contract_id>] [--last]

${label("Description:")}
  Move a planned Contract to AWAITING_APPROVAL.

${label("Notes:")}
  If <contract_id> is omitted, propose targets the most recently updated Contract.
  Do not combine <contract_id> with --last.
`);
}

export function printPlanHelp() {
  console.log(`${title("Kair Plan Command")}

${label("Usage:")}
  kair plan [<contract_id>] [--last] [--provider <openai|claude>] [--model <name>] [--interactive <true|false>] [--json] [--debug] [--actor <name>|--by <name>] [--instructions <text>] [--file <path>] [<plan_json>]

${label("Modes:")}
  Interactive (default): generates/refines plans with accept/refine/cancel prompts.
  Non-interactive: use --interactive=false with JSON from arg, --file, or stdin.
  JSON output: --json prints only validated kair.plan.v1 JSON.

${label("Notes:")}
  If <contract_id> is omitted, plan targets the most recently updated Contract.
  --json implies --interactive=false.
  --debug prints prompt payload and DPC details (suppressed in --json mode).
`);
}

export function printApproveHelp() {
  console.log(`${title("Kair Approve Command")}

${label("Usage:")}
  kair approve [<contract_id>] [--last] [--actor <name>]

${label("Description:")}
  Approve a Contract version and transition it to APPROVED.

${label("Notes:")}
  If <contract_id> is omitted, approve targets the most recently updated Contract.
  Do not combine <contract_id> with --last.
  --actor (alias: --by) records who approved.
`);
}

export function printRunHelp() {
  console.log(`${title("Kair Run Command")}

${label("Usage:")}
  kair run [<contract_id>] [--last] [--provider <name>] [--model <name>] [--with=git] [--pull] [--interactive] [--dry-run] [--force] [--debug] [--json]

${label("Description:")}
  Execute an approved Contract via the native Kair runner.

${label("Notes:")}
  If <contract_id> is omitted, run targets the most recently updated Contract.
  Do not combine <contract_id> with --last.
  Requires PLAN.md, RULES.md, and a valid .kair approval artifact unless --dry-run is used.
  --force is only valid when the Contract is in FAILED state.
  --with=git enables git pull prompt/integration.
  --pull runs git pull automatically.
  --interactive prompts per plan step before execution.
  --dry-run skips workspace modifications and approval-artifact gating.
  --debug prints enabled tool grants and run artifact paths.
  --json prints machine-readable run output only.
`);
}

export function printLoginHelp() {
  console.log(`${title("Kair Login Command")}

${label("Usage:")}
  kair login [--provider <openai|claude>]

${label("Description:")}
  Start OAuth browser login and securely store provider token in OS keychain.

${label("Notes:")}
  If --provider is omitted, uses KAIR_LLM_PROVIDER if set, otherwise prompts in interactive mode.
`);
}

export function printSelfUpdateHelp() {
  console.log(`${title("Kair Self-Update Command")}

${label("Usage:")}
  kair self-update

${label("Description:")}
  Re-run the hosted installer to update local kair runtime and launcher.

${label("Notes:")}
  Uses install script from https://raw.githubusercontent.com/KairikHub/kair/main/install.sh
  Override command for advanced/test usage with KAIR_SELF_UPDATE_CMD.
`);
}

export function printPauseHelp() {
  console.log(`${title("Kair Pause Command")}

${label("Usage:")}
  kair pause [<contract_id>] [--last] [--actor <name>]

${label("Description:")}
  Pause execution of a RUNNING Contract.

${label("Notes:")}
  If <contract_id> is omitted, pause targets the most recently updated Contract.
  Do not combine <contract_id> with --last.
  --actor (alias: --by) records who paused execution.
`);
}

export function printResumeHelp() {
  console.log(`${title("Kair Resume Command")}

${label("Usage:")}
  kair resume [<contract_id>] [--last] [--actor <name>]

${label("Description:")}
  Resume execution of a PAUSED Contract.

${label("Notes:")}
  If <contract_id> is omitted, resume targets the most recently updated Contract.
  Do not combine <contract_id> with --last.
  --actor (alias: --by) records who resumed execution.
  Resume is not yet supported by the native runner path.
`);
}

export function printRewindHelp() {
  console.log(`${title("Kair Rewind Command")}

${label("Usage:")}
  kair rewind [<contract_id>] [--last] [--actor <name>] [<reason>]

${label("Description:")}
  Rewind and supersede a previously executed Contract version.

${label("Notes:")}
  If <contract_id> is omitted, rewind targets the most recently updated Contract.
  Do not combine <contract_id> with --last.
  --actor (alias: --by) records who requested rewind.
`);
}

export function printReviewHelp() {
  console.log(`${title("Kair Review Command")}

${label("Usage:")}
  kair review [<contract_id>] [--last]

${label("Description:")}
  Show a one-screen review summary for a Contract.

${label("Notes:")}
  If <contract_id> is omitted, review targets the most recently updated Contract.
  Do not combine <contract_id> with --last.
`);
}

export function printAcceptHelp() {
  console.log(`${title("Kair Accept Command")}

${label("Usage:")}
  kair accept <contract_id> [--actor <name>]

${label("Description:")}
  Record acceptance of responsibility for evidence-backed review.

${label("Notes:")}
  A contract id is required.
  --actor (alias: --by) records who accepted responsibility.
`);
}

export function printEmitHelp() {
  console.log(`${title("Kair Emit Command")}

${label("Usage:")}
  kair emit [<contract_id>] [--last]

${label("Description:")}
  Show the evidence checklist for a Contract.

${label("Notes:")}
  If <contract_id> is omitted, emit targets the most recently updated Contract.
  Do not combine <contract_id> with --last.
`);
}

export function printStatusHelp() {
  console.log(`${title("Kair Status Command")}

${label("Usage:")}
  kair status [<contract_id>] [--last]

${label("Description:")}
  Show full Contract status, versions, history, and artifacts.

${label("Notes:")}
  If <contract_id> is omitted, status targets the most recently updated Contract.
  Do not combine <contract_id> with --last.
`);
}

export function printContractsHelp() {
  console.log(`${title("Kair Contracts Command")}

${label("Usage:")}
  kair contracts
  kair contracts --help

${label("Description:")}
  List known Contract IDs.
`);
}

export function printPruneHelp() {
  console.log(`${title("Kair Prune Command")}

${label("Usage:")}
  kair prune
  kair prune -a
  kair prune --all

${label("Description:")}
  Destructively remove all stored Contracts and artifact contents.

${label("Notes:")}
  Running without flags prints this help.
  Use -a or --all to preview deletions and confirm with [y]es/[n]o.
`);
}

export function printGrantHelp() {
  console.log(`${title("Kair Grant Commands")}

${label("Usage:")}
  kair grant
  kair grant list
  kair grant <grant> [--actor <name>]
  kair grant <contract_id> <grant> [--actor <name>]

${label("Notes:")}
  Grant format must be <namespace>:<permission> (example: local:write).
  With one grant argument, applies to the most recently updated Contract.
`);
}
