# Kair Demo

## Demo: KAIR REVIEW (Copy/Paste)

```bash
docker compose --profile cli run --rm kair \
  kair contract propose --id demo_review "Upgrade checkout safely without breaking payments" \
  -- contract plan demo_review "Update deps, run tests, validate checkout end-to-end, capture evidence" \
  -- contract request-approval demo_review \
  -- contract approve demo_review --actor CTO \
  -- contract run demo_review

docker compose --profile cli run --rm kair \
  kair review
docker compose --profile cli run --rm kair \
  kair emit demo_review

docker compose --profile cli run --rm kair \
  kair accept demo_review --actor CTO

docker compose --profile cli run --rm kair \
  kair review demo_review
```

Expected highlights:
- Evidence items > 0 (for example: `diff.patch`, `prompt.txt`, `jest-output.txt`, `summary.md`).
- Decision action lines are present in review output.
- After accept, history includes `Accepted responsibility...`.
