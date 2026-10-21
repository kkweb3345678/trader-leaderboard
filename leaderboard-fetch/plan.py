"""Resolve the declared cron, never the delayed runner's wall-clock hour."""
import json
import os
from pathlib import Path
import re

SCHEDULES = {"0 0 * * *": "full", "0 6,12,18 * * *": "flash"}


def candidate_name(run_id, attempt):
    """Keep retries distinct; publish receives the producing job's exact name."""
    if any(not isinstance(value, str) or not re.fullmatch(r"[1-9][0-9]*", value)
           for value in (run_id, attempt)):
        raise ValueError("A positive GitHub run ID and attempt are required")
    return f"leaderboard-candidates-{run_id}-{attempt}"


def plan(event_name, event, enabled=False):
    if event_name == "schedule":
        batch = SCHEDULES[event["schedule"]]
        mode = "publish"
    elif event_name == "workflow_dispatch":
        batch = event.get("inputs", {}).get("batch", "flash")
        mode = event.get("inputs", {}).get("mode", "validate")
    else:
        raise ValueError("Only workflow_dispatch and the approved schedule are allowed")
    if batch not in ("full", "flash", "all") or mode not in ("validate", "publish"):
        raise ValueError("Invalid batch or mode")
    if mode == "publish" and (not enabled or batch == "all"):
        raise ValueError("Publication disabled until Ren confirms VM shutdown; all is validation-only")
    return {"batch": batch, "publish": "true" if mode == "publish" else "false"}


if __name__ == "__main__":
    result = plan(os.environ["GITHUB_EVENT_NAME"], json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text()),
                  os.environ.get("LEADERBOARD_PUBLICATION_ENABLED") == "true")
    result["candidate_name"] = candidate_name(os.environ["GITHUB_RUN_ID"], os.environ["GITHUB_RUN_ATTEMPT"])
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write("".join(f"{key}={value}\n" for key, value in result.items()))
    print(json.dumps(result))
