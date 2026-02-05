## Run via Docker

Build the image:

```bash
docker compose build
```

Run the full demo sequence in one container invocation:

```bash
docker compose run --rm kairik create "Ship Docker-only CLI demo" -- plan task_1 "Implement Docker + compose + docs" -- request-approval task_1 -- approve task_1 "Team Lead" -- run task_1 -- status task_1
```
