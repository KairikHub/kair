Confidential & Proprietary. Not for distribution.

# Kairik — 4‑Day Roadmap to Monday Demo

## Monday Demo Definition of Done
A 5–10 minute demo that shows Propose → Controls block → Controls approval → Approve → Run (artifact) → Rewind → Status, with auditability and append‑only history, in a single Docker‑first flow.

## Strategic Decisions (Distribution + Execution Backends)
### Distribution Philosophy
- CLI‑first distribution; the CLI is the source of truth for Contracts, Controls enforcement, Approvals, Rewinds, Audit history, and Artifacts.
- Local‑first adoption via Docker and desktop app; no cloud dependency for core functionality.
- Trust‑first posture: Kairik runs next to the code it governs.

### Desktop App Path (Tauri)
- Target packaging: **Tauri**.
- Rationale:
  - Reuse the existing UI (no rewrite).
  - Secure, small native binaries.
  - Explicit API permissions and isolation aligned with Controls.
  - No Electron bloat.
- CLI remains unchanged; Tauri wraps the UI and invokes the same core engine.
- Migration expectation: minimal UI changes, ~½ day to polish once pursued.
- Acceptance criteria:
  - User can double‑click Kairik (no Docker required).
  - Same lifecycle works: Propose → Plan → Controls → Approve → Run → Pause → Rewind → Status.
  - Contracts, artifacts, and audit logs persist locally.
  - Fully offline‑capable.
- Note:
  - Docker is acceptable for early demos (including Damien).
  - Desktop app is a distribution multiplier, not a prerequisite.

### OpenClaw Integration & Controls Mapping
- Principle:
  - Kairik is the authority/governance layer.
  - OpenClaw is an execution backend.
  - Skills are never the user‑facing mental model.
- Packaging:
  - OpenClaw is packaged as a local dependency/runtime.
  - Invoked only during `run`, under an approved Contract.
  - Output captured as Kairik Artifacts and included in audit history.
  - Rewind remains available regardless of execution backend.
- Controls ↔ Skills Mapping:
  - Controls are coarse, user‑facing grants (e.g., github:read, local:write).
  - Skills are implementation details.
  - Each Control maps internally to one or more OpenClaw skills.
  - Multiple skills may satisfy a single Control.
  - Skills are never shown by default in the UI.
- UX expectations:
  - Users approve Controls, not skills.
  - Missing Controls block approval/execution.
  - UI explains the blast radius of Controls.
  - Optional advanced view may show which skills a Control enables (future).
- Acceptance criteria:
  - A Contract can require OpenClaw‑backed Controls.
  - Missing Controls block approval/execution.
  - Approved Controls enable correct OpenClaw skills at runtime.
  - Execution produces auditable artifacts.
  - Rewind does not erase OpenClaw execution history.

#### Custom Controls (Advanced / Escape Hatch)
- Users can define a Custom Control locally (config file is fine for v0) with:
  - id (e.g., `jira:write` or `aws:s3:write`)
  - description (blast radius / what it authorizes)
  - mappings to one or more OpenClaw skills or capability selectors
- Custom Controls must be:
  - explicit
  - approval‑gated like built‑in Controls
  - shown in audit history, status output, and artifacts
- UI behavior:
  - Default shows curated built‑in Controls
  - “Advanced” area allows adding/editing Custom Controls
  - No raw “skills browser” in the default UX (keep the mental model Controls‑first)
- Safety:
  - Custom Controls should be namespaced (e.g., `custom:*` or user‑defined prefix) to avoid collisions
  - Changes to Custom Controls require approval and create a new Contract version (append‑only semantics preserved)
- Acceptance criteria:
  - A Custom Control can be created.
  - A Contract can require it.
  - Missing Custom Control blocks approval/execution.
  - Approved Custom Control enables corresponding OpenClaw skills at runtime.
  - Audit trail reflects the Custom Control exactly.

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
### Deliverable 3: Minimal UI (local‑first shell)
- Architecture choice: **thin UI shell over the CLI engine**.
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
1. Start UI + services: `docker compose up -d --build`
2. Run demo command (from README Damien Walkthrough).
3. Point out in output:
   - Blocked approval due to missing control.
   - Explicit control approval.
   - “Approve a Kairik Contract” line in audit log.
   - Artifact path printed under Artifacts.
   - “Rewind a Kairik Contract” line and active version change.

### Optional UI flow (if ready)
1. Start UI with `docker compose up -d --build`.
2. Create/Select Contract.
3. Show missing controls banner and resolution.
4. Show audit log with approvals and rewind.
5. Open artifact on disk (read‑only) to prove durability.
