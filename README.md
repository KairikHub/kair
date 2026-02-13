# What Is Kair? 
AI outputs faster than humans can take responsibility for it.  Kair is here to close that gap.  

In our pipe dream roadmap, "kair" will be the "git" for ai work, and "Kairik" will be the github of AI.

# How? 
Kair is a CLI-first control plane for delegated cognition and AI work, built around auditable contracts and controls and evidence to let humans safely take responsibility for AI generated work.  

`kair` is the open protocol CLI. Kairik is the company that builds on it.

## Quick Install (Docker Only)

```bash
docker compose up -d --build
```

This prepares the CLI container runtime.
OpenClaw is installed from npm during image build; no git submodule setup is required.

## No UI Included

kair is a CLI-only tool. There is no bundled web UI.
Future UI development (if any) will be in a separate repository/package.

## CLI Command Surface
The current `kair --help` command groups are:

- Start a workflow:
  - `kair contract` create a new Contract in `DRAFT`
  - `kair plan` generate/refine structured `kair.plan.v1`
  - `kair propose` submit a planned Contract for approval
  - `kair approve` approve a Contract version
  - `kair run` execute an approved Contract
- Governance and controls:
  - `kair grant`, `pause`, `resume`, `rewind`
- Review and inspection:
  - `kair review`, `accept`, `emit`, `status`, `contracts`

## Documentation
- Command reference: `docs/CLI_COMMANDS.md`
- CLI stability expectations are documented in `docs/CLI_STABILITY.md`.
- Architecture: `docs/ARCHITECTURE.md`
- Decisions: `docs/DECISIONS.md`
- Roadmap: `docs/ROADMAP.md`
- Competition analysis: `docs/COMPETITION.md`
- Changelog: `CHANGELOG.md`
