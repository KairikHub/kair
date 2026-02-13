# Kair Demo

## Demo: KAIR REVIEW (Copy/Paste)

```bash
docker compose up -d --build
docker exec -it kair bash

export KAIR_OPENAI_API_KEY=your_key_here

kair contract --id demo_review "Upgrade checkout safely without breaking payments"
kair plan demo_review --interactive=false '{"version":"kair.plan.v1","title":"Checkout upgrade plan","steps":[{"id":"update-dependencies","summary":"Update dependencies and lockfile","details":"Bump dependencies and update lockfile deterministically."},{"id":"validate-checkout","summary":"Run tests and validate checkout end-to-end","details":"Execute test suite and smoke-check checkout flow."}]}'
kair propose
kair approve demo_review --actor CTO
kair run
kair review
kair emit
kair accept demo_review --actor CTO
kair review demo_review
```

Expected highlights:
- Run artifacts are created under `artifacts/demo_review/run/` (`run-request.json`, `run-result.json`).
- Review output includes run artifact pointers.
- Decision action lines are present in review output.
- After accept, history includes `Accepted responsibility...`.
