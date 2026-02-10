# kair CLI Stability Contract

## Stable (Commitment)
These commands reflect the core mental model of kair: define intent, plan, request and grant approval, review outcomes, and inspect current state. They will evolve slowly, and semantics should be preserved where possible. Small UX and output tweaks may still happen.

- `kair contract propose`
- `kair contract plan`
- `kair contract request-approval`
- `kair contract approve`
- `kair review`
- `kair contract rewind`
- `kair contract status`
- `kair contract list`

## Experimental (May Change or Break)
These surfaces are implementation details or exploratory capabilities. There are no stability guarantees, and behavior, flags, output, or availability may change or break without notice.

- `kair contract co-plan`
- `kair contract run`
- `kair contract resume`
- `kair contract pause`
- `kair emit`
  - Experimental artifact/emission helper; semantics and output may change.
- Any OpenClaw-related behavior
- Evidence file formats (schemas may change)
- Any command or output surface not listed in **Stable**

## Non-Goals
- Backward compatibility guarantees
- Orchestration feature parity
- Stable plugin APIs

## Versioning
There is no semantic versioning policy yet. Treat releases as experimental unless stated otherwise.
