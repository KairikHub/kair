Confidential & Proprietary. Not for distribution.

# Docs Index

## Core References
- Architecture: `docs/ARCHITECTURE.md`
- Roadmap: `ROADMAP.md`
- Changelog: `CHANGELOG.md`

## Glossary
- **Contract**: the unit of authority and responsibility.
- **Control**: explicit, revocable authority grant (kill switch).
- **Approval**: commit‑like acceptance of responsibility that creates a version.
- **Version**: immutable snapshot created by approval or rewind.
- **History event**: append‑only audit record of a state change or decision.
- **Artifact**: durable output written on run (e.g., execution summary).
- **Rewind**: revert‑like supersession that changes the active version without deleting history.
- **Pause**: temporary halt during execution; recorded in history with no data loss.
