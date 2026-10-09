# GitHub Actions toolchain repair — 9 October 2026

## Failures addressed

1. **Node.js:** `actions/setup-node@v4` failed with `Some specified paths were not resolved, unable to cache dependencies.` The automatic npm cache requires `api/package-lock.json` in the checked-out source. Each Node job now checks `$GITHUB_WORKSPACE/api/package-lock.json` first and enables npm caching only when the file exists. Node installation proceeds even when the cache is unavailable.
2. **Android SDK:** `android-actions/setup-android@v3` tried to install the retired Android SDK package `tools`, which fails with `Failed to find package 'tools'`. All ParcelBridge Android jobs now use `android-actions/setup-android@v4`, explicitly installing `platform-tools`, Android platform 36 and build-tools 35.0.0 instead. SDK license text output is disabled, but license acceptance remains on.
3. **Warnings:** Node's `punycode` deprecation warning is non-fatal, separate from the cache error.

## Changed files

- `.github/workflows/ci.yml`: Node cache guard in test and API deployment jobs; SDK v4 for Android tests and Android 16 emulator smoke test.
- `.github/workflows/release.yml`: Node cache guard; SDK v4 for APK/AAB releases.
- `.github/workflows/deploy-api.yml`: Node cache guard for manual Cloudflare API deployment.
- `scripts/test_ci_toolchains.py`: regression checks including both present and missing npm lockfiles.

## Important

The cache guard only prevents a **cache-setup failure**. Actual API install/test/deploy commands still require `api/package.json` and `api/package-lock.json`, which are included in the full project archive. If those files are missing from your GitHub repository, commit them; do not suppress API tests.

No app, Cloudflare Worker, Gradle, manifest, or version files were changed. Workflow-only change: preserve app version `0.2.1`.

## Apply

- For an existing repository, extract the **patch archive** in the repository root (contains `.github` and `scripts` paths directly). Commit the files, including hidden `.github` files.
- Or use the **complete project archive** as a reference, merging any project changes committed after the previous ZIP.
- Push to `main`. Verify the new **Test and build** and **Android release** runs; the old failed runs cannot be repaired in place.

Local syntax and contract tests are not the same as executing GitHub Actions on a hosted runner.

## Android 16 Robolectric JVM compatibility (9 October 2026)

Robolectric 4.17 supports SDK 36, but SDK 36 tests require **JDK 21**.
`MainActivityStartupTest.android16ColdLaunchReachesWelcomeInsteadOfRecovery` previously failed during test-class initialization with `UnsupportedOperationException` from `DefaultSdkProvider` while CI used JDK 17.
The Android build, Android 16 emulator, and release workflows now select Temurin 21. Kotlin and Java compilation still target Java 17 bytecode in `app/build.gradle.kts`; application version remains 0.2.4 because these changes only update workflows, tests and documentation.
The API 36 Robolectric test remains enabled; the real Android 16 emulator smoke test remains a separate release gate.
Source: https://robolectric.org/compatibility_table/
