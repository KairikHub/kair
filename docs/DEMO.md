# Kair Demo

## Demo: KAIR REVIEW (Copy/Paste)

```bash
docker compose up -d --build
docker exec -it kair bash

kair propose --id demo_review "Upgrade checkout safely without breaking payments"
kair plan demo_review --interactive=false '{"version":"kair.plan.v1","title":"Checkout upgrade plan","steps":[{"id":"update-dependencies","summary":"Update dependencies and lockfile"},{"id":"validate-checkout","summary":"Run tests and validate checkout end-to-end"}]}'
kair contract request-approval demo_review
kair contract approve demo_review --actor CTO
kair contract run demo_review
kair review
kair emit demo_review
kair accept demo_review --actor CTO
kair review demo_review
```

Expected highlights:
- Evidence items > 0 (for example: `diff.patch`, `prompt.txt`, `jest-output.txt`, `summary.md`).
- Decision action lines are present in review output.
- After accept, history includes `Accepted responsibility...`.
