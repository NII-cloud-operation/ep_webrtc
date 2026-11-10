# E2E Tests

Run from the repository root with Docker Compose and Python 3.11+:

```sh
python3 -m venv /tmp/ep-webrtc-e2e
/tmp/ep-webrtc-e2e/bin/pip install -r tests/e2e/requirements.txt
/tmp/ep-webrtc-e2e/bin/python -m playwright install --with-deps chromium
docker compose -p ep-webrtc-e2e -f tests/e2e/docker-compose.yml build --pull
docker compose -p ep-webrtc-e2e -f tests/e2e/docker-compose.yml up -d --no-build --wait --wait-timeout 120
/tmp/ep-webrtc-e2e/bin/python tests/e2e/run_notebooks.py
docker compose -p ep-webrtc-e2e -f tests/e2e/docker-compose.yml down -v
```

Run the final cleanup command even if a test fails. Executed notebooks,
screenshots, and environment information are saved under `tests/e2e/artifacts/`.

In CI, download the result artifacts from the
[E2E Tests workflow](../../.github/workflows/e2e-tests.yml).
