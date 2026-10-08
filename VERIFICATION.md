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

The app has not been exercised on a physical phone or emulator. Live Cloudflare/Turso behavior, real parcel handling, signed release upgrades and Google Play update delivery still need testing with your configured accounts and signing keys.

The GitHub workflows are included but were not run in GitHub. Upload the contents of the `ParcelBridge` folder, including `.github`, to trigger CI.
