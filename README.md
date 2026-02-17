# What Is Kair? 
AI outputs faster than humans can take responsibility for it.  Kair is here to close that gap.  

In our pipe dream roadmap, "kair" will be the "git" for ai work, and "Kairik" will be the github of AI. 

<img alt="visualize the idea of what kair is" src="https://github.com/user-attachments/assets/581800b7-27a5-44b8-b3a5-5a9698f1e3f4" />

# How? 
Kair is a CLI-first control plane for delegated cognition and AI work, built around auditable contracts and controls and evidence to let humans safely take responsibility for AI generated work.  

`kair` is the open protocol CLI. Kairik is the company that builds on it.

## Quick Install (Native Dev)

```bash
npm install -g .
```

You can also run locally with:

```bash
npm run kair -- --help
```

## Repo-Embedded Launcher (Host Run Without Node/npm After Bootstrap)

Kair can run from a repo-embedded launcher at `./.kair/bin/kair`.
The launcher requires an embedded Node runtime at `.kair/runtime/node`.

Bootstrap/update the embedded payload (maintainers):

```bash
./scripts/package-kair-runtime.sh
./scripts/verify-kair-manifest.sh
```

Then run from host:

```bash
./.kair/bin/kair --help
./.kair/bin/kair contract "Embedded runtime flow"
```

Optional alias:

```bash
alias kair='./.kair/bin/kair'
```

## Optional Docker Runtime

```bash
docker compose up -d --build
```

This prepares the CLI container runtime.
Kair dependencies are installed from npm during image build.

## CLI Command Surface
The current `kair --help` command groups are:

- Start a workflow:
  - `kair login` OAuth login for `openai`/`claude`
  - `kair contract` create a new Contract in `DRAFT`
  - `kair plan` generate/refine structured `kair.plan.v1`
  - `kair propose` submit/share a planned Contract
  - `kair approve` approve a Contract version
  - `kair run` execute a Contract via native runner
- Governance and controls:
  - `kair grant`, `pause`, `resume`, `rewind`
- Review and inspection:
  - `kair review`, `accept`, `emit`, `status`, `contracts`

## Native Runner (`kair run`)
`kair run` delegates execution to the native Kair runner and always writes:

- `artifacts/<contract_id>/run/run-request.json`
- `artifacts/<contract_id>/run/run-result.json`

Auth:
- Preferred: `kair login --provider openai` or `kair login --provider claude`
- Fallback: env vars (`KAIR_OPENAI_API_KEY`, `KAIR_CLAUDE_API_KEY`)

Optional selection:

- `kair run <id> --provider <name> --model <name>`

Run prerequisites:
- `PLAN.md`
- `RULES.md` (may be empty)
- Approval artifact `.kair/approvals/<plan_hash>.json` unless `--dry-run`
- If run from a git repo, Kair prompts for `git pull` unless `--pull` is passed

Tool grants (still run-time gated):

- `local:read` enables `fs_read`
- `local:write` enables `fs_write`
- `web:fetch` enables `web_fetch`

Example flow:

```bash
kair contract "Write a hello file under artifacts"
kair plan --last --interactive=false '{"version":"kair.plan.v1","title":"Write hello evidence","steps":[{"id":"write-hello","summary":"Write hello file","details":"Create a file under artifacts/<contract_id>/run/."}]}'
kair propose --last
kair grant --last local:write --actor <name>
kair run --last --dry-run --debug
```

Manual test checklist:

1. Set env vars:
   - `KAIR_OPENAI_API_KEY=<your key>`
2. Run:
   - `kair contract "Write hello evidence"`
   - `kair plan --last --interactive=false '{"version":"kair.plan.v1","title":"Write hello evidence","steps":[{"id":"write-hello","summary":"Write hello file","details":"Create a file under artifacts/<contract_id>/run/."}]}'`
   - `kair propose --last`
   - `kair grant --last local:write --actor <name>`
   - `kair run --last --dry-run --debug`
3. Verify expected evidence files:
   - `artifacts/<contract_id>/run/run-request.json`
   - `artifacts/<contract_id>/run/run-result.json`
4. Inspect outputs:
   - Open `run-request.json` for the execution payload.
   - Open `run-result.json` for runner status, summary, logs path, and evidence paths.

<img alt="visualize how a kair workflow works" src="https://github.com/user-attachments/assets/889354fe-3725-49d9-b1c9-e57e39444286" />

## Documentation
- Command reference: `docs/CLI_COMMANDS.md`
- CLI stability expectations are documented in `docs/CLI_STABILITY.md`.
- Architecture: `docs/ARCHITECTURE.md`
- Decisions: `docs/DECISIONS.md`
- Roadmap: `docs/ROADMAP.md`
- Competition analysis: `docs/COMPETITION.md`
- Changelog: `CHANGELOG.md`
