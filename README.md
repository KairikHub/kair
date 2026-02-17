# What Is Kair? 
AI outputs faster than humans can take responsibility for it.  Kair is here to close that gap.  

In our pipe dream roadmap, "kair" will be the "git" for ai work, and "Kairik" will be the github of AI. 

<img alt="visualize the idea of what kair is" src="https://github.com/user-attachments/assets/581800b7-27a5-44b8-b3a5-5a9698f1e3f4" />

# How? 
Kair is a CLI-first control plane for delegated cognition and AI work, built around auditable contracts and controls and evidence to let humans safely take responsibility for AI generated work.  

`kair` is the open protocol CLI. Kairik is the company that builds on it.

## Quickstart

### 1) Install (No Clone, No Host Node/npm)

```bash
curl -fsSL https://raw.githubusercontent.com/KairikHub/kair/main/install.sh | sh
```

### 2) Uninstall (Clean Remove: Runtime + Shim + Aliases)

```bash
curl -fsSL https://raw.githubusercontent.com/KairikHub/kair/main/uninstall.sh | sh
```

### 3) Quick Smoke Test

```bash
kair --help
kair contracts
```

Canonical help command is `kair --help` (not `kair help`).

## Installer Details

Installer behavior:
- downloads the current `.kair` payload
- downloads embedded Node runtime for macOS
- installs runtime JS dependencies
- installs `~/bin/kair` shim for immediate use when `~/bin` is in `PATH`
- installs persistent shell alias (`kair`) by default

Installer options:

```bash
curl -fsSL https://raw.githubusercontent.com/KairikHub/kair/main/install.sh -o /tmp/kair-install.sh
KAIR_INSTALL_ALIAS=0 sh /tmp/kair-install.sh
KAIR_INSTALL_DIR="$HOME/.kair" sh /tmp/kair-install.sh
KAIR_SHIM_DIR="$HOME/bin" sh /tmp/kair-install.sh
```

Uninstaller options:

```bash
curl -fsSL https://raw.githubusercontent.com/KairikHub/kair/main/uninstall.sh -o /tmp/kair-uninstall.sh
KAIR_INSTALL_DIR="$HOME/.kair" sh /tmp/kair-uninstall.sh
KAIR_SHIM_DIR="$HOME/bin" sh /tmp/kair-uninstall.sh
```

## Repo-Embedded Launcher (When Working Inside This Repo)

If you are working from a repo checkout:

```bash
./scripts/package-kair-runtime.sh
./scripts/verify-kair-manifest.sh
./.kair/bin/kair --help
./scripts/smoke-kair-embedded.sh
```

## Contributor Dev Paths (Requires Node/npm)

```bash
npm install -g .
npm run kair -- --help
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
./.kair/bin/kair contract "Write a hello file under artifacts"
./.kair/bin/kair plan --last --interactive=false '{"version":"kair.plan.v1","title":"Write hello evidence","steps":[{"id":"write-hello","summary":"Write hello file","details":"Create a file under artifacts/<contract_id>/run/."}]}'
./.kair/bin/kair propose --last
./.kair/bin/kair grant --last local:write --actor <name>
./.kair/bin/kair run --last --dry-run --debug
```

Manual test checklist:

1. Set env vars:
   - `KAIR_OPENAI_API_KEY=<your key>`
2. Run:
   - `./.kair/bin/kair contract "Write hello evidence"`
   - `./.kair/bin/kair plan --last --interactive=false '{"version":"kair.plan.v1","title":"Write hello evidence","steps":[{"id":"write-hello","summary":"Write hello file","details":"Create a file under artifacts/<contract_id>/run/."}]}'`
   - `./.kair/bin/kair propose --last`
   - `./.kair/bin/kair grant --last local:write --actor <name>`
   - `./.kair/bin/kair run --last --dry-run --debug`
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
