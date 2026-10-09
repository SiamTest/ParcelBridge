# Android 16 emulator workflow revision verification (9 October 2026)

## Why the old error repeats

The previous patch already changed `.github/workflows/ci.yml` to call `script: bash scripts/android-startup-smoke.sh`. The error `/usr/bin/sh -c set -euo pipefail` cannot be produced by that corrected action input. It indicates that an old workflow revision was executed, e.g. an old failed run was re-run, the patch was uploaded into a nested directory, or the `main` branch does not yet contain the updated workflow.

## New revision marker

The Android 16 job now includes a step called `Verify emulator workflow revision` before `reactivecircus/android-emulator-runner@v2`. It checks the exact YAML entrypoint and the script's Bash syntax and prints:

    ParcelBridge workflow revision: android-16-bash-entrypoint-v2

The emulator step is now named `Android 16 cold-start smoke test (Bash entrypoint v2)` so you can identify that GitHub is executing the corrected workflow. If that marker never appears, you are running an older workflow file or the updated commit was not pushed to the intended branch.

## Apply correctly

1. Extract this patch at the *repository root*, so the file is located exactly at `.github/workflows/ci.yml`, not `ParcelBridge-main/.github/workflows/ci.yml` under an already existing repository root.
2. Confirm `.github/workflows/ci.yml` has `script: bash scripts/android-startup-smoke.sh` and `scripts/android-startup-smoke.sh` exists.
3. Commit and push all patched files to `main`.
4. Start a **new** workflow run for `main`, either by a new push or via Actions > Test and build > Run workflow. Do not click **Re-run jobs** on the old failed run: it uses the original commit.
5. Check the new run's SHA and look for `Verify emulator workflow revision` and the marker before the emulator action.

This is CI-only; ParcelBridge stays at version `0.2.1`. The actual Android emulator test remains unverified until GitHub Actions runs the new commit.
