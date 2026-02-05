Confidential & Proprietary. Not for distribution.

# Kairik — 4‑Day Roadmap to Monday Demo

## Monday Demo Definition of Done
A 5–10 minute demo that shows Propose → Controls block → Controls approval → Approve → Run (artifact) → Rewind → Status, with auditability and append‑only history, in a single Docker‑first flow.

## Friday (Tomorrow) — Lock the CLI Demo + Add Persistence
### Deliverable 1: Damien‑ready CLI script (single command, no surprises)
- Files likely to change:
  - `README.md`
  - `src/kairik.ts`
- Tasks:
  - Validate the Damien walkthrough command runs end‑to‑end in one invocation.
  - Ensure output uses “Propose a Kairik Contract”, “Approve a Kairik Contract”, “Rewind a Kairik Contract”.
  - Add a small help banner at `contract status` summarizing active version + controls gating outcome.
- Acceptance criteria:
  - One docker command shows blocked approval, control approval, successful approval, run artifact, rewind, and status.
- Demo value:
  - Reduces cognitive load; Damien sees the full authority chain in one pass.

### Deliverable 2: Minimal persistence layer (JSON file) for Contracts
- Files likely to change:
  - `src/kairik.ts`
  - `docs/ARCHITECTURE.md`
- Tasks:
  - Add a simple disk‑backed store: `data/contracts.json` (auto‑created).
  - Load at startup and persist after each mutation.
  - Keep append‑only history intact; do not edit history entries.
- Acceptance criteria:
  - Run `propose` in one container, then `status` in a second container and the Contract still exists.
- Demo value:
  - Makes the system feel like a control plane rather than a one‑shot script.

## Saturday — UI Skeleton (Local‑Only)
### Deliverable 3: Minimal UI (choose Next.js)
- Architecture choice: **Next.js minimal app**.
- Files likely to change:
  - `package.json`
  - `src/ui/*` (new)
  - `docs/ARCHITECTURE.md`
  - `README.md`
- Tasks:
  - Create a single screen that lists Contracts and shows a selected Contract.
  - Show key fields: intent, plan, controls required/approved, active version, audit log.
  - Provide buttons for Propose, Request Approval, Approve, Run, Rewind.
  - Wire UI to the persistence layer (no server auth, local‑only).
- Acceptance criteria:
  - UI can load persisted Contracts and display audit history after a page reload.
- Demo value:
  - Makes authority and history legible to a Director of Engineering.

### Deliverable 4: Controls Gating Visualization
- Files likely to change:
  - `src/ui/*`
- Tasks:
  - Visually surface missing controls (red badge) and show a “blocked” banner.
  - Provide “Approve Control” action that updates `controlsApproved`.
- Acceptance criteria:
  - UI clearly shows why approval is blocked and how to resolve it.
- Demo value:
  - This is the “trust moment” for Damien.

## Sunday — Demo Polish + Optional Planner Stub
### Deliverable 5: Audit‑first UI output
- Files likely to change:
  - `src/ui/*`
  - `docs/ARCHITECTURE.md`
- Tasks:
  - Add a read‑only audit log panel (append‑only view).
  - Highlight version changes (approval/rewind) with badges.
- Acceptance criteria:
  - Viewer can trace: who approved, when, and why; plus rewind reason.
- Demo value:
  - Makes governance and responsibility concrete.

### Deliverable 6 (Optional): Planner helper stub
- Files likely to change:
  - `src/ui/*`
  - `src/kairik.ts`
- Tasks:
  - Add a “Planner” box that drafts a plan + required controls (deterministic stub).
  - Require explicit approval before anything runs.
- Acceptance criteria:
  - Planner output never runs automatically; it only suggests.
- Demo value:
  - Shows future value without destabilizing the demo.

## Monday (Demo Day) — Stability + Rehearsal
### Deliverable 7: Demo hardening
- Files likely to change:
  - `README.md`
  - `docs/ROADMAP_4DAYS.md`
- Tasks:
  - Lock the exact demo commands and UI steps.
  - Add a final “Demo Checklist” in README.
  - Rehearse the 5–10 minute flow end‑to‑end.
- Acceptance criteria:
  - Zero surprises; the demo is repeatable from a clean Docker build.
- Demo value:
  - Protects the high‑stakes moment with Damien.

## Cut Line (What to drop first)
1. **LLM planner integration** — risk of API friction and scope creep; stub is enough.
2. **OpenClaw integration** — high integration risk; keep a stub that shows intent.
3. **UI actions beyond read‑only** — if time runs out, keep UI as a viewer and drive actions via CLI.
4. **Forking support** — optional; not required for Monday’s core proof.

## Risk Register (Top 5)
1. **UI scope creep**
   - Mitigation: single screen, minimal controls, focus on audit + gating.
2. **Docker environment friction**
   - Mitigation: keep demo in one docker command; verify fresh build daily.
3. **Persistence bugs**
   - Mitigation: simple JSON store, no migrations, append‑only writes.
4. **LLM integration delays**
   - Mitigation: deterministic stub with same interface; swap later.
5. **OpenClaw integration risk**
   - Mitigation: stub “execution backend” that still writes artifacts.

## Monday Runbook (5–10 Minutes)
### CLI‑only flow (primary)
1. Build: `docker compose build`
2. Run demo command (from README Damien Walkthrough).
3. Point out in output:
   - Blocked approval due to missing control.
   - Explicit control approval.
   - “Approve a Kairik Contract” line in audit log.
   - Artifact path printed under Artifacts.
   - “Rewind a Kairik Contract” line and active version change.

### Optional UI flow (if ready)
1. Start UI (`npm run ui` or equivalent).
2. Create/Select Contract.
3. Show missing controls banner and resolution.
4. Show audit log with approvals and rewind.
5. Open artifact on disk (read‑only) to prove durability.
