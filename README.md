# What Is Kair? 
AI outputs faster than humans can take responsibility for it.  Kair is here to close that gap.  

In our pipe dream roadmap, "kair" will be the "git" for ai work, and "Kairik" will be the github of AI. 

<img alt="visualize the idea of what kair is" src="https://github.com/user-attachments/assets/581800b7-27a5-44b8-b3a5-5a9698f1e3f4" />

# How? 
Kair is a CLI-first control plane for delegated cognition and AI work, built around auditable contracts and controls and evidence to let humans safely take responsibility for AI generated work.  

`kair` is the open protocol CLI. Kairik is the company that builds on it.

## Quick Install (Docker Only)

```bash
docker compose up -d --build
```

This starts the local UI at `http://localhost:3000` and prepares the CLI container runtime.
OpenClaw is installed from npm during image build; no git submodule setup is required.

## CLI Command Surface
The current `kair --help` command groups are:

- Start a workflow:
  - `contract` create a new Contract in `DRAFT`
  - `plan` generate/refine structured `kair.plan.v1`
  - `propose` submit a planned Contract for approval
  - `approve` approve a Contract version
  - `run` execute an approved Contract
- Governance and controls:
  - `grant`, `pause`, `resume`, `rewind`
- Review and inspection:
  - `review`, `accept`, `emit`, `status`, `contracts`

<img alt="visualize how a kair workflow works" src="https://github.com/user-attachments/assets/889354fe-3725-49d9-b1c9-e57e39444286" />

## Documentation
- Command reference: `docs/CLI_COMMANDS.md`
- CLI stability expectations are documented in `docs/CLI_STABILITY.md`.
- Architecture: `docs/ARCHITECTURE.md`
- Decisions: `docs/DECISIONS.md`
- Roadmap: `docs/ROADMAP.md`
- Competition analysis: `docs/COMPETITION.md`
- Changelog: `CHANGELOG.md`
