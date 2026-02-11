import { label, title } from "./format";

export function printTopHelp() {
  console.log(`${title("Kair CLI")}

${label("Usage:")}
  kair contract <subcommand> [args]
  kair propose "<intent>" [--requires <controls_csv>] [--id <contract_id>]
  kair plan [<contract_id>] [--last] [--provider <name>] [--model <name>] [--interactive <true|false>] [<plan_json>]
  kair grant [list|<grant>|<contract_id> <grant>] [--actor <name>]
  kair review [<contract_id>] [--last]
  kair accept "<contract_id>" [--actor <name>]
  kair emit "<contract_id>" [--last]

${label("Common subcommands:")}
  propose "<intent>" [--requires <controls_csv>]
  co-plan "<contract_id>"
  plan [<contract_id>] [--last] [--provider <name>] [--model <name>] [--interactive <true|false>] [<plan_json>]
  plan "<contract_id>" "<plan>"
  require-controls "<contract_id>" "<controls_csv>"
  grant [list|<grant>|<contract_id> <grant>] [--actor <name>]
  request-approval "<contract_id>"
  approve "<contract_id>" [--actor <name>]
  run "<contract_id>" [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]
  resume "<contract_id>" [--actor <name>]
  pause "<contract_id>" [--actor <name>]
  rewind "<contract_id>" [--actor <name>] [<reason>]
  review [<contract_id>] [--last]
  accept "<contract_id>" [--actor <name>]
  emit "<contract_id>" [--last]
  status "<contract_id>"
  list

${label("Advanced/demo:")}
  --pause-at pauses at an internal execution milestone (not user-facing yet).
  Top-level "plan" defaults to --interactive=true and --last when no contract id is provided.
  Use --interactive=false with JSON input as an argument or via stdin.

${label("Alias:")}
  kair propose (shorthand for contract propose)

${label("Actor flags:")}
  --actor <name> (alias: --by)

Run "kair contract --help" for full details.`);
}

export function printContractHelp() {
  console.log(`${title("Kair Contract Commands")}

${label("Usage:")}
  kair contract <subcommand> [args]

${label("Subcommands:")}
  propose "<intent>" [--requires <controls_csv>] [--id <contract_id>]
  co-plan "<contract_id>"
  plan "<contract_id>" "<plan>"
  require-controls "<contract_id>" "<controls_csv>"
  request-approval "<contract_id>"
  approve "<contract_id>" [--actor <name>]
  run "<contract_id>" [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]
  resume "<contract_id>" [--actor <name>]
  pause "<contract_id>" [--actor <name>]
  rewind "<contract_id>" [--actor <name>] [<reason>]
  status "<contract_id>"
  list

${label("Advanced/demo:")}
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
