"""Guard against Android Emulator Runner's POSIX-sh and multiline-script bugs."""
from pathlib import Path
import os
import re
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
CI = ROOT / '.github/workflows/ci.yml'
SCRIPT = ROOT / 'scripts/android-startup-smoke.sh'


class AndroidEmulatorSmokeTests(unittest.TestCase):
    def test_runner_invokes_a_single_explicit_bash_command(self):
        ci = CI.read_text()
        match = re.search(r'- name: Android 16 cold-start smoke test \(Bash entrypoint v2\)\n(?P<step>.*?)(?=\n      - name:|\n  automation:)', ci, flags=re.S)
        self.assertIsNotNone(match)
        step = match.group('step')
        self.assertIn('uses: reactivecircus/android-emulator-runner@v2', step)
        self.assertRegex(step, r'(?m)^          script: bash scripts/android-startup-smoke\.sh$')
        self.assertNotIn('script: |', step)
        self.assertNotIn('script: >', step)
        self.assertIn('name: android-16-startup-diagnostics', ci)

    def test_checkout_revision_preflight_is_present(self):
        ci = CI.read_text()
        self.assertIn('name: Verify emulator workflow revision', ci)
        self.assertIn('ParcelBridge workflow revision: android-16-bash-entrypoint-v2', ci)
        self.assertIn("grep -Fqx '          script: bash scripts/android-startup-smoke.sh'", ci)
        self.assertIn('bash -n scripts/android-startup-smoke.sh', ci)

    def test_script_uses_bash_safely(self):
        result = subprocess.run(['bash', '-n', str(SCRIPT)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('set -euo pipefail', SCRIPT.read_text())
        self.assertIn('app/build/outputs/apk/direct/debug/app-direct-debug.apk', SCRIPT.read_text())

    def run_mocked_smoke(self, mode):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bin_dir = root / 'bin'
            bin_dir.mkdir()
            apk = root / 'app/build/outputs/apk/direct/debug/app-direct-debug.apk'
            apk.parent.mkdir(parents=True)
            apk.write_bytes(b'fake-apk')
            fake_adb = bin_dir / 'adb'
            fake_adb.write_text('''#!/usr/bin/env bash
set -eu
case "${1:-} ${2:-} ${3:-}" in
  'shell pidof com.parcelbridge.app.direct')
    if [[ "$ADB_TEST_MODE" == 'no_process' ]]; then exit 1; fi
    echo '1234'; exit 0 ;;
  'shell dumpsys activity')
    if [[ "$ADB_TEST_MODE" == 'no_activity' ]]; then echo 'ResumedActivity other.application'; else echo 'ResumedActivity com.parcelbridge.app.direct'; fi
    exit 0 ;;
esac
if [[ "${1:-}" == 'logcat' && "${2:-}" == '-d' ]]; then
    echo 'mock Android stack trace'; exit 0
fi
exit 0
''')
            fake_adb.chmod(0o755)
            fake_sleep = bin_dir / 'sleep'
            fake_sleep.write_text('#!/usr/bin/env sh\nexit 0\n')
            fake_sleep.chmod(0o755)
            # The action uses sh -c; ensure invoking an external Bash script works.
            result = subprocess.run(
                ['sh', '-c', f'bash {SCRIPT}'],
                cwd=root,
                env={**os.environ, 'PATH': f'{bin_dir}:{os.environ["PATH"]}',
                     'GITHUB_WORKSPACE': str(root), 'ADB_TEST_MODE': mode},
                text=True, capture_output=True)
            diag = root / 'build/android-startup-smoke'
            return result, diag.exists(), (diag / 'logcat.txt').read_text() if (diag / 'logcat.txt').exists() else None

    def test_cold_start_success(self):
        result, has_diag, _ = self.run_mocked_smoke('success')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('remained running', result.stdout)
        self.assertFalse(has_diag)

    def test_cold_start_process_exit_captures_diagnostics(self):
        result, has_diag, logs = self.run_mocked_smoke('no_process')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('process died', result.stdout)
        self.assertTrue(has_diag)
        self.assertIn('mock Android stack trace', logs)

    def test_cold_start_invisible_activity_captures_diagnostics(self):
        result, has_diag, logs = self.run_mocked_smoke('no_activity')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('did not reach a visible activity', result.stdout)
        self.assertTrue(has_diag)
        self.assertIn('mock Android stack trace', logs)


if __name__ == '__main__':
    unittest.main()
