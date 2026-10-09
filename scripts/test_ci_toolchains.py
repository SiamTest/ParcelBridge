"""Prevent API/npm cache and retired Android SDK setup regressions."""
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / '.github' / 'workflows'


class ToolchainWorkflowTests(unittest.TestCase):
    def test_all_android_jobs_use_v4_without_retired_tools_package(self):
        expected_steps = {'ci.yml': 2, 'release.yml': 1}
        for name, expected in expected_steps.items():
            data = (WORKFLOWS / name).read_text()
            with self.subTest(workflow=name):
                self.assertNotIn('android-actions/setup-android@v3', data)
                self.assertEqual(data.count('android-actions/setup-android@v4'), expected)
                for match in re.finditer(r'- uses: android-actions/setup-android@v4\n(?P<inputs>(?:        .*\n|          .*\n)+)', data):
                    inputs = match.group('inputs')
                    self.assertIn("packages: 'platform-tools platforms;android-36 build-tools;35.0.0'", inputs)
                    self.assertIn("log-accepted-android-sdk-licenses: 'false'", inputs)
                    self.assertNotRegex(inputs, r'\bpackages:\s*[\'\"]?tools(?:\s|[\'"])')

    def test_robolectric_android_16_runs_under_java_21_without_changing_bytecode_target(self):
        # Robolectric API 36 requires a Java 21 runtime. Keep actual Android 16
        # coverage; never work around this by downgrading the test's SDK.
        startup = (ROOT / "app/src/test/java/com/parcelbridge/app/MainActivityStartupTest.kt").read_text()
        self.assertIn("@Config(sdk = [36])", startup)
        self.assertIn("android16ColdLaunchReachesWelcomeInsteadOfRecovery", startup)
        expected_setups = {"ci.yml": 2, "release.yml": 1}
        for name, count in expected_setups.items():
            with self.subTest(workflow=name):
                source = (WORKFLOWS / name).read_text()
                self.assertEqual(source.count("actions/setup-java@v4"), count)
                self.assertEqual(source.count("java-version: '21'"), count)
                self.assertNotIn("java-version: '17'", source)
        app_gradle = (ROOT / "app/build.gradle.kts").read_text()
        self.assertIn('sourceCompatibility = JavaVersion.VERSION_17', app_gradle)
        self.assertIn('targetCompatibility = JavaVersion.VERSION_17', app_gradle)
        self.assertIn('kotlinOptions { jvmTarget = "17" }', app_gradle)
        self.assertIn('testImplementation("org.robolectric:robolectric:4.17")', app_gradle)

    def test_npm_cache_only_enabled_when_lockfile_exists(self):
        expected_setup_steps = {'ci.yml': 2, 'release.yml': 1, 'deploy-api.yml': 1}
        for name, expected in expected_setup_steps.items():
            data = (WORKFLOWS / name).read_text()
            with self.subTest(workflow=name):
                self.assertEqual(data.count('actions/setup-node@v4'), expected)
                self.assertEqual(data.count('id: npm-lock'), expected)
                self.assertEqual(data.count('cache: ${{ steps.npm-lock.outputs.cache }}'), expected)
                self.assertEqual(data.count('cache-dependency-path: api/package-lock.json'), expected)
                self.assertEqual(data.count('"$GITHUB_WORKSPACE/api/package-lock.json"'), expected)
                self.assertNotIn('cache: npm\n', data)

    def test_optional_npm_cache_shell_behaves_on_both_checkouts(self):
        data = (WORKFLOWS / 'ci.yml').read_text()
        found = re.search(r'      - name: Detect API lockfile for optional npm caching\n'
                          r'        id: npm-lock\n'
                          r'        shell: bash\n'
                          r'        run: \|\n'
                          r'(?P<body>(?:          .*\n)+)', data)
        self.assertIsNotNone(found)
        script = '\n'.join(line[10:] for line in found.group('body').splitlines())
        for exists in (True, False):
            with self.subTest(lockfile_present=exists), tempfile.TemporaryDirectory() as tmp:
                workspace = Path(tmp)
                output = workspace / 'output.txt'
                if exists:
                    lock = workspace / 'api/package-lock.json'
                    lock.parent.mkdir()
                    lock.write_text('{}')
                result = subprocess.run(['bash', '-e', '-c', script],
                                        env={**os.environ, 'GITHUB_WORKSPACE': str(workspace),
                                             'GITHUB_OUTPUT': str(output)},
                                        text=True, capture_output=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(output.read_text().strip(), 'cache=npm' if exists else 'cache=')
                self.assertEqual('::warning::' in result.stdout, not exists)


if __name__ == '__main__':
    unittest.main()
