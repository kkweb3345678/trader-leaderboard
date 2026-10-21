from datetime import timedelta
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import plan
import publish
import validate
from test_validate import BASELINE, NOW, FAKE_KEY, collector, api_rows


class PlanTests(unittest.TestCase):
    def test_handoff_blocks_both_manual_publish_and_schedules(self):
        for event, body in [("schedule", {"schedule": cron}) for cron in plan.SCHEDULES] + [
                ("workflow_dispatch", {"inputs": {"mode": "publish", "batch": "full"}})]:
            with self.subTest(event=event), self.assertRaises(ValueError):
                plan.plan(event, body, False)

    def test_utc_cron_mapping_uses_declared_schedule_not_current_clock(self):
        self.assertEqual(plan.plan("schedule", {"schedule": "0 0 * * *"}, True), {"batch": "full", "publish": "true"})
        self.assertEqual(plan.plan("schedule", {"schedule": "0 6,12,18 * * *"}, True)["batch"], "flash")
        with self.assertRaises(KeyError):
            plan.plan("schedule", {"schedule": "*/30 * * * *"}, True)

    def test_validation_is_read_only_even_after_activation_and_all_cannot_publish(self):
        self.assertEqual(plan.plan("workflow_dispatch", {"inputs": {"batch": "all"}}, True)["publish"], "false")
        with self.assertRaises(ValueError):
            plan.plan("workflow_dispatch", {"inputs": {"batch": "all", "mode": "publish"}}, True)


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="leaderboard-publish-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.remote = self.root / "remote.git"
        self.repo = self.root / "repo"
        self.repo.mkdir()
        publish.git(self.root, "init", "--bare", "--initial-branch=main", str(self.remote))
        publish.git(self.repo, "init", "--initial-branch=main")
        for name in validate.TARGETS.values():
            (self.repo / name).write_text(json.dumps({"updated_at": BASELINE}), encoding="utf-8")
        (self.repo / "fetch.py").write_text("# fixture", encoding="utf-8")
        (self.repo / "wallets.json").write_text("reviewed wallets", encoding="utf-8")
        publish.git(self.repo, "add", ".")
        publish.git(self.repo, "commit", "-m", "baseline")
        publish.git(self.repo, "remote", "add", "origin", str(self.remote))
        publish.git(self.repo, "push", "origin", "HEAD:main")
        self.other = self.root / "other"
        publish.git(self.root, "clone", str(self.remote), str(self.other))
        self.directory = self.root / "artifact"

    def candidate(self, batch="full", publication=True, source=None):
        report = validate.run(self.repo, self.directory, source or collector(), FAKE_KEY, lambda: NOW, batch, publication)
        self.assertEqual(report["status"], "passed")
        return report

    def remote_change(self, name, text):
        (self.other / name).write_text(text, encoding="utf-8")
        publish.git(self.other, "add", "--", name)
        publish.git(self.other, "commit", "-m", "competing update")
        publish.git(self.other, "push", "origin", "HEAD:main")

    def test_full_publication_preserves_other_data_and_unrelated_remote_commits(self):
        self.candidate()
        flash = (self.repo / "today-flash.json").read_bytes()
        self.remote_change("HANDOFF.md", "Ren's update")
        result = publish.publish(self.repo, self.directory, "full", NOW)
        self.assertEqual(result["status"], "published")
        self.assertEqual((self.repo / "HANDOFF.md").read_text(), "Ren's update")
        self.assertEqual((self.repo / "today-flash.json").read_bytes(), flash)
        self.assertEqual((self.repo / "wallets.json").read_text(), "reviewed wallets")
        self.assertEqual(publish.git(self.repo, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"), "data.json")
        self.assertEqual(publish.publish(self.repo, self.directory, "full", NOW)["status"], "already_published")

    def test_flash_publishes_only_flash_file(self):
        full = (self.repo / "data.json").read_bytes()
        self.candidate("flash")
        publish.publish(self.repo, self.directory, "flash", NOW)
        self.assertEqual((self.repo / "data.json").read_bytes(), full)
        self.assertEqual(publish.git(self.repo, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"), "today-flash.json")

    def test_partial_base_sample_publishes_with_complete_solana_boards(self):
        source = collector()
        source.fetch_top.side_effect = [api_rows(13, "base"), api_rows(100), api_rows(100)]
        self.candidate(source=source)
        flash = (self.repo / "today-flash.json").read_bytes()
        result = publish.publish(self.repo, self.directory, "full", NOW)
        self.assertEqual(result["status"], "published")
        data = json.loads(publish.git(self.remote, "show", "main:data.json"))
        self.assertEqual([len(data[k]) for k in ("base_today", "today", "week")], [13, 100, 100])
        self.assertEqual((self.repo / "today-flash.json").read_bytes(), flash)

    def test_publication_rechecks_sample_bounds_and_does_not_relax_solana(self):
        self.candidate()
        original = json.loads((self.directory / "data.json").read_text(encoding="utf-8"))
        report = json.loads((self.directory / "validation.json").read_text(encoding="utf-8"))
        for field, rows in (("base_today", []), ("base_today", original["base_today"] + [original["base_today"][0]]),
                            ("today", original["today"][:99]), ("week", original["week"][:99])):
            with self.subTest(field=field, count=len(rows)):
                raw = json.dumps({**original, field: rows}).encode()
                (self.directory / "data.json").write_bytes(raw)
                report["candidate_sha256"] = validate.sha256(raw)
                (self.directory / "validation.json").write_text(json.dumps(report), encoding="utf-8")
                with self.assertRaises(validate.ValidationError):
                    publish.check_candidate(self.directory, "full", NOW)

    def test_changed_remote_target_is_never_overwritten(self):
        self.candidate()
        self.remote_change("data.json", '{"updated_at":"2026-10-15T14:01:00+08:00"}')
        with self.assertRaisesRegex(validate.ValidationError, "Remote target changed"):
            publish.publish(self.repo, self.directory, "full", NOW)
        self.assertEqual(publish.git(self.remote, "show", "main:data.json"), '{"updated_at":"2026-10-15T14:01:00+08:00"}')

    def test_push_race_with_unrelated_commit_is_rebased_and_retried(self):
        self.candidate()
        original = publish.git
        raced = False
        def git(repo, *args, **kwargs):
            nonlocal raced
            if args[0] == "push" and repo == self.repo and not raced:
                raced = True
                self.remote_change("wallets.json", "new reviewed wallets")
            return original(repo, *args, **kwargs)
        with patch.object(publish, "git", side_effect=git), patch.object(publish.time, "sleep"):
            self.assertEqual(publish.publish(self.repo, self.directory, "full", NOW)["status"], "published")
        self.assertEqual((self.repo / "wallets.json").read_text(), "new reviewed wallets")

    def test_push_race_with_data_update_stops_without_overwrite(self):
        self.candidate()
        original = publish.git
        raced = False
        def git(repo, *args, **kwargs):
            nonlocal raced
            if args[0] == "push" and repo == self.repo and not raced:
                raced = True
                self.remote_change("data.json", '{"updated_at":"2026-10-15T14:01:00+08:00"}')
            return original(repo, *args, **kwargs)
        with patch.object(publish, "git", side_effect=git), patch.object(publish.time, "sleep"):
            with self.assertRaisesRegex(validate.ValidationError, "Concurrent target update"):
                publish.publish(self.repo, self.directory, "full", NOW)
        self.assertIn("14:01:00", original(self.remote, "show", "main:data.json"))

    def test_validation_artifact_is_never_publishable(self):
        self.candidate(publication=False)
        with self.assertRaisesRegex(validate.ValidationError, "does not authorize"):
            publish.publish(self.repo, self.directory, "full", NOW)

    def test_expired_or_tampered_candidate_is_rejected(self):
        self.candidate()
        with self.assertRaisesRegex(validate.ValidationError, "freshness"):
            publish.publish(self.repo, self.directory, "full", NOW + timedelta(minutes=31))
        with (self.directory / "data.json").open("a") as handle:
            handle.write(" ")
        with self.assertRaisesRegex(validate.ValidationError, "does not authorize"):
            publish.publish(self.repo, self.directory, "full", NOW)

    def test_dirty_index_refuses_all_writes(self):
        self.candidate()
        (self.repo / "wallets.json").write_text("unrelated edit")
        publish.git(self.repo, "add", "wallets.json")
        with self.assertRaisesRegex(validate.ValidationError, "clean checkout"):
            publish.publish(self.repo, self.directory, "full", NOW)


if __name__ == "__main__":
    unittest.main()
