# Changelog

## 2026-02-13
- Breaking CLI command remap (no compatibility aliases):
  - `kair contract "<intent>"` now creates contracts (old `propose` behavior).
  - `kair propose [<contract_id>] [--last]` now submits planned contracts for approval (old `request-approval` behavior).
  - Removed `request-approval` command path and old create aliases.
- Contract ID safety:
  - Reserved contract id `help`; creation now fails with a clear error.
- OpenClaw packaging migration:
  - Removed `vendor/openclaw` submodule integration.
  - Switched to pinned npm dependency `openclaw@2026.2.12`.
  - Reworked Docker/compose bootstrap scripts to validate/install npm dependency instead of building vendored sources.
  - Added integration smoke coverage for OpenClaw npm resolve/import in Docker test harness.
- Test runtime hardening:
  - Added `jest-util` dev dependency to keep clean Docker installs deterministic with `ts-jest`.

## 2026-02-12
- DPC v1 implementation and integration:
  - Added strict DPC schema + validator and persistence helpers.
  - Added `renderDpcPretty` for compact human-readable DPC output.
  - Wired DPC artifacts into plan generate/refine flow with append-only evidence updates.
  - Added debug output for DPC artifact path and preview (`kair plan --debug`, suppressed in `--json` mode).
- Plan/provider reliability:
  - Provider resolution now requires explicit configuration (env/flag) for LLM planning paths.
  - Removed hardcoded OpenAI fallback behavior and aligned provider defaults to env configuration.
- CLI surface updates:
  - Default-to-last behavior expanded across lifecycle commands (request/approve/run/emit/pause/resume/rewind/status/review paths).
  - Replaced top-level `kair list` with `kair contracts`.
  - Removed legacy `--requires` propose flag and the `require-controls` command path.
- Help and docs quality:
  - Top-level help reshaped into concise git-style command index.
  - Fixed per-command `--help` output across command set.
  - Updated command/docs references to match current CLI behavior.

## 2026-02-11
- Plan UX and determinism improvements:
  - Added interactive refine loop with explicit accept/refine/cancel flow hardening.
  - Added pretty plan renderer for interactive previews.
  - Added strict `--json` non-interactive plan mode behavior.
  - Added step-id diff rendering for refine cycles.
- Provider prompt observability:
  - Added sanitized `PlanLlmRequestRecord` capture with secret redaction.
  - Persisted plan prompt request artifacts for provider calls.
  - Added `kair plan --debug` prompt/provider diagnostics.

## 2026-02-10
- Governance CLI evolution:
  - Shifted to verb-first review surfaces (`review`, `emit`, `accept`).
  - Replaced `add-control` with top-level `grant` command.
  - Removed `co-plan` command and references.
- Plan platform foundation:
  - Added strict `kair.plan.v1` schema validation.
  - Added provider registry and OpenAI provider wrapper.
  - Added top-level interactive/non-interactive planning command paths.
  - Added migration-safe `planJson` persistence model.
  - Enforced strict JSON-only provider planning responses.
- Repository/product direction:
  - Open-sourced repository surfaces and removed confidentiality notices.
  - Added DPC ideas catalog and updated docs/readme for current flow.

## 2026-02-08
- Product/CLI rename rollout:
  - Renamed repo and command surface from `kairik` to `kair` across code, docs, and tests.
  - Cleaned up duplicate files and residual naming references.

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
