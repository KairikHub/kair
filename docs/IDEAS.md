# Parked Ideas (DPC)
This file stores back-burner ideas in a compact format so reasoning is not lost.
It is not a roadmap, not a commitment, and not a delivery queue.
Use it to preserve decision-equivalence while intentionally deferring implementation.

DPC is a small decision record shape: assumptions, constraints, decisions, open questions, and evidence pointers. The goal is to keep intent and boundaries explicit without turning parked ideas into implied commitments.

## Idea: Plan Replay Across Executors
dpc_version: 0.1
topic: Deterministic replay of an approved plan across multiple execution engines for comparative analysis

A:  # Facts / Assumptions
  - Frontier LLM vendors almost certainly maintain internal cross-model testing harnesses.
  - Such tools are unlikely to be released publicly due to competitive, narrative, and liability risks.
  - Users lack neutral, self-hosted ways to replay the same approved plan across heterogeneous executors.
  - `kair emit` produces a stable, reviewable plan+grants artifact suitable for replay.

C:  # Constraints
  - Must remain governance-first; never add orchestration loops to core `kair`.
  - Must remain self-hosted and runner-agnostic.
  - Must never score, rank, or declare "best" models.
  - Evidence storage must never require a hosted service.

D:  # Decisions (include rejected alternatives)
  - Decision: Treat multi-executor replay as a testing/research capability, not a platform feature.
    Why: Vendors are unlikely to expose this publicly; private replay can still help users audit variance.
    Rejected:
      - Non-goal: SaaS leaderboard or benchmarking product
      - Non-goal: Vendor-facing evaluation tooling
      - Non-goal: Turning `kair` into an execution engine

Q:  # Open Questions (must be falsifiable)
  - Can outputs be normalized into a shared envelope without introducing ranking fields? (yes/no)
  - Can two executors produce comparable evidence sets from one approved plan under one schema? (yes/no)
  - Can replay be implemented without standardizing the executor toolchain? (yes/no)

E:  # Evidence Pointers (optional)
  - `docs/ARCHITECTURE.md`
  - `docs/CLI_STABILITY.md`

## Idea: Evidence Receipts Schema
dpc_version: 0.1
topic: Minimal receipt schema for emitted evidence that is stable enough for review and replay tooling

A:  # Facts / Assumptions
  - `kair emit` currently lists checklist items from `.kair/contracts/<contract_id>/artifacts/evidence/index.json`.
  - Evidence formats are explicitly experimental and may change.
  - Cross-run comparison needs a stable envelope even if payload formats differ.
  - Local artifact persistence already exists and is append-only friendly.

C:  # Constraints
  - Must remain local-file-first and self-hosted.
  - Must never require a database or hosted indexing service.
  - Must separate stable receipt envelope fields from executor-specific payloads.
  - Must never rewrite or mutate prior evidence receipts.

D:  # Decisions (include rejected alternatives)
  - Decision: Define a minimal receipt envelope with contract/version/run references plus evidence pointers.
    Why: A small stable shell enables replay, review, and diff tooling without freezing every payload schema.
    Rejected:
      - Non-goal: Canonical schema for every evidence payload type
      - Non-goal: Binary receipt bundle that requires custom readers
      - Non-goal: Centralized receipt service

Q:  # Open Questions (must be falsifiable)
  - Can a valid receipt be generated from local artifacts only, with zero network calls? (yes/no)
  - Can heterogeneous executors emit receipts that pass one shared envelope validator? (yes/no)
  - Is per-item content hashing required to detect tampering in local workflows? (yes/no)

E:  # Evidence Pointers (optional)
  - `docs/CLI_COMMANDS.md`
  - `docs/CLI_STABILITY.md`

## Idea: Runner Interface (Emit / Approve Boundary)
dpc_version: 0.1
topic: Narrow runner contract where approved governance state is input and emitted evidence is output

A:  # Facts / Assumptions
  - CLI is the source of truth for approval and authority transitions.
  - Execution-related commands are explicitly experimental.
  - native runner is treated as an execution backend, not the governance layer.
  - Multi-runner support needs a boundary that does not leak governance state mutation.

C:  # Constraints
  - Must keep approval authority inside `kair`; runners must never self-approve.
  - Must pass an immutable approved snapshot into the runner.
  - Runner outputs must be evidence/receipt artifacts, not direct contract-state edits.
  - Must never require one orchestrator SDK or hosted protocol.

D:  # Decisions (include rejected alternatives)
  - Decision: Define the boundary as "approved snapshot in, emitted evidence receipt out".
    Why: This preserves authority separation while keeping executors replaceable.
    Rejected:
      - Non-goal: Stable plugin API commitment at this stage
      - Non-goal: Runner writes directly into governance state
      - Non-goal: Runner-controlled approval lifecycle

Q:  # Open Questions (must be falsifiable)
  - Can this boundary be implemented over JSON stdin/stdout only? (yes/no)
  - Can one interface support both batch and interactive execution without semantic drift? (yes/no)
  - Can `kair` reject invalid runner outputs via schema checks only? (yes/no)

E:  # Evidence Pointers (optional)
  - `docs/ARCHITECTURE.md`
  - `docs/DECISIONS.md`

## Idea: DPC as First-Class Artifact
dpc_version: 0.1
topic: Optional DPC sidecar artifacts to preserve local decision rationale near contract evidence

A:  # Facts / Assumptions
  - Global invariants live in `docs/DECISIONS.md`.
  - Contract history is append-only, but rationale can be scattered across chats/PRs.
  - Review quality depends on readable evidence and explicit rationale.
  - Parked ideas benefit from structure even when intentionally deferred.

C:  # Constraints
  - Must never block propose/plan/approve/run paths.
  - Must remain plain text and repository-friendly.
  - Must never become a disguised roadmap or task tracker.
  - Must preserve distinction between binding decisions and parked ideas.

D:  # Decisions (include rejected alternatives)
  - Decision: Keep DPC optional and attachable as sidecar artifact or docs entry.
    Why: Optional capture preserves context without adding governance friction.
    Rejected:
      - Non-goal: Mandatory DPC gating before approval
      - Non-goal: Replacing `docs/DECISIONS.md` with per-contract notes
      - Non-goal: Auto-generated DPC with no human review

Q:  # Open Questions (must be falsifiable)
  - Does optional DPC reduce median rewind root-cause time in internal runs? (yes/no)
  - Can sidecar DPCs stay compact (<2 KB median) without losing decision-equivalence? (yes/no)
  - Can reviewers recover rejection rationale without external chat logs when DPC is present? (yes/no)

E:  # Evidence Pointers (optional)
  - `docs/DECISIONS.md`
  - `docs/CLI_COMMANDS.md`

## Idea: Scoped Invariants for Agent Outputs
dpc_version: 0.1
topic: Enforcing binding decisions and eliminations across agent outputs using scoped, typed constraints

A:  # Facts / Assumptions
  - Agent systems frequently violate prior binding decisions (e.g., reintroducing eliminated commands).
  - Keyword-based forbids are brittle and cause false positives and false negatives.
  - This problem closely mirrors classical programming-language scope and name resolution (global vs local rules).
  - Current AI orchestration tools treat rules as soft context, not hard constraints.

C:  # Constraints
  - Must not rely on keyword banning or string matching.
  - Must support multiple scopes (e.g., global, repo, contract, command, prompt).
  - Must be enforceable deterministically (reject/accept), not advisory.
  - Must not turn `kair` into an orchestration or execution engine.
  - Must remain CLI-first and local-first.

D:  # Decisions (include rejected alternatives)
  - Decision: Prefer typed schemas, enums, and structured output envelopes over word-based forbids.
    Why: Structured validation avoids synonym drift (e.g., “deprecate” vs “sunset” vs “suppress”).
    Rejected:
      - Keyword forbidding / token scanning
      - Relying on conversational memory or “please remember” instructions
      - Manual human review as the primary enforcement mechanism

Q:  # Open Questions (falsifiable)
  - Can agent outputs reliably self-report structured compliance fields without external verification?
  - What is the minimal schema that meaningfully enforces eliminations without over-constraining agents?
  - How should scoped precedence (global → local) be resolved when invariants conflict?

E:  # Evidence Pointers (optional)
  - None (conceptual insight only)

## Idea: Artifact Indexing for Large Contract Sets
dpc_version: 0.1
topic: Make artifacts discoverable at scale without introducing a database

A:  # Facts / Assumptions
  - Per-contract artifact folders are intuitive but become hard to browse with hundreds of contracts.
  - Prompt artifacts are valuable for debugging and auditability.
  - Full database adoption may be unnecessary; lightweight indexing could be enough.

C:  # Constraints
  - Must remain local-first and CLI-first.
  - Must not require a database.
  - Must preserve append-only history semantics.
  - Must support future redaction/sanitization policies.

D:  # Decisions (include rejected alternatives)
  - Decision: Keep per-contract artifact folders but add lightweight indexes.
    Why: Improves discoverability and enables "recent prompts / recent changes" queries without scanning.
    Rejected:
      - Moving artifacts into a centralized database
      - Dropping prompt artifacts to reduce file counts

Q:  # Open Questions (falsifiable)
  - What minimal fields are needed in an index to enable useful queries?
  - Should indexing be per-contract only, global only, or both?
  - What retention rules are needed as repositories grow?

E:  # Evidence Pointers (optional)
  - None
