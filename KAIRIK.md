# Kairik

## One-sentence definition
Kairik is the human authority layer that makes powerful software execution safe, legible, and easy to steer.

## The problem
- Powerful execution tools exist, but ordinary teams cannot see or trust what is happening while work runs.
- Work is not rewindable, so a wrong turn can cost hours and confidence.
- There is no clear responsibility layer or governance (who approved what and why).
- The flow is terminal-only, with no user experience (UX) that explains progress in plain English.
- Teams lack opinions and guidance on how to phrase requests and delegate safely.
- The result is powerful but hard to explain to peers, reviewers, and leadership.

## The promise
- You can approve, pause, rewind, and resume work at any time without losing history.
- Every action has a clear owner, a reason, and a record you can show to others.
- Kairik is to OpenClaw-like execution what GitHub was to Git: a control plane (the place you see, approve, and steer work) + UX that makes powerful primitives safe, legible, and usable by non-experts.
- A random person off the street could use it and still understand what is happening.
- Work artifacts are organized and review-ready, not scattered across terminals and chat logs.
- You can explain what happened and why, in plain English, without rereading long conversations.

## First customer: Damien (Generation Tux)
Damien is the first customer because he already runs high‑value work through AI, he owns delivery quality as Director of Engineering, and he feels the trust and explanation gap most sharply. If Kairik can make Damien’s workflow rewindable, visible, and governable, it will make sense for any team that needs to ship safely.

### Damien’s current workflow
1. He starts by writing a prompt that explains a problem (e.g., upgrade Laravel 9 → 10).
2. He iteratively discusses the problem with an AI bot, adding context until an agreed solution is articulated.
3. He writes a product requirements document (PRD).
4. He uses a terminal-based “Ralph Wiggum” plugin to run the task repeatedly until done.
5. He stages the work for review/testing and publishes a PR to GitHub.

### Where it breaks down
- Not rewindable: if the run goes wrong, there is no clean way to step back.
- Terminal-only: there is no UI/UX visualization of what’s happening while it runs.
- No responsibility layer or governance: approvals and “why did it do that” clarity are missing.
- No opinions or guidance on prompts, delegation, or safe handoff between steps.
- The workflow is powerful but hard to trust and hard to explain to others.

### What Kairik changes
1. Step 1 becomes a structured intent page that captures the goal and constraints in plain English, with guardrails on risky requests.
2. Step 2 becomes a tracked conversation that produces an explicit plan, with checkpoints that Damien can approve or pause.
3. Step 3 becomes a living requirements artifact that Kairik maintains, so the PRD stays aligned with decisions and changes.
4. Step 4 moves from terminal-only runs to a visible execution view with rewind points, audit trail, and clear ownership for each action.
5. Step 5 outputs review‑ready artifacts: a change summary, test evidence, and a PR package that is easy to understand.

### What success looks like for Damien in week 1
- He can pause and approve each major step without losing momentum.
- He can rewind to a safe checkpoint after a wrong turn and continue without starting over.
- He can show a clean, human‑readable history of decisions to his team.
- He can explain “why this change happened” in under two minutes.
- He can ship a PR with clear context and testing evidence on the first try.

## One concrete scenario (narrative)
Intent → Damien writes, in plain English, that he wants to upgrade a production app from Laravel 9 to 10 while keeping sign‑up and checkout stable. Plan → Kairik turns that into a step‑by‑step plan and highlights a risky database migration. Approval → Damien pauses, reviews the risky step, and approves the plan with a note to add a rollback. Execution → The work begins, but the tests reveal a breaking change in a payment dependency; Damien rewinds to the last safe checkpoint and chooses an alternative upgrade path. Explanation → Kairik summarizes what changed, why it changed, and what was rolled back. Review → Damien sees a clean timeline, test results, and a concise change summary. PR → Kairik assembles the PR with context and evidence, ready for team review.

## What Kairik is not
Kairik is not a replacement for engineering judgment or team accountability.

## The wedge (v0 scope)
- Does: capture intent, generate a step plan, and provide pause/approve/rewind controls with a readable history.
- Does: produce a single review‑ready change summary and PR package for one repository.
- Does not: support multi‑repo programs, long‑running automations, or custom policy engines.

## Under the hood (one short paragraph)
Under the hood, execution can be delegated to an agent framework such as OpenClaw, but Kairik owns authority, history, and UX end‑to‑end.

## Tomorrow build target (choose one)
- Mock UI
- CLI flow simulator
- State machine model
Chosen: ________

## Rule
If it doesn’t increase human authority, it doesn’t ship.
