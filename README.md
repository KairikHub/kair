## Run via Docker

Build the image:

```bash
docker compose build
```

Run the full demo sequence in one container invocation:

```bash
docker compose run --rm kairik create "..." -- plan task_1 "..." -- request-approval task_1 -- approve task_1 Damien -- run task_1 -- status task_1
```

Args after the service name are passed directly to Kairik because the image ENTRYPOINT is `npm run kairik --`.
