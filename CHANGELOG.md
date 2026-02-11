# Changelog

## 2026-02-07
- Runtime and Docker:
  - Vendored OpenClaw runtime and hardened Docker integration; builds are non-interactive and run inside containers.
  - CLI container entrypoint supports `kair` plus arbitrary commands (`node`, OpenClaw, `bash`) under `--profile cli`.
  - OpenClaw build-on-start safeguards added for bind-mounted workflows.
- LLM and provider wiring:
  - BYO OpenAI key flow wired through Compose (`KAIR_OPENAI_API_KEY`).
  - Initial provider-backed planning flow added using OpenAI Responses API.
  - OpenClaw OpenAI config auto-initializes when keys are present.
- CLI and governance model:
  - CLI refactor split command logic into modules without changing behavior.
  - Interactive propose flow improved with generated IDs when needed.
  - `contract list` command added.
  - Deterministic pause/resume flow retained with append-only history.
  - Actor attribution defaults and governance semantics documented.
- UI and assets:
  - UI readability updates (plan markdown rendering, contract id truncation).
  - Custom favicon support added and stabilized (`/favicon.ico`, png variants, manifest).
  - Browser icon endpoints now support `GET`/`HEAD` and cache-busting links.
- Testing (Docker-first Jest harness):
  - Jest is the canonical test runner (`npm test`) for unit, integration, and e2e suites.
  - Single canonical test command documented (from inside the `kair` container):
    - `npm test`
  - Hermetic test path overrides added:
    - `KAIR_DATA_DIR`
    - `KAIR_ARTIFACTS_DIR`
  - Added test suites for:
    - versioning/append-only invariants
    - persistence round-trip
    - artifact writing
    - end-to-end CLI contract flow
  - Test log noise reduction:
    - `KAIR_TEST_MODE` suppresses audit `console.log` during Jest runs
    - existing `VITEST` behavior preserved for compatibility
- Documentation and strategy:
  - Added `COMPETITION.md` covering direct/indirect/adjacent landscape and Knapsack analysis.
  - Expanded `DECISIONS.md` with a prime directive and strategy framing updates.

## 2026-02-06
- CLI-first Contract engine with Controls gating, approvals, rewinds, versions, and audit history.
- Persistent local store at `data/contracts.json`.
- Durable artifacts written on run to `artifacts/<contract_id>/...-run.json`.
- Docker-first runtime (`docker compose up -d --build`) with CLI profile support.
- Local UI shell for Contracts, Controls gating, approvals, run, pause, and rewind.
- Roadmap updates: Tauri distribution path, OpenClaw backend strategy, Custom Controls plan.
- Design decision: actor attribution defaults. CLI no longer forces names on every command, avoids premature auth concepts, preserves audit rigor, and aligns with event-sourced best practices.
