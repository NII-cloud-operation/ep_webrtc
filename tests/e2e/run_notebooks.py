#!/usr/bin/env python3
"""Apply the same user-facing visibility check to each prepared Etherpad instance."""
import json
import subprocess
import uuid
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path

import papermill

root = Path(__file__).resolve().parent
repo = root.parents[1]
artifacts = root / "artifacts"
artifacts.mkdir(exist_ok=True)
environment = {
    "executed_at": datetime.now(timezone.utc).isoformat(),
    "source_revision": subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip(),
    "playwright": version("playwright"),
    "papermill": version("papermill"),
    "test_image": subprocess.check_output(
        ["docker", "image", "inspect", "ep-webrtc-e2e:local", "--format", "{{.Id}}"],
        text=True).strip(),
}
(artifacts / "environment.json").write_text(json.dumps(environment, indent=2) + "\n")

cases = [("omitted", 19001, "Absent"), ("empty", 19002, "Absent"),
         ("configured", 19003, "Visible")]
for name, port, expectation in cases:
    result_dir = artifacts / name
    result_dir.mkdir(exist_ok=True)
    print(f"Running {name}: expected {expectation}", flush=True)
    papermill.execute_notebook(
        str(root / "notebooks" / "01_Menu_Visibility.ipynb"),
        str(result_dir / "01_Menu_Visibility-result.ipynb"),
        parameters={
            "pad_url": f"http://127.0.0.1:{port}/p/e2e-{uuid.uuid4().hex}?av=false",
            "expected_visibility": expectation,
            "screenshot_path": str(result_dir / "menu.png"),
        },
        cwd=str(root / "notebooks"),
    )
