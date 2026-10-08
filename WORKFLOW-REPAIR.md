# GitHub Actions workflow reference repair (9 October 2026)

## Problem

GitHub rejected `.github/workflows/ci.yml` before starting any jobs:

> `.github/workflows/ci.yml#L152` -> `./.github/workflows/deploy-api.yml`: failed to fetch workflow: workflow was not found.

The previous Actions overlay shipped `ci.yml` but omitted the two pre-existing reusable workflow targets, `deploy-api.yml` and `play.yml`. If those files were missing, nested incorrectly, or uncommitted on the branch, GitHub could not validate the workflow. A same-repository reference must resolve in **the same commit** as its caller.

## Repair

- The `deploy` job in `ci.yml` now runs its Cloudflare API deployment steps directly, after the automation gate passes. It still checks Cloudflare/Turso credentials and migrates/tests before deploying.
- The optional Play upload job in `release.yml` also runs its steps directly rather than calling `play.yml`.
- Manual Cloudflare deployment (`deploy-api.yml`) and manual Play upload (`play.yml`) remain available as independent workflows; both files are included in the repair patch.
- `scripts/validate-workflow-references.py` checks that any future local reusable workflow references point to committed-looking files declaring `workflow_call`. It runs in the existing Python unittest job through `test_workflow_references.py`.
- No Kotlin, Android, Worker implementation, versionCode or versionName changes were made.

## Applying the repair

**Option A (full source):** replace your working source tree using `ParcelBridge-0.2.1-actions-reference-fixed-full.zip`; carry forward any newer changes or private credentials before committing.

**Option B (smaller patch):** extract `ParcelBridge-0.2.1-actions-reference-fixed-patch.zip` into the **repository root** (the folder containing `settings.gradle.kts`). The patch contains `.github/workflows/` directly, **not** an extra `ParcelBridge-main` directory. Commit all the extracted files to your repository's `main` branch, including hidden `.github` files.

The repair will not change a previously failed GitHub workflow run; after the commit is pushed, check the **new** `Test and build` run. Since only CI and support scripts changed, normal auto-release and API-deploy gates should not create an app or Worker release solely for this patch.

## Local verification

- YAML parsed for all five workflow files.
- Bash syntax checked for 34 workflow `run:` blocks.
- No local reusable-workflow references remain in `ci.yml` or `release.yml`.
- Python/Node regression tests pass locally. Live GitHub acceptance and deploy/release are not verifiable offline.
