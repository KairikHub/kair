import { label, title } from "./format";

export function printTopHelp() {
  console.log(`${title("Kairik CLI")}

${label("Usage:")}
  kair contract <subcommand> [args]
  kair propose "<intent>" [--requires <controls_csv>] [--id <contract_id>]

${label("Common subcommands:")}
  propose "<intent>" [--requires <controls_csv>]
  co-plan "<contract_id>"
  plan "<contract_id>" "<plan>"
  require-controls "<contract_id>" "<controls_csv>"
  add-control "<contract_id>" "<control>" [--actor <name>]
  request-approval "<contract_id>"
  approve "<contract_id>" [--actor <name>]
  run "<contract_id>" [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]
  resume "<contract_id>" [--actor <name>]
  pause "<contract_id>" [--actor <name>]
  rewind "<contract_id>" [--actor <name>] [<reason>]
  review --last
  contract review "<contract_id>"
  contract accept "<contract_id>" [--actor <name>]
  contract evidence "<contract_id>"
  status "<contract_id>"
  list

${label("Advanced/demo:")}
  --pause-at pauses at an internal execution milestone (not user-facing yet).

${label("Alias:")}
  kair propose (shorthand for contract propose)

${label("Actor flags:")}
  --actor <name> (alias: --by)

Run "kair contract --help" for full details.`);
}

export function printContractHelp() {
  console.log(`${title("Kairik Contract Commands")}

${label("Usage:")}
  kair contract <subcommand> [args]

${label("Subcommands:")}
  propose "<intent>" [--requires <controls_csv>] [--id <contract_id>]
  co-plan "<contract_id>"
  plan "<contract_id>" "<plan>"
  require-controls "<contract_id>" "<controls_csv>"
  add-control "<contract_id>" "<control>" [--actor <name>]
  request-approval "<contract_id>"
  approve "<contract_id>" [--actor <name>]
  run "<contract_id>" [--pause-at <checkpoint>] [--pause-authority <name>] [--pause-reason <text>]
  resume "<contract_id>" [--actor <name>]
  pause "<contract_id>" [--actor <name>]
  rewind "<contract_id>" [--actor <name>] [<reason>]
  review "<contract_id>"
  accept "<contract_id>" [--actor <name>]
  evidence "<contract_id>"
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
