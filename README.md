# What Is Kair? 
AI outputs faster than humans can take responsibility for it.  Kair is here to close that gap.  

In our pipe dream roadmap, "kair" will be the "git" for ai work, and "Kairik" will be the github of AI. 

<img alt="image" src="https://github.com/user-attachments/assets/f6be94d7-c859-4533-b889-d14ac808127c" />

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

## Quick Smoke Test
Run these commands to verify the install works end-to-end:

```bash
docker exec -it kair bash
kair --help
kair grant list
kair contract --id smoke_demo "Smoke test install"
kair plan smoke_demo --interactive=false '{"version":"kair.plan.v1","title":"Docs example plan","steps":[{"id":"s1","summary":"Verify install","details":"Run kair --help and confirm core commands work."}]}'
kair propose --last
kair approve smoke_demo --actor tester
kair run
kair review
kair status
kair emit
kair contracts
kair accept smoke_demo --actor tester
```

## Documentation
- Command reference: `docs/CLI_COMMANDS.md`
- CLI stability expectations are documented in `docs/CLI_STABILITY.md`.
- Architecture: `docs/ARCHITECTURE.md`
- Decisions: `docs/DECISIONS.md`
- Roadmap: `docs/ROADMAP.md`
- Competition analysis: `docs/COMPETITION.md`
- Changelog: `CHANGELOG.md`
