# Roadmap

## Current Focus
- OpenClaw-first execution backend interface and adapter hardening.
- CLI-only governance workflow quality and reliability.

## Demo Definition of Done
A 5–10 minute CLI demo that shows:
- Contract creation
- Plan capture/refine
- Controls block and grant resolution
- Approval submission and approval
- Run (artifact emission)
- Rewind and status

All steps must preserve append-only history and auditability in a Docker-first flow.

## Strategic Direction
### Interface Boundary
- Kair remains CLI-first and CLI-only in this repository.
- External interfaces (if built later) live outside this repo and consume CLI/runtime boundaries.

### OpenClaw Integration
- Kair is the governance/authority layer.
- OpenClaw is an execution backend.
- Invocation happens during `run` under approved contracts.
- Output is captured as Kair artifacts and audit history entries.

### Controls and Capability Mapping
- Controls are user-facing grants (`namespace:permission`).
- Capability mappings remain implementation details.
- Missing controls block approval/execution.
- Grants and state transitions remain append-only.

## Next
- Improve audit/readability surfaces in CLI outputs.
- Harden OpenClaw backend mapping and execution artifact fidelity.
- Expand deterministic test coverage for approval/run/rewind paths.
- Continue tightening local-first, Docker-first developer workflow.
