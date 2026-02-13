import { label, title } from "./format";

export function printTopHelp() {
  console.log(`${title("Kair")}

${label("usage:")} kair [--help] <command> [<args>]

These are common Kair commands used in various situations:

${label("start a workflow")}
  propose                 Create a new Contract in DRAFT.
  plan                    Generate/refine a structured plan (kair.plan.v1).
  contract request-approval
                          Move a planned Contract to approval requested.
  approve                 Approve a Contract version.
  contract run            Execute an approved Contract.

${label("governance and controls")}
  grant                   Approve a control grant.
  contract pause          Pause execution.
  contract resume         Resume execution.
  contract rewind         Rewind/supersede a Contract version.

${label("review and inspection")}
  review                  Show one-screen review summary.
  accept                  Record acceptance of responsibility.
  emit                    Show evidence checklist.
  status                  Show full Contract status.
  contract list           List known Contracts.

${label("common usage examples")}
  kair propose "<intent>" [--id <contract_id>]
  kair plan [<contract_id>] [--last] [--provider <name>] [--model <name>] [--interactive <true|false>] [--json] [--debug] [--actor <name>|--by <name>] [<plan_json>]
  kair run [<contract_id>] [--last] [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]
  kair grant [list|<grant>|<contract_id> <grant>] [--actor <name>]
  kair review [<contract_id>] [--last]
  kair accept "<contract_id>" [--actor <name>]
  kair emit [<contract_id>] [--last]

See "kair contract --help" for contract subcommands.
See "kair grant --help" for grant usage.`);
}

export function printContractHelp() {
  console.log(`${title("Kair Contract Commands")}

${label("Usage:")}
  kair contract <subcommand> [args]

${label("Subcommands:")}
  propose "<intent>" [--id <contract_id>]
  plan "<contract_id>" "<plan>"
  request-approval "<contract_id>"
  approve [<contract_id>] [--last] [--actor <name>]
  run [<contract_id>] [--last] [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]
  resume "<contract_id>" [--actor <name>]
  pause "<contract_id>" [--actor <name>]
  rewind "<contract_id>" [--actor <name>] [<reason>]
  status [<contract_id>] [--last]
  list

${label("Advanced/demo:")}
  run defaults to the most recently updated Contract when no id is provided.
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
