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

    def test_missing_signer_releases_test_apk_and_skips_play(self):
        signing = [key for key in self.configured() if key.startswith('ANDROID_')]
        for key in signing:
            env = self.configured()
            del env[key]
            result, summary = plan(env)
            self.assertEqual(result, dict(deploy=True, release=True, play=False))
            self.assertIn('test APK prerelease', summary)
            self.assertIn(key, summary)
            self.assertNotIn('sensitive-test-value', summary)

    def test_no_signing_secrets_still_releases_test_apk(self):
        env = {key: value for key, value in self.configured().items() if not key.startswith('ANDROID_')}
        self.assertEqual(plan(env)[0], dict(deploy=True, release=True, play=False))

    def test_api_url_remains_required(self):
        env = self.configured()
        del env['API_BASE_URL']
        result, summary = plan(env)
        self.assertEqual(result, dict(deploy=True, release=False, play=False))
        self.assertIn('API_BASE_URL', summary)

    def test_stale_commit_cannot_deploy_or_publish(self):
        env = self.configured()
        env["CURRENT_MAIN_SHA"] = "b" * 40
        result, _ = plan(env)
        self.assertFalse(any(result.values()))

    def test_workflow_run_uses_tested_source_instead_of_default_branch_sha(self):
        env = self.configured()
        env['GITHUB_SHA'] = 'b' * 40
        env['RELEASE_SOURCE_SHA'] = 'a' * 40
        self.assertTrue(plan(env)[0]['release'])
        env['RELEASE_SOURCE_SHA'] = 'c' * 40
        self.assertFalse(plan(env)[0]['release'])

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


# New workflow-only versioning and deployment gates.
class ChangedSourcePlanTests(unittest.TestCase):
    def configured(self):
        env = {key: 'configured' for key in (
            'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN',
            'ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS',
            'ANDROID_KEY_PASSWORD', 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')}
        env.update(GITHUB_SHA='a' * 40, CURRENT_MAIN_SHA='a' * 40,
                   API_BASE_URL='https://example.workers.dev')
        return env

    def test_workflow_only_change_does_not_deploy_or_publish(self):
        env = self.configured()
        env.update(API_CONTENT_CHANGED='false', RELEASE_CONTENT_CHANGED='false')
        result, summary = plan(env)
        self.assertEqual(result, dict(deploy=False, release=False, play=False))
        self.assertIn('no relevant code changes', summary)

    def test_api_only_source_change_deploys_without_android_release(self):
        env = self.configured()
        env.update(API_CONTENT_CHANGED='true', RELEASE_CONTENT_CHANGED='false')
        self.assertEqual(plan(env)[0], dict(deploy=True, release=False, play=False))

    def test_android_only_source_change_releases_without_api_deploy(self):
        env = self.configured()
        env.update(API_CONTENT_CHANGED='false', RELEASE_CONTENT_CHANGED='true')
        self.assertEqual(plan(env)[0], dict(deploy=False, release=True, play=True))

if __name__ == "__main__":
    unittest.main()
