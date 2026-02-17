# kair CLI Stability Contract

## Stable (Commitment)
These commands reflect the core mental model of kair: define intent, plan, request and grant approval, review outcomes, and inspect current state. They will evolve slowly, and semantics should be preserved where possible. Small UX and output tweaks may still happen.

- `kair propose`
- `kair contract`
- `kair plan`
- `kair grant`
- `kair approve`
- `kair review`
- `kair accept`
- `kair rewind`
- `kair status`
- `kair contracts`

## Experimental (May Change or Break)
These surfaces are implementation details or exploratory capabilities. There are no stability guarantees, and behavior, flags, output, or availability may change or break without notice.

- `kair run`
- `kair resume`
- `kair pause`
- `kair plan` legacy text-plan path (`kair plan <contract_id> "<plan>"`)
- `kair emit`
  - Experimental artifact/emission helper; semantics and output may change.
- Any native runner-related behavior
- Evidence file formats (schemas may change)
- Any command or output surface not listed in **Stable**

## Non-Goals
- Backward compatibility guarantees
- Orchestration feature parity
- Stable plugin APIs

## Versioning
There is no semantic versioning policy yet. Treat releases as experimental unless stated otherwise.
