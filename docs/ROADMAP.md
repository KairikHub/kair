# Roadmap

## High level next steps (stretch goal)
In Progress: OpenClaw first (executor interface + OpenClaw adapter stub)

Not Started: LLM first (UI “Generate Plan” via API key)

Not Started: Tauri first (desktop PoC wrapper)


## Monday Definition of Done
A 5–10 minute demo that shows Propose → Plan → Controls block → Grant Controls → Request Approval → Approve → Run (artifact) → Rewind → Status, with auditability and append‑only history, in a single Docker‑first flow.

Pause (v0) is a temporary halt during execution that records state/history without deleting anything.

## Strategic Decisions (Distribution + Execution Backends)
### Distribution Philosophy
- CLI‑first distribution; the CLI is the source of truth for Contracts, Controls enforcement, Approvals, Rewinds, Audit history, and Artifacts.
- Local‑first adoption via Docker and desktop app; no cloud dependency for core functionality.
- Trust‑first posture: Kair runs next to the code it governs.

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
  - User can double‑click Kair (no Docker required).
  - Same lifecycle works: Propose → Plan → Controls → Request Approval → Approve → Run → Pause → Rewind → Status.
  - Contracts, artifacts, and audit logs persist locally.
  - Fully offline‑capable.
- Note:
  - Docker is acceptable for early demos (including Damien).
  - Desktop app is a distribution multiplier, not a prerequisite.

### OpenClaw Integration & Controls Mapping
- Principle:
  - Kair is the authority/governance layer.
  - OpenClaw is an execution backend.
  - Skills are never the user‑facing mental model.
- Packaging:
  - OpenClaw is packaged as a local dependency/runtime.
  - Invoked only during `run`, under an approved Contract.
  - Output captured as Kair Artifacts and included in audit history.
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

## Next (Post‑Demo)
- Audit‑first UI polish (badges for versions, clear gating states, rewind highlights).
- Demo hardening runbook and checklist.
- Custom Controls config + advanced UI editor.
- OpenClaw execution backend stub and mapping layer.
- Tauri desktop packaging proof‑of‑concept.
- Future checkpoints (post‑OpenClaw):
  - Contract‑defined review gates emitted by execution backends (OpenClaw).
  - Purpose: trust‑building pause points for human review/ack before continuing.
  - Note: today’s `--pause-at` is a demo‑only internal mechanism.
