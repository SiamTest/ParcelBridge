import base64
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]


def workflow_script(name):
    workflow = (ROOT / '.github/workflows/release.yml').read_text()
    step = workflow.split(f'      - name: {name}\n', 1)[1].split('\n      - ', 1)[0]
    lines = []
    for line in step.split('        run: |\n', 1)[1].splitlines(keepends=True):
        if line.strip() and not line.startswith('          '):
            break
        lines.append(line)
    return textwrap.dedent(''.join(lines))


def run_step(script, directory, config):
    env = dict(os.environ, RUNNER_TEMP=str(directory),
               GITHUB_ENV=str(directory / 'env'), GITHUB_OUTPUT=str(directory / 'output'),
               GITHUB_STEP_SUMMARY=str(directory / 'summary'))
    env.pop('ANDROID_KEYSTORE_PATH', None)
    env.update(config)
    return subprocess.run(['bash', '-e', '-c', script], cwd=directory, env=env,
                          capture_output=True, text=True)


class ReleaseConfigurationTests(unittest.TestCase):
    def test_signing_is_optional_and_complete_config_restores_key(self):
        script = workflow_script('Validate release configuration and restore signing key')
        config = dict(API_BASE_URL='https://example.workers.dev',
                      KEYSTORE_BASE64=base64.b64encode(b'test signing key').decode(),
                      ANDROID_KEYSTORE_PASSWORD='private-test-password',
                      ANDROID_KEY_ALIAS='private-test-alias',
                      ANDROID_KEY_PASSWORD='private-test-key-password')
        signing = [key for key in config if key != 'API_BASE_URL']
        cases = [[], ['API_BASE_URL'], signing, *([key] for key in signing)]
        for omitted in cases:
            with self.subTest(omitted=omitted), tempfile.TemporaryDirectory() as directory:
                directory = Path(directory)
                values = dict(config, **{key: '' for key in omitted})
                result = run_step(script, directory, values)
                key = directory / 'release.jks'
                for value in config.values():
                    self.assertNotIn(value, result.stdout + result.stderr)
                if 'API_BASE_URL' in omitted:
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('Missing API_BASE_URL', result.stdout)
                    self.assertFalse(key.exists())
                else:
                    self.assertEqual(result.returncode, 0, result.stderr)
                    signed = str(not omitted).lower()
                    self.assertIn(f'signed={signed}', (directory / 'output').read_text())
                    self.assertIn(f'RELEASE_SIGNED={signed}', (directory / 'env').read_text())
                    if omitted:
                        self.assertFalse(key.exists())
                        self.assertIn('test prerelease', (directory / 'summary').read_text())
                    else:
                        self.assertEqual(key.read_bytes(), b'test signing key')
                        self.assertIn(f'ANDROID_KEYSTORE_PATH={key}', (directory / 'env').read_text())

    def test_configured_but_invalid_base64_still_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            result = run_step(workflow_script('Validate release configuration and restore signing key'),
                              Path(directory), dict(API_BASE_URL='https://example.workers.dev',
                              KEYSTORE_BASE64='invalid!', ANDROID_KEYSTORE_PASSWORD='test',
                              ANDROID_KEY_ALIAS='test', ANDROID_KEY_PASSWORD='test'))
            self.assertNotEqual(result.returncode, 0)

    def test_release_assets_and_publication_in_both_modes(self):
        for signed in ('true', 'false'):
            with self.subTest(signed=signed), tempfile.TemporaryDirectory() as directory:
                directory = Path(directory)
                (directory / 'scripts').mkdir()
                shutil.copy(ROOT / 'scripts/release-manifest.mjs', directory / 'scripts')
                apk = 'release/app-direct-release.apk' if signed == 'true' else 'debug/app-direct-debug.apk'
                source = directory / f'app/build/outputs/apk/direct/{apk}'
                source.parent.mkdir(parents=True)
                source.write_bytes(b'test APK')
                if signed == 'true':
                    bundle = directory / 'app/build/outputs/bundle/playRelease/app-play-release.aab'
                    bundle.parent.mkdir(parents=True)
                    bundle.write_bytes(b'test AAB')
                env = dict(RELEASE_SIGNED=signed, GITHUB_REPOSITORY='SiamTest/ParcelBridge',
                           RELEASE_TAG='v0.1.1002', APP_VERSION_CODE='1002', GITHUB_SHA='a' * 40,
                           RELEASE_SOURCE_SHA='b' * 40,
                           PRERELEASE=str(signed == 'false').lower())
                result = run_step(workflow_script('Prepare release assets'), directory, env)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual((directory / 'release/parcelbridge.apk').read_bytes(), b'test APK')
                self.assertEqual((directory / 'release/parcelbridge-play.aab').exists(), signed == 'true')
                manifest = json.loads((directory / 'release/update.json').read_text())
                self.assertEqual(manifest['versionCode'], 1002)
                # Record CLI calls without contacting GitHub or publishing anything.
                gh = directory / 'gh'
                gh.write_text('#!/usr/bin/env python3\nimport json, sys\n'
                              'with open("gh-calls.jsonl", "a") as f:\n'
                              '    f.write(json.dumps(sys.argv[1:]) + "\\n")\n')
                gh.chmod(0o700)
                env['PATH'] = f'{directory}{os.pathsep}{os.environ["PATH"]}'
                result = run_step(workflow_script('Publish GitHub APK release'), directory, env)
                self.assertEqual(result.returncode, 0, result.stderr)
                create, edit = [json.loads(line) for line in (directory / 'gh-calls.jsonl').read_text().splitlines()]
                self.assertIn('--draft', create)
                self.assertIn('--generate-notes', create)
                self.assertEqual(create[create.index('--target') + 1], env['RELEASE_SOURCE_SHA'])
                self.assertIn('release/parcelbridge.apk', create)
                self.assertEqual('release/parcelbridge-play.aab' in create, signed == 'true')
                if signed == 'false':
                    self.assertIn('--prerelease', edit)
                    self.assertIn('--latest=false', edit)
                    self.assertIn('test APK', create[create.index('--title') + 1])
                else:
                    self.assertIn('--latest', edit)

    def test_play_upload_requires_release_signing(self):
        for signed, upload, flag, credentials, expected in (
                ('false', 'true', '', 'test-account', False),
                ('true', 'true', '', 'test-account', True),
                ('true', 'true', 'false', 'test-account', False),
                ('true', 'false', '', 'test-account', False),
                ('true', 'true', '', '', False)):
            with self.subTest(signed=signed, upload=upload, flag=flag), tempfile.TemporaryDirectory() as directory:
                directory = Path(directory)
                result = run_step(workflow_script('Check optional Play draft configuration'), directory,
                                  dict(RELEASE_SIGNED=signed, UPLOAD_PLAY_REQUESTED=upload,
                                       AUTO_UPLOAD_PLAY=flag, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=credentials))
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f'enabled={str(expected).lower()}', (directory / 'output').read_text())

    def test_automatic_release_uses_tested_sha_and_respects_configuration(self):
        cases = [('workflow_run', 'a', '', 'https://example.workers.dev', True),
                 ('workflow_run', 'b', '', 'https://example.workers.dev', False),
                 ('workflow_run', 'a', 'false', 'https://example.workers.dev', False),
                 ('workflow_run', 'a', '', '', False),
                 ('workflow_dispatch', 'b', 'false', '', True),
                 ('push', 'b', 'false', '', True)]
        for event, current, flag, api, expected in cases:
            with self.subTest(event=event, current=current, flag=flag, api=api), tempfile.TemporaryDirectory() as directory:
                directory = Path(directory)
                (directory / 'scripts').mkdir()
                shutil.copy(ROOT / 'scripts/automation-plan.py', directory / 'scripts')
                gh = directory / 'gh'
                gh.write_text('#!/bin/sh\nprintf "%s\\n" "$MOCK_CURRENT_MAIN_SHA"\n')
                gh.chmod(0o700)
                result = run_step(workflow_script('Check automatic release configuration'), directory,
                                  dict(GITHUB_EVENT_NAME=event, GITHUB_SHA='c' * 40,
                                       RELEASE_SOURCE_SHA='a' * 40,
                                       GITHUB_REPOSITORY='SiamTest/ParcelBridge',
                                       MOCK_CURRENT_MAIN_SHA=current * 40, AUTO_RELEASE=flag,
                                       API_BASE_URL=api, PATH=f'{directory}{os.pathsep}{os.environ["PATH"]}'))
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f'release={str(expected).lower()}', (directory / 'output').read_text())


if __name__ == '__main__':
    unittest.main()
