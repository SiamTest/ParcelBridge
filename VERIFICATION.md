# Verification — Material 3 Expressive update, 8 October 2026

Current Android UI revision:

- Both `assembleDirectDebug` and `assemblePlayDebug` passed on JDK 17.0.20.1, Gradle 8.13, Android SDK 36 and build-tools 35.0.0. A clean build also passed after removing stale incremental dex outputs.
- `testDirectDebugUnitTest` and `testPlayDebugUnitTest` passed: 12 tests per variant, 24 total. Each variant includes the original three formatting tests and nine UI/motion tests.
- Robolectric 4.17 rendered real Material views using native graphics. Tested 320 dp / 200% text, 360 dp / high density, 600 dp rail navigation, 1200 dp dark mode, a 640 × 320 dp landscape window with large text, and Android API 26 compatibility. The other UI tests use API 34.
- Checks cover wrapping action text, minimum touch height, bounded tablet content, retained dropdown API values, scrolling, keyboard insets, busy-navigation selection and lightweight hero-only entrance animation. Dialog construction and visibility also passed.
- Spring physics settled to the final opacity, translation and scale, and press feedback preserved one normal click. Robolectric does not deliver the AndroidX Choreographer callbacks used here, so this test drives the real running springs with deterministic frame timestamps. It does not verify frame rate or vsync on a device.
- Light/dark phone, tablet and large-text native renders were visually reviewed. Dropdown padding and the parcel decoration were refined after review.
- `lintDirectDebug` and `lintPlayDebug` passed with zero errors. Existing platform/dependency/security guidance and style warnings remain; lint is not a full security audit.
- Fourteen Python automation tests and seventeen Node automation tests passed, 31 total, including the new 0.2 automatic release tags. These tests use mocks; no GitHub runs or releases were deleted or published.
- Existing workflow files are unchanged from the preceding automatic-release fix. Optional signing, API URL fallback, trusted successful-main release triggering and cleanup behavior are preserved.
- Default local app version is now 0.2.0 / code 2. Automatic tags use `v0.2.<versionCode>` (or `-debug`) and keep the existing monotonic version-code logic. Worker source/version is unchanged.

No physical phone or emulator testing, real signing, GitHub execution, deployment or Play upload was performed for this UI update. Live delivery behavior and real-device motion/rotation/keyboard behavior still need testing with your deployed API.

## Earlier validation history, before this UI revision

Completed locally on the source in this archive:

- TypeScript type checks: passed.
- Backend tests: 14 passed, including simultaneous job acceptance, Feni coverage, private data, delivery codes, returns and COD.
- Google Play publishing-script tests: 2 passed using mocked HTTP requests; no Play upload was performed.
- Release-manifest self-check: version, download path and SHA-256 output passed.
- Cloudflare Worker deployment dry run: passed; no cloud deployment was performed.
- Dependency audit after installing the pinned versions: zero known vulnerabilities reported.
- Android `testDirectDebugUnitTest` and `testPlayDebugUnitTest`: passed, 3 tests per variant.
- Android `lintDirectDebug` and `lintPlayDebug`: passed with no errors. Style/dependency-version warnings remain.
- Android `assembleDirectDebug` and `assemblePlayDebug`: passed on JDK 17 / Gradle 8.11.1 / SDK 36.
- XML resources, dependency lock and wrapper configuration: checked.

Automation update verified locally:

- Six Python script tests passed: four automation planning cases and two mocked Play publishing cases.
- Eleven Node script tests passed: cleanup retention and rerun protection, automatic manifest URLs, increasing release versions, paginated prereleases, immutable releases, and failed/untrusted manifest handling.
- All five GitHub workflow files passed actionlint 1.7.12; shellcheck was not available.
- Eight workflow shell blocks passed Bash syntax checks; the embedded Python block also parsed successfully. No deployment, signing or publishing commands were executed by these syntax checks.
- Cleanup tests use mocked GitHub APIs; no real runs, artifacts or releases were deleted.
- New deployment/release/Play chaining was not executed on GitHub. Cloudflare/Turso deployment and signed production builds were not repeated for this automation-only change. Android app source is unchanged from the local builds listed above.

The app has not been exercised on a physical phone or emulator. Live Cloudflare/Turso behavior, real parcel handling, signed release upgrades and Google Play update delivery still need testing with your configured accounts and signing keys.

The supplied GitHub Actions logs confirm the API job passed. The Android job stopped before compilation because `setup-android@v3` requested the unavailable legacy `tools` package. Both CI and signed-release workflows now explicitly request `platform-tools`, `platforms;android-36` and `build-tools;35.0.0`. The package names match the locally installed SDK used for the successful builds above, and both workflow inputs were checked against the action's implementation. A GitHub rerun of this fix is still pending; upload the corrected workflows to trigger it.


API URL release-configuration fix — 9 October 2026:

- All APKs are endpoint-neutral: the host is provisioned at runtime via a pairing code, not embedded in BuildConfig or GitHub Actions. See `README.md` for migration limitations.
- Release configuration validation runs immediately after checkout and reports all missing settings by name without exposing their values. A missing signing key is reported using its GitHub secret name, `ANDROID_KEYSTORE_BASE64`.
- Seven Python tests and eleven Node tests passed. The new release guard test executes the actual workflow shell block with each required setting missing and with complete mock configuration, checking errors, absence of secret values in output and signing-key restoration. Play publishing tests use mocked HTTP calls.
- All five workflow YAML files parsed and all 22 shell blocks passed `bash -n`. API URL fallback consistency and the early guard position were checked. Actionlint is unavailable in this environment and was not rerun.
- All APKs are endpoint-neutral: the host is provisioned at runtime via a pairing code, not embedded in BuildConfig or GitHub Actions. See `README.md` for migration limitations.


Optional Android signing — 9 October 2026:

- All APKs are endpoint-neutral: the host is provisioned at runtime via a pairing code, not embedded in BuildConfig or GitHub Actions. See `README.md` for migration limitations.
- Test builds receive automatic `-debug` tags and are always prereleases, including explicit plain version tags. They are never marked latest. The stable updater continues to use the latest non-prerelease API, and no updater signature checks were weakened. Test release notes explain that runner-generated debug keys cannot update production installations and later test builds may need a reinstall.
- Twelve Python tests and twelve Node tests passed. Checks execute the real workflow configuration, asset-packaging and Play-gating shell blocks. Publication checks use a fake `gh` executable and dummy APK/AAB bytes; no GitHub releases or Play drafts were actually uploaded. Tests cover all missing signing fields, no signing fields, complete signing configuration, invalid Base64, required API URL, test tags, explicit tags and monotonic versions after prereleases.
- All five YAML workflows, all 23 shell blocks and embedded Python parsed. Signed and test build conditions were checked. Actionlint and an Android SDK/Gradle build environment are unavailable in this session, so actionlint and actual APK/AAB builds were not rerun.
- Changes are limited to automation scripts, workflows, tests and instructions; Android and Worker source/version settings are unchanged. Deployment and real signing remain untested here. Upload the corrected files and run the renamed **Android release** workflow on the updated branch.


Actions cleanup fix — 9 October 2026:

- The screenshot shows recent runs below the original one-day/seven-day retention thresholds. Automatic expired mode retains these by default and now reports the policy and manual cleanup option in its summary.
- Fixed workflow-path matching for GitHub API paths containing a ref suffix (`ci.yml@main` or `ci.yml@refs/heads/main`). The previous filename comparison rejected these paths.
- Cleanup completion triggers now include the renamed **Android release** workflow as well as its legacy name.
- Manual dispatch defaults to `all_completed`, which deletes completed repository runs immediately, including retired workflow paths. `expired` remains selectable for retention-based cleanup. Active/queued runs and the current cleanup are always kept, and each candidate is re-read before deletion to protect reruns. Published GitHub Releases are untouched.
- Retention now supports 0–90 days. Set both repository retention variables to string `0` for immediate automatic cleanup of the project workflows; the default automatic retention remains 1/7 days. Deleting runs also removes their logs and artifacts.
- Seventeen Node tests and twelve Python tests passed (29 total). All five workflow YAML files, 23 Bash blocks and embedded Python passed syntax checks. Manual default mode, release trigger name and write permissions were verified. Cleanup tests use mocked GitHub API methods: no real runs were deleted. Actionlint is unavailable and was not rerun.
- This update includes the preceding optional-signing fix. Android and Worker source/version settings are unchanged; no app builds, deployment or GitHub execution was performed.


Separate automatic Android release — 9 October 2026:

- `Android release` now listens for successful completion of `Test and build` on `main` and appears as a separate Actions run. CI no longer also calls it as a reusable release job, preventing duplicate automatic publication paths. Tag/manual/reusable triggers remain available.
- Automatic release configuration rejects failed/cancelled checks, pull-request events, fork repositories and other branches. The tested source SHA is used for configuration, checkout and the published release target. `workflow_run` supplies the default-branch SHA as `GITHUB_SHA`, so shared planning now explicitly uses `RELEASE_SOURCE_SHA` when provided.
- A tested commit that is no longer current, a missing API URL, or `AUTO_RELEASE=false` skips automatic publication with a summary. Manual/tagged releases remain available when automatic releases are disabled. Optional signing and signed-only Play upload behavior remain intact.
- API deployment remains inside Test and build. A failed configured deployment makes that workflow fail, so the separate release is not published. Cleanup already watches the current release name. No personal access token or bot-created tag trigger is needed.
- Fourteen Python tests and seventeen Node tests passed (31 total), including actual preflight-shell execution with mocked GitHub current-commit queries, tested/default SHA differences, stale commits, disabled release flags, missing API URL, manual/tag paths, and publication target verification. No real publishing or GitHub API mutations were performed by the tests.
- All five workflow YAML files, 24 shell blocks and embedded Python parsed. Trigger names, exact checkout refs, duplicate-path removal and seven trusted/untrusted completion-condition cases were verified locally. Actionlint and Android builds were not rerun; a live GitHub Actions run remains pending.
- Changes are limited to workflows, automation scripts, tests and instructions. Android and Worker source/version settings are unchanged. Upload the full corrected project on the default `main` branch and leave `AUTO_RELEASE` unset or `true` to enable the new chain.

## Startup crash regression (0.2.1)

- Cold launch on an actual Android 16 emulator is now a mandatory CI step. It
  clears app data, launches the direct APK and checks that its process remains
  alive with a visible activity after eight seconds.
- `MainActivityStartupTest` opens the **real** activity with empty preferences,
  malformed saved profile JSON, and verifies local crash reports are removable.
- A failure while constructing the initial Material UI shows a minimal recovery
  screen with **Copy crash report** and **Retry**. Background scheduling and update
  checks no longer block opening the activity. Unexpected server responses in a
  UI callback are recorded instead of crashing the process.
- Crash reports are stored **only in the app's private files directory**. Users
  explicitly copy them from the recovery screen or Settings; they are never
  automatically uploaded. Saved account preferences and server data are not
  deleted as part of crash recovery.
- For a device-specific reproduction, connect a device via Android Debug Bridge:

  ```sh
  adb logcat -c
  adb shell am force-stop com.parcelbridge.app.direct
  adb shell am start -W -n com.parcelbridge.app.direct/com.parcelbridge.app.MainActivity
  adb logcat -d -v time | grep -A 70 -E 'FATAL EXCEPTION|AndroidRuntime|ParcelBridge'
  ```

The actual exception from the reported screenshot was **not included** in the
screenshot or source ZIP; share the Android **Copy crash log URL** output to
identify any device-specific underlying cause. Do not consider the original
crash proven resolved until tested on the affected device.


## Yutaka-style GitHub Actions automation (9 October 2026)

- Cleanup policy now removes successful/skipped/neutral runs immediately once complete, retains failures/cancellations/timeouts for 20 minutes, and sweeps every 10 minutes. Automatic cleanup covers renamed/retired workflow runs, checks active run state again immediately before deletion, never deletes the currently running cleanup and keeps GitHub Releases. Manual `all_completed` deletes any completed runs immediately. GitHub schedule timings are best-effort.
- Android and API changes are detected separately. Workflow-only/documentation changes no longer automatically redeploy the API or publish Android version bumps; API-only edits deploy the Worker but skip an unnecessary APK. Android changes after the last published release enable automatic publishing only after the tested main-branch CI/deployment chain passes. Manual/tagged releases and manual deployments remain possible.
- `AUTO_RELEASE`, `AUTO_DEPLOY_API`, `AUTO_UPLOAD_PLAY`, optional Android signing (test-only prerelease when missing), signed Play AAB generation, Google Play draft uploads and latest signed stable release remain as configured.
- Only workflow files, GitHub automation scripts, tests and documentation were modified: Android and API versions are unchanged. The upstream Yutaka repository was not available, so only behavior-compatible automation patterns were implemented rather than copying its source verbatim.
- Test counts and build/runner status for this change are recorded in the accompanying ChatGPT response; no real GitHub runs or releases were deleted or published from the local tests.
