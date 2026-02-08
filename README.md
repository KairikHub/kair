Confidential & Proprietary. Not for distribution.

# Kairik

## What It Is
Kairik is a CLI-first control plane for delegated cognition and AI work, built around Contracts and Controls.

`kair` is the open protocol CLI. Kairik is the company that builds on it.

## Quick Install (Docker Only)

```bash
docker compose up -d --build
```

This starts the local UI at `http://localhost:3000` and prepares the CLI container runtime.

## Quick Smoke Test
Run these commands to verify the install works end-to-end:

```bash
docker compose --profile cli run --rm kairik kair --help
docker compose --profile cli run --rm kairik kair contract create --id smoke_demo "Smoke test install"
docker compose --profile cli run --rm kairik kair contract plan smoke_demo "Run a minimal install verification"
docker compose --profile cli run --rm kairik kair contract request-approval smoke_demo
docker compose --profile cli run --rm kairik kair contract approve smoke_demo --actor tester
docker compose --profile cli run --rm kairik kair contract run smoke_demo
docker compose --profile cli run --rm kairik kair review --last
```

If `review --last` prints a `KAIRIK REVIEW` block for `smoke_demo`, the install is working.

## Documentation
- Command reference: `docs/CLI_COMMANDS.md`
- Architecture: `docs/ARCHITECTURE.md`
- Decisions: `docs/DECISIONS.md`
- Roadmap: `docs/ROADMAP.md`
- Competition analysis: `docs/COMPETITION.md`
- Changelog: `CHANGELOG.md`
