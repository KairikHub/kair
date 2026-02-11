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

## Quick Smoke Test
Run these commands to verify the install works end-to-end:

```bash
docker exec -it kair bash
kair --help
kair grant list
kair contract create --id smoke_demo "Smoke test install"
kair contract plan smoke_demo "Run a minimal install verification"
kair contract request-approval smoke_demo
kair contract approve smoke_demo --actor tester
kair contract run smoke_demo
kair review
kair emit smoke_demo
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
