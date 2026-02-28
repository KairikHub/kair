# Kair — Decisions & Architectural Invariants

This document records **intentional decisions** made during Kair’s development.
It exists to preserve *why* things are the way they are, not just *what* the code does.

These decisions are considered **binding** unless explicitly superseded by a later entry.

## Decision Prime - Our Prime Directive
AI scales execution faster than human trust — KAIR exists to close that gap.

---

## Decision 000 - Keep the Scope Achievable and Light

**Kair is a tool-agnostic governance layer over agentic work.**
- We do not compete on raw orchestration loops (models and IDEs will commoditize that).
- We enforce accountability primitives: append-only history, explicit approvals, evidence-backed execution, and rewind-as-contract-invalidation - independent of which agent performed the work.

---

## Decision 001 — CLI Is the Source of Truth

**Status:** Active  
**Date:** 2026-02-XX  

Kair is **CLI-first**.

- All core behavior, state transitions, and authority boundaries live in the CLI.
- This repository contains no bundled UI surface.
- Any future UI must live in a separate repository/package and call into CLI/runtime boundaries.

**Rationale:**
- Enables deterministic execution
- Keeps auditability and replay intact
- Prevents interface-driven state corruption
- Aligns with Git-like mental model

**Implication:**
- The CLI must remain composable, scriptable, and importable.
- External interfaces may call CLI/runtime functions, but never reimplement governance semantics.

---

## Decision 002 — Append-Only History, No Destructive Mutations

**Status:** Active  
**Date:** 2026-02-XX  

All contract history is **append-only**.

- Approvals, rewinds, and executions never delete prior state.
- “Rewind” means *supersession*, not erasure.
- There is always a full audit trail of who did what and why.

**Rationale:**
- Accountability > convenience
- Enables post-hoc reasoning
- Prevents silent authority drift

---

## Decision 003 — Explicit Actors and Authority

**Status:** Active  
**Date:** 2026-02-XX  

Any action that changes responsibility or authority may be attributed to an **actor**.

- Actors may be human, system, or delegated agent.
- Actor attribution is explicit, never inferred.
- Default actor behavior must be conservative.

**Rationale:**
- Responsibility is a first-class concept in Kair
- Enables meaningful audits and governance
- Avoids “the system did it” ambiguity

---

## Decision 004 — Docker-First Development and Execution

**Status:** Active  
**Date:** 2026-02-XX  

Kair assumes **Docker-first** usage.

- Local machines are not expected to have Node, pnpm, or build tools installed.
- All builds must be reproducible inside containers.
- Desktop packaging (e.g., macOS DMG) must embed or bundle runtime dependencies.

**Rationale:**
- Eliminates environment drift
- Matches eventual desktop packaging constraints
- Reduces onboarding friction

---

## Decision 005 — LLMs Are Advisors, Not Authorities

**Status:** Active  
**Date:** 2026-02-XX  

LLMs may:
- Propose plans
- Suggest changes
- Assist with reasoning

LLMs may **not**:
- Auto-approve contracts
- Execute without explicit approval
- Override human authority

**Rationale:**
- Prevents automation from erasing responsibility
- Keeps humans in the approval loop
- Aligns with Kair’s accountability model

---

## Decision 006 — BYO API Keys, No Mandatory SaaS Lock-In

**Status:** Active  
**Date:** 2026-02-XX  

Kair supports **bring-your-own API keys** for LLM providers.

- OpenAI is supported via standard API keys.
- No mandatory third-party account is required to use Kair.
- Provider abstraction must remain thin and swappable.

**Rationale:**
- Reduces adoption friction
- Avoids premature platform commitments
- Keeps Kair usable offline or in constrained environments

---

## Decision 007 — Refactors Must Preserve External Integration Path

**Status:** Active  
**Date:** 2026-02-XX  

All refactors must preserve a clean path for future external integrations.

Specifically:
- Core logic must be importable as a library
- Side effects (fs, env, network) must be isolatable

**Rationale:**
- Prevents architectural dead-ends
- Keeps CLI and external integration paths aligned
- Avoids expensive rewrites later

---

## Decision 008 — No longer Docker-First Development

**Status:** Active  
**Date:** 2026-02-27

All refactors must preserve a clean path for future external integrations.

Specifically:
- Override "Decision 004 — Docker-First Development and Execution"
- Side effects previous docker related files may cease to work. 
- Backwards compatibility is not required. 

**Rationale:**
- CLI has been bundled, and runs without installing node on the host machine. 

---

## Decision 009 — Architect Is a Resumable, Governance-Only Planning Loop

**Status:** Active  
**Date:** 2026-02-28

`kair architect` is a CLI-first, resumable multi-agent planning workflow.

Specifically:
- Architect is planning-only and governance-safe:
  - It must never auto-approve or auto-run Contracts.
- Architect persistence is contract-local under `.contracts/<contract_id>/artifacts/architect/` and must support restart/resume from saved session state.
- Agent definitions are contract-local at `.contracts/<contract_id>/agents/<agent_name>/SOUL.md`.
- Agent execution is provider-agnostic:
  - Different agents may route to different providers/models.
- Architect output must be a structured `plan.v1` plan with milestone validation before completion.
- Missing contract budget is resolved during architect flow and persisted on the Contract (default caps allowed when user input is absent).

**Rationale:**
- Preserves Kair’s authority boundaries while enabling autonomous planning assistance.
- Keeps planning artifacts auditable and resumable without introducing hidden orchestration state.
- Supports heterogeneous LLM backends without coupling governance logic to one provider.

---

## Decision 010 — Single-Project Install Scope and Neutral Plan Version

**Status:** Active  
**Date:** 2026-02-28

Kair install scope is now one project per local install, and structured plan version strings are tool-neutral.

Specifically:
- `.contracts/index.json` includes one top-level `project` field for the install.
- `kair contract` establishes/uses project name before creating contracts.
- Default contract id generation is based on shortened project name + timestamp (not intent text).
- Structured plan schema version uses `plan.v1` instead of `kair.plan.v1`.

**Rationale:**
- Aligns CLI mental model with Git-style one-repo-at-a-time workflow.
- Separates project identity from per-contract intent.
- Removes unnecessary product-name coupling from durable plan schema versioning.

---

## How to Change a Decision

- Add a new entry with a higher number
- Explicitly state what is being superseded
- Explain *why* the change is justified

Never silently edit past decisions.
