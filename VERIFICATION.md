# Verification — 8 October 2026

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

- CI debug builds, production automation planning and signed releases now read `vars.API_BASE_URL || secrets.API_BASE_URL`; a nonempty variable wins. No hardcoded server fallback was introduced.
- Release configuration validation runs immediately after checkout and reports all missing settings by name without exposing their values. A missing signing key is reported using its GitHub secret name, `ANDROID_KEYSTORE_BASE64`.
- Seven Python tests and eleven Node tests passed. The new release guard test executes the actual workflow shell block with each required setting missing and with complete mock configuration, checking errors, absence of secret values in output and signing-key restoration. Play publishing tests use mocked HTTP calls.
- All five workflow YAML files parsed and all 22 shell blocks passed `bash -n`. API URL fallback consistency and the early guard position were checked. Actionlint is unavailable in this environment and was not rerun.
- App and API source and versions are unchanged. No Android build, live deployment, signing with real keys, GitHub release or Play upload was performed for this workflow fix. GitHub settings cannot be inspected from this archive; configure `API_BASE_URL` if it is absent from both Variables and Secrets.
