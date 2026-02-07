Confidential & Proprietary. Not for distribution.

# Changelog

## 2026-02-07
- Vendored OpenClaw runtime and Docker integration; builds are non-interactive and run inside containers.
- CLI container entrypoint wrapper supports `kairik` plus arbitrary commands (node/openclaw/bash).
- BYO OpenAI keys wired through Compose; Kairik co-plan uses OpenAI Responses API; OpenClaw auto-configs OpenAI when key is present.
- UI improvements: plan markdown rendering and contract id truncation for readability.
- CLI UX upgrades: interactive propose with generated IDs, list command, deterministic pause/resume, and colored help/status output.

## 2026-02-06
- CLI-first Contract engine with Controls gating, approvals, rewinds, versions, and audit history.
- Persistent local store at `data/contracts.json`.
- Durable artifacts written on run to `artifacts/<contract_id>/...-run.json`.
- Docker-first runtime (`docker compose up -d --build`) with CLI profile support.
- Local UI shell for Contracts, Controls gating, approvals, run, pause, and rewind.
- Roadmap updates: Tauri distribution path, OpenClaw backend strategy, Custom Controls plan.
- Design decision: actor attribution defaults. CLI no longer forces names on every command, avoids premature auth concepts, preserves audit rigor, and aligns with event-sourced best practices.
