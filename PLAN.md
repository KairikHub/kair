Kair v2 Plan: Additive Git Workflow, OAuth Auth, and Approval-Artifact-Gated Run
--------------------------------------------------------------------------------

### Summary

Implement Kair v2 as an additive evolution of current CLI semantics: keep existing contract lifecycle commands available, add optional git-integrated flow, require a machine-verifiable approval artifact for kair run (except --dry-run), and add OAuth login with secure keychain token storage for OpenAI/Claude. Keep GitHub API out of Kair entirely. Preserve append-only evidence and receipts, with streaming UX for plan and run.

### Scope and Outcomes

1.  Add native non-Docker UX: document and support npm i -g / local npm usage as first-class.
2.  Add OAuth browser login command and provider selection bootstrap.
3.  Add optional git integration via explicit --with=git and --pull.
4.  Move execution gate from contract state approval to approval artifact presence/hash match.
5.  Add streaming event pipeline for plan/run human output plus append-only JSONL receipts.
6.  Keep approve/grant commands indefinitely for compatibility, but run gate is artifact-based.

### Public CLI/API Changes

1.  New command: kair login [--provider <openai|claude>]
2.  Updated command: kair contract [<intent>] [--id <contract_id>] [--with=git]
3.  Updated command: kair plan [<contract_id>] ...
4.  Updated command: kair propose [<contract_id>] [--last]
5.  Updated command: kair run [<contract_id>] [--last] [--with=git] [--pull] [--interactive] [--dry-run] [--json] [--debug]
6.  Gate file (canonical): [<plan_hash>.json](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# ".kair/approvals/<plan_hash>.json")
7.  Keep existing commands: approve, grant, review, emit, etc. with no removal.

### New Artifacts and Schemas

1.  Approval artifact schema: [<plan_hash>.json](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# ".kair/approvals/<plan_hash>.json")

`{  "version":  "kair.approval.v1",  "contract_id":  "string",  "plan_hash":  "sha256:<hex>",  "plan_ref":  "data/contracts.json#/contracts[id=<id>]/plan_v1",  "approved_by":  "string",  "approved_at":  "ISO-8601",  "source":  "manual|ci",  "notes":  "string optional"  }`

1.  Hashing rule:
    -   Canonicalize plan_v1 JSON via stable-key stringify.
    -   Hash bytes with SHA-256.
    -   Prefix with sha256:.
    -   kair run recomputes and requires exact match to filename and JSON payload.
2.  Streaming receipt (append-only): [stream.jsonl](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "artifacts/<contract_id>/run/stream.jsonl")

-   JSONL event envelope:

`{"ts":"ISO","phase":"plan|run","level":"info|warn|error","event":"step.start|step.done|file.edit|cmd.start|cmd.done|summary","message":"human-readable","data":{}}`

1.  Git receipt (append-only): [commands.jsonl](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "artifacts/<contract_id>/git/commands.jsonl")

-   One event per executed git command with args, cwd, exit code, stdout/stderr snippet.

### Command Semantics (Decision Complete)

1.  kair contract --with=git
    -   Resolve/create contract ID as today.
    -   If --with=git, verify git installed and repo initialized.
    -   Create/switch branch kair-contract/<contract_id>.
    -   No push by default.
    -   Record git command receipts.
2.  kair plan
    -   Default target: latest contract unless explicit ID.
    -   If provider not configured or not logged in:
        -   Prompt: A) OpenAI B) Claude.
        -   Trigger kair login flow.
    -   Interactive mode streams progress events.
    -   End prompt options: [c]ommit [e]dit [p]rompt again.
    -   On commit:
        -   Persist structured plan (plan_v1) and write [PLAN.md](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "PLAN.md").
        -   If git mode active/current repo available, commit on current branch.
    -   Non-interactive mode:
        -   Accept direct plan input JSON and persist without provider call.
3.  kair propose
    -   Meaning: ready to share/review.
    -   If in git repo, push current kair-contract/<id> branch to origin.
    -   No GitHub API behavior.
4.  kair run
    -   Pull behavior:
        -   If --pull, run git pull automatically.
        -   Else if git available and interactive TTY, always prompt whether to pull.
    -   Required checks:
        -   [PLAN.md](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "PLAN.md") present.
        -   [RULES.md](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "RULES.md") present (empty allowed; create-on-missing is not automatic).
        -   Approval artifact exists and hash-binds current plan unless --dry-run.
    -   Modes:
        -   default: apply changes.
        -   --interactive: patch-by-patch confirmation.
        -   --dry-run: generate patch/evidence only, no FS mutation, approval artifact not required.
    -   Stream high-signal progress events (no chain-of-thought).
    -   Emit append-only run evidence as currently plus stream receipts.
5.  kair emit

-   Keep existing behavior in this slice (no new --review mode).

### Auth and Provider Architecture

1.  Provider support in v2: openai, claude only.
2.  Add auth subsystem:
    -   [oauth.ts](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "src/core/auth/oauth.ts") for browser launch + localhost callback exchange.
    -   [keychain.ts](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "src/core/auth/keychain.ts") using keytar for secure token storage.
    -   [session.ts](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "src/core/auth/session.ts") for provider selection and token lookup.
3.  Token keys:
    -   Service: kair
    -   Accounts: provider/openai, provider/claude
4.  Runtime usage:

-   plan provider clients read token from keychain first.
-   Env var API keys remain supported as override/fallback for CI and compatibility.

### Internal Refactor Plan (by module)

1.  [execute.ts](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "src/cli/execute.ts")
    -   Add login command handler.
    -   Extend parsers for new flags: --with=git, --pull, --dry-run, --interactive run mode.
    -   Replace run gate from assertState(APPROVED) to approval artifact validator.
    -   Keep state transitions and legacy commands intact.
2.  [help.ts](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "src/cli/help.ts"), [CLI_COMMANDS.md](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "docs/CLI_COMMANDS.md"), [README.md](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "README.md")
    -   Update command docs for v2 semantics and non-Docker install path.
3.  src/core/providers/*
    -   Add Claude provider implementation.
    -   Registry includes only openai and claude in normal mode.
4.  [run.ts](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "src/core/contracts/run.ts")
    -   Add approval artifact validation and dry-run bypass.
    -   Add stream event writer hooks.
5.  src/core/git/* (new)
    -   Git capability check, branch naming, pull/push wrappers, receipt logging.
6.  src/core/approvals/* (new)
    -   Plan hash generation, artifact discovery/validation, schema parsing.
7.  src/core/streaming/* (new)
    -   Human renderer + JSONL sink.
8.  [contracts_store.ts](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "src/core/store/contracts_store.ts") and related

-   Keep schema backward compatible; add optional metadata fields only if needed.

### Migration and Compatibility

1.  No destructive migration of existing [contracts.json](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# "data/contracts.json").
2.  Existing flows continue to parse/run.
3.  approve/grant still function and write history, but do not satisfy run gate alone.
4.  If approval artifact missing:
    -   kair run fails with exact remediation path and sample artifact command.
5.  If not in git repo:

-   --with=git fails clearly.
-   Without --with=git, commands continue normally.

### Testing Plan

1.  Unit
    -   Approval hash canonicalization determinism.
    -   Approval artifact schema validation and mismatch cases.
    -   Git command wrapper receipt generation.
    -   OAuth callback validation and token persistence adapter mocks.
    -   Provider registry only openai|claude (+mock under test mode if preserved).
2.  E2E
    -   contract --with=git creates/switches kair-contract/<id>.
    -   plan without provider config triggers provider selection + login path.
    -   propose pushes branch (stub git remote command).
    -   run blocked without approval artifact.
    -   run --dry-run succeeds without approval artifact and does not mutate files.
    -   run prompt-on-pull behavior when --pull absent.
    -   Streaming output contains expected milestone lines and writes stream.jsonl.
3.  Regression

-   Existing help tests updated.
-   Existing legacy commands (approve, grant, emit) still pass.
-   Existing evidence artifact tests remain append-only.

### Acceptance Criteria

1.  A user can install/run Kair natively without Docker.
2.  First-time kair plan can complete through provider selection + OAuth login with no API key paste required.
3.  kair run refuses to execute without valid [<plan_hash>.json](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# ".kair/approvals/<plan_hash>.json") unless --dry-run.
4.  Git operations are only executed when explicitly requested (--with=git and/or --pull), and every git call is receipted.
5.  Plan/run UX streams progress in real time and stores machine-readable event logs.
6.  No GitHub API calls exist in codebase.

### Assumptions and Defaults Locked

1.  Approval artifact format/location: [<plan_hash>.json](https://file+.vscode-resource.vscode-cdn.net/Users/richard/.vscode/extensions/openai.chatgpt-0.4.74-darwin-x64/webview/# ".kair/approvals/<plan_hash>.json").
2.  Run pull default without --pull: always prompt (interactive).
3.  kair emit remains as-is in this slice.
4.  Legacy approve/grant are kept indefinitely for compatibility.
5.  Secure token storage backend: keytar.
6.  Native distribution default for v2 launch: npm package path first; Docker remains optional.