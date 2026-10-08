import runpy
import unittest
from pathlib import Path

plan = runpy.run_path(str(Path(__file__).with_name('automation-plan.py')))["plan"]


class AutomationPlanTests(unittest.TestCase):
    def configured(self):
        env = {key: "sensitive-test-value" for key in (
            "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN",
            "ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD",
            "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")}
        env.update(GITHUB_SHA="a" * 40, CURRENT_MAIN_SHA="a" * 40, API_BASE_URL="https://example.workers.dev")
        return env

    def test_runs_all_configured_jobs_without_logging_values(self):
        result, summary = plan(self.configured())
        self.assertEqual(result, dict(deploy=True, release=True, play=True))
        self.assertNotIn("sensitive-test-value", summary)

    def test_missing_signer_skips_release_and_play_but_deploys(self):
        env = self.configured()
        del env["ANDROID_KEYSTORE_BASE64"]
        result, summary = plan(env)
        self.assertEqual(result, dict(deploy=True, release=False, play=False))
        self.assertIn("ANDROID_KEYSTORE_BASE64", summary)

    def test_stale_commit_cannot_deploy_or_publish(self):
        env = self.configured()
        env["CURRENT_MAIN_SHA"] = "b" * 40
        result, _ = plan(env)
        self.assertFalse(any(result.values()))

    def test_disabled_jobs_and_invalid_configuration(self):
        env = self.configured()
        env.update(AUTO_DEPLOY_API="false", AUTO_RELEASE="false")
        self.assertFalse(any(plan(env)[0].values()))
        env["AUTO_RELEASE"] = "maybe"
        with self.assertRaisesRegex(ValueError, "true or false"):
            plan(env)
        for url in ("http://example.com", "https://example.com/v1", "https://user:pass@example.com", "https://example.com?token=secret"):
            env = self.configured()
            env["API_BASE_URL"] = url
            with self.assertRaisesRegex(ValueError, "HTTPS origin"):
                plan(env)


if __name__ == "__main__":
    unittest.main()
