"""Publish one validated candidate; never collect, force-push, or overwrite a competing update."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import time

from validate import BATCHES, TARGETS, ValidationError, numeric, parse_time, sha256, validate_board

IDENTITY = ["-c", "user.name=github-actions[bot]", "-c",
            "user.email=41898282+github-actions[bot]@users.noreply.github.com"]


def git(repo, *args, binary=False):
    result = subprocess.run(["git", *IDENTITY, *args], cwd=repo, capture_output=True, check=True)
    return result.stdout if binary else result.stdout.decode("utf-8").strip()


def check_candidate(directory, batch, now):
    target = TARGETS[batch]
    report = json.loads((directory / "validation.json").read_text(encoding="utf-8"))
    raw = (directory / target).read_bytes()
    baseline = (directory / "baseline-data.json").read_bytes()
    if (report.get("status") != "passed" or report.get("mode") != "production_candidate"
            or report.get("publication_enabled") is not True or report.get("repository_data_unchanged") is not True
            or report.get("batch") != batch or report.get("target") != target
            or sha256(raw) != report.get("candidate_sha256") or sha256(baseline) != report.get("baseline_sha256")):
        raise ValidationError("Candidate evidence does not authorize publication")
    data = json.loads(raw)
    stamp = parse_time(data.get("updated_at"))
    age = (now - stamp).total_seconds()
    if (data.get("source") != "Birdeye" or data.get("chain") != "solana"
            or data["updated_at"] != report.get("candidate_updated_at") or not 0 <= age <= 1800
            or stamp <= parse_time(json.loads(baseline)["updated_at"])):
        raise ValidationError("Candidate source or freshness is invalid")
    expected_keys = {"updated_at", "source", "chain", "today"}
    if batch == "full":
        expected_keys |= {"week", "base_today", "insight"}
        if not isinstance(data.get("insight"), dict) or any(not isinstance(data["insight"].get(p), str) for p in ("today", "week")):
            raise ValidationError("Candidate insight is invalid")
    if set(data) != expected_keys:
        raise ValidationError("Unexpected candidate schema")
    for _, field, chain, count in BATCHES[batch]:
        rows = data.get(field)
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise ValidationError("Missing candidate leaderboard")
        validate_board([{"address": row.get("address"), "pnl": row.get("pnl"),
                       "realized_pnl": row.get("realized"), "volume": row.get("volume"),
                       "trade_count": row.get("trades")} for row in rows], field, count, chain)
        for row in rows:
            if not numeric(row.get("unrealized")) or abs(row["pnl"] - row["realized"] - row["unrealized"]) > 0.021:
                raise ValidationError("Candidate normalized metrics are inconsistent")
    return raw, baseline, report


def publish(repo, directory, batch, now=None):
    raw, baseline, report = check_candidate(directory, batch, now or datetime.now(timezone.utc))
    target = TARGETS[batch]
    if git(repo, "status", "--porcelain"):
        raise ValidationError("Publisher requires a clean checkout")
    git(repo, "fetch", "--no-tags", "origin", "main")
    git(repo, "merge", "--ff-only", "FETCH_HEAD")
    current = git(repo, "show", f"HEAD:{target}", binary=True)
    if current == raw:
        return {"status": "already_published", "target": target, "updated_at": report["candidate_updated_at"],
                "sha256": sha256(raw), "commit": git(repo, "rev-parse", "HEAD")}
    if current != baseline:
        raise ValidationError("Remote target changed since collection; refusing to overwrite")
    (repo / target).write_bytes(raw)
    git(repo, "add", "--", target)
    if git(repo, "diff", "--cached", "--name-only").splitlines() != [target]:
        raise ValidationError("Unexpected staged path")
    git(repo, "commit", "-m", f"Update {batch} leaderboard {report['candidate_updated_at']}", "--", target)
    for attempt in range(3):
        git(repo, "fetch", "--no-tags", "origin", "main")
        remote = git(repo, "show", f"FETCH_HEAD:{target}", binary=True)
        if remote != baseline:
            raise ValidationError("Concurrent target update detected; publication stopped")
        # Only unrelated commits can be rebased over; never force or resolve data conflicts.
        git(repo, "rebase", "FETCH_HEAD")
        try:
            git(repo, "push", "origin", "HEAD:main")
            break
        except subprocess.CalledProcessError:
            if attempt == 2:
                raise ValidationError("Push failed after bounded retries") from None
            time.sleep(3 * (attempt + 1))
    git(repo, "fetch", "--no-tags", "origin", "main")
    if git(repo, "show", f"FETCH_HEAD:{target}", binary=True) != raw:
        raise ValidationError("Published remote data does not match the candidate")
    return {"status": "published", "target": target, "updated_at": report["candidate_updated_at"],
            "sha256": sha256(raw), "commit": git(repo, "rev-parse", "HEAD")}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-dir", type=Path, required=True)
    parser.add_argument("--batch", choices=tuple(TARGETS), required=True)
    args = parser.parse_args()
    try:
        if (os.environ.get("LEADERBOARD_PUBLICATION_ENABLED") != "true"
                or os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("GITHUB_REF") != "refs/heads/main"):
            raise ValidationError("Production is disabled; await Ren's VM shutdown confirmation")
        result = publish(Path(__file__).resolve().parents[1], args.artifact_dir / args.batch, args.batch)
        (args.artifact_dir / "publication.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result))
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
                summary.write(f"## Publication\n\n{result['status']}: `{result['target']}` · `{result['updated_at']}` · `{result['commit']}`\n")
    except Exception as error:
        print(str(error) if isinstance(error, ValidationError) else "Publication failed: " + type(error).__name__, file=sys.stderr)
        sys.exit(1)
