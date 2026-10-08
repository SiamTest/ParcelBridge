import base64
import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest


class ReleaseConfigurationTests(unittest.TestCase):
    def test_release_guard_reports_missing_settings_and_restores_key(self):
        root = Path(__file__).resolve().parents[1]
        workflow = (root / '.github/workflows/release.yml').read_text()
        step = workflow.split('      - name: Validate release configuration and restore signing key\n', 1)[1].split('      - ', 1)[0]
        script = textwrap.dedent(step.split('        run: |\n', 1)[1])
        config = dict(API_BASE_URL='https://example.workers.dev',
                      KEYSTORE_BASE64=base64.b64encode(b'test signing key').decode(),
                      ANDROID_KEYSTORE_PASSWORD='private-test-password',
                      ANDROID_KEY_ALIAS='private-test-alias',
                      ANDROID_KEY_PASSWORD='private-test-key-password')
        for omitted in (*config, None):
            with self.subTest(omitted=omitted), tempfile.TemporaryDirectory() as directory:
                env = dict(os.environ, **config, RUNNER_TEMP=directory,
                           GITHUB_ENV=str(Path(directory) / 'env'))
                if omitted:
                    env[omitted] = ''
                result = subprocess.run(['bash', '-e', '-c', script], env=env,
                                        capture_output=True, text=True)
                key = Path(directory) / 'release.jks'
                if omitted:
                    self.assertNotEqual(result.returncode, 0)
                    name = 'ANDROID_KEYSTORE_BASE64' if omitted == 'KEYSTORE_BASE64' else omitted
                    self.assertIn(f'Missing {name}', result.stdout)
                    self.assertFalse(key.exists())
                    for value in config.values():
                        self.assertNotIn(value, result.stdout + result.stderr)
                else:
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(key.read_bytes(), b'test signing key')
                    self.assertIn(f'ANDROID_KEYSTORE_PATH={key}', Path(env['GITHUB_ENV']).read_text())


if __name__ == '__main__':
    unittest.main()
