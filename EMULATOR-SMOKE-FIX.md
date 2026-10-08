# Android 16 emulator smoke-test repair (9 October 2026)

## Root cause

`reactivecircus/android-emulator-runner@v2` executes the `with.script` command through `/usr/bin/sh` on GitHub-hosted Ubuntu runners. Ubuntu's `/usr/bin/sh` is `dash`, which does not implement `set -o pipefail`. The earlier `ci.yml` supplied a multiline Bash script directly to `with.script`, so it failed with `set: Illegal option -o pipefail` before testing ParcelBridge. The emulator's `stop: Not implemented` cleanup output is a consequence of the failed test step, not evidence of an application error.

## Change

- `.github/workflows/ci.yml`: replace the multiline emulator `script: |` block with a single `script: bash scripts/android-startup-smoke.sh` command. Publish logs as a failure-only `android-16-startup-diagnostics` artifact.
- `scripts/android-startup-smoke.sh`: preserve strict Bash mode and existing Direct APK install, data reset, cold launch, process and activity checks. On failure, save logcat and activity information before the emulator is torn down.
- `scripts/test_android_emulator_smoke.py`: verify GitHub's `sh -c` invocation works and mocked startup success/process exit/invisible activity are handled correctly.

## Applying

Extract the patch at your GitHub repository root, replacing matching files. Commit both `.github/workflows/ci.yml` **and** the new `scripts/android-startup-smoke.sh` and `scripts/test_android_emulator_smoke.py`. Then push to `main` to start a new CI run. An older failed run cannot be repaired by re-running the old commit.

This changes only CI and validation scripts. ParcelBridge remains at version `0.2.1`. Real Android 16 emulator execution still requires GitHub Actions; local tests simulate adb responses and check script syntax.
