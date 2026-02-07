# Kairik — Decisions & Architectural Invariants

This document records **intentional decisions** made during Kairik’s development.
It exists to preserve *why* things are the way they are, not just *what* the code does.

These decisions are considered **binding** unless explicitly superseded by a later entry.

---

## Decision 000 - Keep the Scope Achievable and Light

**Kairik is a tool-agnostic governance layer over agentic work.**
- We do not compete on raw orchestration loops (models and IDEs will commoditize that).
- We enforce accountability primitives: append-only history, explicit approvals, evidence-backed execution, and rewind-as-contract-invalidation - independent of which agent performed the work.

---

## Decision 001 — CLI Is the Source of Truth

**Status:** Active  
**Date:** 2026-02-XX  

Kairik is **CLI-first**.

- All core behavior, state transitions, and authority boundaries live in the CLI.
- Any UI (web, Tauri, desktop, etc.) is a *thin shell* over the same commands.
- No logic is allowed to exist *only* in the UI.

**Rationale:**
- Enables deterministic execution
- Keeps auditability and replay intact
- Prevents UI-driven state corruption
- Aligns with Git-like mental model

**Implication:**
- The CLI must remain composable, scriptable, and importable.
- UI code may call CLI functions, but never reimplement them.

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
- Responsibility is a first-class concept in Kairik
- Enables meaningful audits and governance
- Avoids “the system did it” ambiguity

---

## Decision 004 — Docker-First Development and Execution

**Status:** Active  
**Date:** 2026-02-XX  

Kairik assumes **Docker-first** usage.

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
- Aligns with Kairik’s accountability model

---

## Decision 006 — BYO API Keys, No Mandatory SaaS Lock-In

**Status:** Active  
**Date:** 2026-02-XX  

Kairik supports **bring-your-own API keys** for LLM providers.

- OpenAI is supported via standard API keys.
- No mandatory third-party account is required to use Kairik.
- Provider abstraction must remain thin and swappable.

**Rationale:**
- Reduces adoption friction
- Avoids premature platform commitments
- Keeps Kairik usable offline or in constrained environments

---

## Decision 007 — Refactors Must Preserve the Desktop Path

**Status:** Active  
**Date:** 2026-02-XX  

All refactors must consider a future **Tauri / macOS DMG** build.

Specifically:
- Core logic must be importable as a library
- No hard dependency on browser-only APIs
- Side effects (fs, env, network) must be isolatable

**Rationale:**
- Prevents architectural dead-ends
- Keeps CLI and desktop aligned
- Avoids expensive rewrites later

---

## How to Change a Decision

- Add a new entry with a higher number
- Explicitly state what is being superseded
- Explain *why* the change is justified

Never silently edit past decisions.
