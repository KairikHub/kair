import { label, title } from "./format";

export function printTopHelp() {
  console.log(`${title("Kair")}

${label("usage:")} kair [--help] <command> [<args>]

These are common Kair commands used in various situations:

${label("start a workflow")}
  propose                 Create a new Contract in DRAFT.
  plan                    Generate/refine a structured plan (kair.plan.v1).
  request-approval
                          Move a planned Contract to approval requested.
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

See "kair contract --help" for contract subcommands.
See "kair grant --help" for grant usage.`);
}

export function printProposeHelp() {
  console.log(`${title("Kair Propose Command")}

${label("Usage:")}
  kair propose "<intent>" [--id <contract_id>]
  kair contract propose "<intent>" [--id <contract_id>]

${label("Description:")}
  Create a new Contract in DRAFT state.

${label("Notes:")}
  If --id is omitted, kair generates a suggested contract id from intent.
`);
}

export function printPlanHelp() {
  console.log(`${title("Kair Plan Command")}

${label("Usage:")}
  kair plan [<contract_id>] [--last] [--provider <name>] [--model <name>] [--interactive <true|false>] [--json] [--debug] [--actor <name>|--by <name>] [--instructions <text>] [--file <path>] [<plan_json>]
  kair contract plan "<contract_id>" "<plan>"

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

export function printRequestApprovalHelp() {
  console.log(`${title("Kair Request-Approval Command")}

${label("Usage:")}
  kair request-approval [<contract_id>] [--last]
  kair contract request-approval [<contract_id>] [--last]

${label("Description:")}
  Move a planned Contract to AWAITING_APPROVAL.

${label("Notes:")}
  If <contract_id> is omitted, request-approval targets the most recently updated Contract.
  Do not combine <contract_id> with --last.
`);
}

export function printApproveHelp() {
  console.log(`${title("Kair Approve Command")}

${label("Usage:")}
  kair approve [<contract_id>] [--last] [--actor <name>]
  kair contract approve [<contract_id>] [--last] [--actor <name>]

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
  kair run [<contract_id>] [--last] [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]
  kair contract run [<contract_id>] [--last] [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]

${label("Description:")}
  Execute an approved Contract.

${label("Notes:")}
  If <contract_id> is omitted, run targets the most recently updated Contract.
  Do not combine <contract_id> with --last.
  --pause-at is an internal/demo checkpoint pause hook.
`);
}

export function printPauseHelp() {
  console.log(`${title("Kair Pause Command")}

${label("Usage:")}
  kair pause [<contract_id>] [--last] [--actor <name>]
  kair contract pause [<contract_id>] [--last] [--actor <name>]

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
  kair contract resume [<contract_id>] [--last] [--actor <name>]

${label("Description:")}
  Resume execution of a PAUSED Contract.

${label("Notes:")}
  If <contract_id> is omitted, resume targets the most recently updated Contract.
  Do not combine <contract_id> with --last.
  --actor (alias: --by) records who resumed execution.
`);
}

export function printRewindHelp() {
  console.log(`${title("Kair Rewind Command")}

${label("Usage:")}
  kair rewind [<contract_id>] [--last] [--actor <name>] [<reason>]
  kair contract rewind [<contract_id>] [--last] [--actor <name>] [<reason>]

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

export function printContractHelp() {
  console.log(`${title("Kair Contract Commands")}

${label("Usage:")}
  kair contract <subcommand> [args]

${label("Subcommands:")}
  propose "<intent>" [--id <contract_id>]
  plan "<contract_id>" "<plan>"
  request-approval [<contract_id>] [--last]
  approve [<contract_id>] [--last] [--actor <name>]
  run [<contract_id>] [--last] [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]
  pause [<contract_id>] [--last] [--actor <name>]
  resume [<contract_id>] [--last] [--actor <name>]
  rewind [<contract_id>] [--last] [--actor <name>] [<reason>]
  status [<contract_id>] [--last]
  list

${label("Advanced/demo:")}
  request-approval defaults to the most recently updated Contract when no id is provided.
  run defaults to the most recently updated Contract when no id is provided.
  pause/resume/rewind default to the most recently updated Contract when no id is provided.
  --pause-at pauses at an internal execution milestone (not user-facing yet).

${label("Alias:")}
  kair propose (shorthand for contract propose)

${label("Actor flags:")}
  --actor <name> (alias: --by)
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
