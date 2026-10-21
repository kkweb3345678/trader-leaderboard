import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

import validate

NOW = datetime(2026, 10, 15, 6, 0, 0, tzinfo=timezone.utc)
BASELINE = "2026-10-15T13:30:00+08:00"
FAKE_KEY = "unit-test-only-not-a-credential"


def api_rows(count=2, chain="solana"):
    alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    return [{"address": f"0x{i:040x}" if chain == "base" else "A" * 30 + alphabet[i // 58] + alphabet[i % 58],
             "pnl": 100.12, "realized_pnl": 80.12, "volume": 1000, "trade_count": 4} for i in range(count)]


def collector():
    original = validate.load_collector()
    return Mock(TOP_N=2, MIN_CREDITS=3000, CHAIN="solana", norm=original.norm, insight=original.insight,
                credits_left=Mock(return_value=10000),
                fetch_top=Mock(side_effect=lambda _period, _key, chain, count: api_rows(count, chain)))


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="leaderboard-validation-test-")
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "repo"
        self.repo.mkdir()
        self.output = Path(self.temp.name) / "artifact"
        self.baseline = {"updated_at": BASELINE, "source": "Birdeye", "chain": "solana", "today": [], "week": []}
        self.source = self.repo / "data.json"
        self.original = json.dumps(self.baseline).encode()
        self.source.write_bytes(self.original)
        (self.repo / "today-flash.json").write_bytes(self.original)
        (self.repo / "fetch.py").write_text("# test collector", encoding="utf-8")

    def run_validation(self, source=None, key=FAKE_KEY, batch="full"):
        with patch.object(validate, "git", return_value="a" * 40):
            return validate.run(self.repo, self.output, source or collector(), key, lambda: NOW, batch=batch)

    def test_success_uses_real_normalization_and_never_changes_repository_data(self):
        report = self.run_validation()
        self.assertEqual(report["status"], "passed")
        self.assertEqual(report["candidate_updated_at"], "2026-10-15T14:00:00+08:00")
        self.assertEqual(report["row_counts"], {"today": 100, "week": 100, "base_today": 20})
        self.assertEqual(self.source.read_bytes(), self.original)
        candidate = json.loads((self.output / "data.json").read_text(encoding="utf-8"))
        original_collector = validate.load_collector()
        self.assertEqual(candidate["today"], [original_collector.norm(row) for row in api_rows(100)])
        self.assertEqual(set(candidate), {"updated_at", "source", "chain", "insight", "today", "week", "base_today"})
        self.assertEqual(candidate["today"][0]["unrealized"], 20)
        self.assertFalse(report["publication_enabled"])
        self.assertNotIn(FAKE_KEY, (self.output / "validation.json").read_text())

    def test_missing_secret_makes_no_api_request_and_fails(self):
        source = collector()
        report = self.run_validation(source, key="")
        self.assertEqual(report["status"], "failed")
        source.credits_left.assert_not_called()
        self.assertFalse((self.output / "data.json").exists())

    def test_low_credits_are_failure_not_a_false_success_with_old_data(self):
        source = collector()
        source.credits_left.return_value = 2999
        report = self.run_validation(source)
        self.assertEqual(report["status"], "failed")
        source.fetch_top.assert_not_called()
        self.assertFalse((self.output / "data.json").exists())

    def test_short_valid_response_retries_only_that_board_and_uses_complete_replacement(self):
        source = collector()
        short = api_rows(34)
        short[0]["pnl"] = 999999
        source.fetch_top.side_effect = [api_rows(20, "base"), short, api_rows(100), api_rows(100)]
        report = self.run_validation(source)
        self.assertEqual(report["status"], "passed")
        self.assertEqual([call.args[2:] for call in source.fetch_top.call_args_list],
                         [("base", 20), ("solana", 100), ("solana", 100), ("solana", 100)])
        self.assertEqual([a["received_rows"] for a in report["attempts"]], [20, 34, 100, 100])
        self.assertEqual(report["attempts"][1]["status"], "short_response")
        candidate = json.loads((self.output / "data.json").read_text(encoding="utf-8"))
        self.assertEqual(candidate["today"][0]["pnl"], 100.12)
        self.assertEqual(source.credits_left.call_count, 2)
        source.time.sleep.assert_any_call(30)
        self.assertEqual(self.source.read_bytes(), self.original)

    def test_persistent_short_response_keeps_diagnostics_and_does_not_publish(self):
        source = collector()
        source.fetch_top.side_effect = [api_rows(20, "base"), api_rows(34), api_rows(35)]
        report = self.run_validation(source)
        self.assertEqual(report["status"], "failed")
        self.assertEqual(source.fetch_top.call_count, 3)
        self.assertIn("solana today: expected 100 rows, received 35", report["failure"])
        self.assertEqual(report["credits_before"], 10000)
        self.assertEqual([a["received_rows"] for a in report["attempts"]], [20, 34, 35])
        self.assertTrue(all(a["completed_at"] for a in report["attempts"]))
        self.assertFalse((self.output / "data.json").exists())
        self.assertEqual(self.source.read_bytes(), self.original)

    def test_short_response_retry_budget_is_shared_by_the_whole_batch(self):
        source = collector()
        source.fetch_top.side_effect = [api_rows(13, "base"), api_rows(34), api_rows(100), api_rows(50)]
        report = self.run_validation(source)
        self.assertEqual(report["status"], "failed")
        self.assertEqual(source.fetch_top.call_count, 4)
        self.assertIn("solana 1W: expected 100 rows, received 50", report["failure"])
        self.assertFalse((self.output / "data.json").exists())

    def test_short_response_retry_preserves_credit_reserve(self):
        for left in (3029, None, float("nan")):
            with self.subTest(left=left):
                source = collector()
                source.credits_left.side_effect = [10000, left]
                source.fetch_top.return_value = api_rows(9)
                source.fetch_top.side_effect = None
                with self.assertRaisesRegex(validate.ValidationError, "retry credit reserve"):
                    validate.collect(source, FAKE_KEY, BASELINE, lambda: NOW, batch="flash")
                self.assertEqual(source.fetch_top.call_count, 1)

    def test_base_thirteen_rows_is_a_valid_sample_without_retry_or_padding(self):
        source = collector()
        rows = api_rows(13, "base")
        source.fetch_top.side_effect = [rows, api_rows(100), api_rows(100)]
        report = self.run_validation(source)
        self.assertEqual(report["status"], "passed")
        self.assertEqual(report["row_counts"], {"base_today": 13, "today": 100, "week": 100})
        self.assertEqual(report["attempts"][0]["status"], "partial_sample")
        self.assertEqual(report["attempts"][0]["minimum_rows"], 1)
        self.assertEqual(source.fetch_top.call_count, 3)
        source.credits_left.assert_called_once_with(FAKE_KEY)
        candidate = json.loads((self.output / "data.json").read_text(encoding="utf-8"))
        self.assertEqual(candidate["base_today"], [source.norm(row) for row in rows])
        self.assertEqual(self.source.read_bytes(), self.original)

    def test_base_empty_or_over_limit_still_stops_before_other_boards(self):
        for rows in ([], api_rows(21, "base")):
            with self.subTest(count=len(rows)):
                source = collector()
                source.fetch_top.side_effect = [rows]
                with self.assertRaises(validate.ValidationError):
                    validate.collect(source, FAKE_KEY, BASELINE, lambda: NOW)
                self.assertEqual(source.fetch_top.call_count, 1)

    def test_malformed_short_response_is_not_retried(self):
        source = collector()
        rows = api_rows(9, "base")
        rows[0]["pnl"] = None
        source.fetch_top.side_effect = [rows]
        report = self.run_validation(source)
        self.assertEqual(report["status"], "failed")
        self.assertIn("base today", report["failure"])
        self.assertIn("Missing or non-finite", report["failure"])
        self.assertEqual(source.fetch_top.call_count, 1)
        self.assertFalse((self.output / "data.json").exists())

    def test_flash_short_response_recovers_without_fetching_full_boards(self):
        source = collector()
        source.fetch_top.side_effect = [[], api_rows(20)]
        report = self.run_validation(source, batch="flash")
        self.assertEqual(report["status"], "passed")
        self.assertEqual([call.args[2:] for call in source.fetch_top.call_args_list],
                         [("solana", 20), ("solana", 20)])
        self.assertEqual(self.source.read_bytes(), self.original)

    def test_fetch_failure_preserves_context_without_exposing_secret(self):
        source = collector()
        source.fetch_top.side_effect = RuntimeError(FAKE_KEY)
        report = self.run_validation(source)
        self.assertEqual(report["status"], "failed")
        self.assertEqual(report["attempts"][0]["status"], "fetch_failed")
        self.assertEqual(report["attempts"][0]["chain"], "base")
        self.assertNotIn(FAKE_KEY, json.dumps(report))
        self.assertEqual(source.fetch_top.call_count, 1)

    def test_partial_or_failed_second_period_never_leaves_a_candidate(self):
        source = collector()
        source.fetch_top.side_effect = [api_rows(20, "base"), RuntimeError("private header " + FAKE_KEY)]
        report = self.run_validation(source)
        self.assertEqual(report["status"], "failed")
        self.assertNotIn(FAKE_KEY, json.dumps(report))
        self.assertNotIn("private header", json.dumps(report))
        self.assertFalse((self.output / "data.json").exists())
        self.assertEqual(self.source.read_bytes(), self.original)

    def test_missing_duplicate_or_nonfinite_metrics_are_rejected(self):
        mutations = [lambda rows: rows.pop(), lambda rows: rows[0].pop("realized_pnl"),
                     lambda rows: rows[0].update(pnl=None), lambda rows: rows[0].update(pnl=float("nan")),
                     lambda rows: rows[0].update(trade_count=1.5), lambda rows: rows[0].update(volume=-1),
                     lambda rows: rows[0].update(address=17), lambda rows: rows.__setitem__(1, rows[0])]
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                rows = api_rows()
                mutate(rows)
                with self.assertRaises(validate.ValidationError):
                    validate.validate_raw(rows, 2)

    def test_candidate_timestamp_must_advance(self):
        for baseline in ("2026-10-15T14:00:00+08:00", "2026-10-15T14:30:00+08:00"):
            with self.subTest(baseline=baseline), self.assertRaises(validate.ValidationError):
                validate.collect(collector(), FAKE_KEY, baseline, lambda: NOW)

    def test_output_inside_checkout_is_rejected_before_secret_use(self):
        source = collector()
        with self.assertRaises(validate.ValidationError):
            validate.run(self.repo, self.repo / "candidate", source, FAKE_KEY)
        source.credits_left.assert_not_called()
        self.assertEqual(self.source.read_bytes(), self.original)

    def test_old_artifact_cannot_be_reused_as_new_evidence(self):
        self.output.mkdir()
        (self.output / "data.json").write_text("old evidence")
        with self.assertRaises(validate.ValidationError):
            self.run_validation()
        self.assertEqual((self.output / "data.json").read_text(), "old evidence")

    def test_unit_fixtures_do_not_publish_a_real_actions_summary(self):
        summary = Path(self.temp.name) / "job-summary.md"
        summary.write_text("existing real result", encoding="utf-8")
        with patch.dict(validate.os.environ, {"GITHUB_STEP_SUMMARY": str(summary)}):
            self.run_validation()
        self.assertEqual(summary.read_text(encoding="utf-8"), "existing real result")

    def test_baseline_changed_during_fetch_fails_acceptance(self):
        source = collector()
        def fetch(_period, _key, chain, count):
            self.source.write_text("changed by another process")
            return api_rows(count, chain)
        source.fetch_top.side_effect = fetch
        report = self.run_validation(source)
        self.assertEqual(report["status"], "failed")
        self.assertFalse(report["repository_data_unchanged"])
        self.assertFalse((self.output / "data.json").exists())

    def test_checked_in_workflow_keeps_collection_read_only_and_publication_gated(self):
        workflow = (validate.REPO / ".github/workflows/leaderboard-fetch.yml").read_text()
        self.assertRegex(workflow, r"(?m)^  workflow_dispatch:")
        self.assertNotRegex(workflow, r"(?m)^\s+(push|pull_request|workflow_run):")
        collection = workflow.split("\n  publish:\n")[0]
        self.assertNotIn("contents: write", collection)
        self.assertIn("LEADERBOARD_PUBLICATION_ENABLED: 'true'", workflow)
        self.assertIn("python leaderboard-fetch/plan.py", collection)
        self.assertIn("'0 0 * * *'", workflow)
        self.assertIn("'0 6,12,18 * * *'", workflow)
        self.assertIn("if: needs.collect.outputs.publish == 'true'", workflow)
        self.assertIn("persist-credentials: false", workflow)
        self.assertIn("group: leaderboard-data-writer-main", workflow)
        self.assertIn("cancel-in-progress: false", workflow)
        self.assertLess(workflow.index("git fetch"), workflow.index("git merge --ff-only"))
        self.assertLess(workflow.index("git merge --ff-only"), workflow.index("python leaderboard-fetch/validate.py"))

    def test_workflows_keep_candidate_attempt_and_ci_cannot_publish(self):
        workflow = (validate.REPO / ".github/workflows/leaderboard-fetch.yml").read_text()
        collect, publish = workflow.split("\n  publish:\n", 1)
        self.assertIn("candidate_name: ${{ steps.plan.outputs.candidate_name }}", collect)
        self.assertIn("name: ${{ steps.plan.outputs.candidate_name }}", collect)
        self.assertIn("CANDIDATE_NAME: ${{ needs.collect.outputs.candidate_name }}", publish)
        self.assertIn('--name "$CANDIDATE_NAME"', publish)
        self.assertNotIn('--name "leaderboard-candidates-$GITHUB_RUN_ID"', publish)
        self.assertIn("name: leaderboard-publication-${{ github.run_id }}-${{ github.run_attempt }}", publish)
        checks = (validate.REPO / ".github/workflows/leaderboard-check.yml").read_text()
        for trigger in ("push", "pull_request", "workflow_dispatch"):
            self.assertRegex(checks, rf"(?m)^  {trigger}:")
        self.assertNotRegex(checks, r"(?m)^\s+(schedule|pull_request_target):")
        self.assertNotIn("secrets.", checks)
        self.assertNotRegex(checks, r"(?m)^\s+(contents|actions|pages): write")
        self.assertNotIn("python leaderboard-fetch/validate.py", checks)
        self.assertNotIn("python leaderboard-fetch/publish.py", checks)
        self.assertIn("persist-credentials: false", checks)
        self.assertIn("CANDIDATE_NAME: ${{ needs.checks.outputs.candidate_name }}", checks)
        self.assertIn('--name "$CANDIDATE_NAME"', checks)

    def test_flash_uses_only_twenty_solana_rows_and_preserves_full_data(self):
        source = collector()
        report = self.run_validation(source, batch="flash")
        self.assertEqual(report["status"], "passed")
        source.fetch_top.assert_called_once_with("today", FAKE_KEY, "solana", 20)
        data = json.loads((self.output / "today-flash.json").read_text())
        self.assertEqual(set(data), {"updated_at", "source", "chain", "today"})
        self.assertEqual(self.source.read_bytes(), self.original)

    def test_full_fetch_passes_base_header_and_rejects_unsupported_base(self):
        source = collector()
        report = self.run_validation(source)
        self.assertEqual(report["status"], "passed")
        self.assertEqual(source.fetch_top.call_args_list[0].args, ("today", FAKE_KEY, "base", 20))
        source.fetch_top.side_effect = [RuntimeError(FAKE_KEY)]
        with self.assertRaisesRegex(validate.ValidationError, "base today fetch failed: RuntimeError"):
            validate.collect(source, FAKE_KEY, BASELINE, lambda: NOW)

    def test_base_addresses_are_evm_and_case_insensitive_for_duplicates(self):
        rows = api_rows(2, "base")
        validate.validate_raw(rows, 2, "base")
        rows[0]["address"] = "0x" + "a" * 40
        rows[1]["address"] = "0x" + "A" * 40
        with self.assertRaisesRegex(validate.ValidationError, "Duplicate"):
            validate.validate_raw(rows, 2, "base")
        with self.assertRaises(validate.ValidationError):
            validate.validate_raw(api_rows(2), 2, "base")


if __name__ == "__main__":
    unittest.main()
