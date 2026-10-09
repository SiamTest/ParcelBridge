# ParcelBridge

Android delivery app for sellers and riders in Feni, Bangladesh. Kotlin app, Cloudflare Workers API, Turso/libSQL database and GitHub Actions. This is a pilot implementation.

## Features included

- Material 3 Expressive interface throughout authentication, seller/rider/operator flows and both updater variants. Consistent Inter typography, green light/dark themes, tonal actions, shaped cards, outlined inputs and rounded dialogs.
- Physics-based page and dialog entrances, button/navigation press feedback and Material active indicators. Animations respect Android animator settings; Settings includes a persisted Reduce motion switch.
- Adaptive bottom navigation below 600 dp and a navigation rail on larger screens. Content is centered and capped at 840 dp, with wrapping labels/actions, scrollable forms/dialogs and keyboard/system-bar/cutout insets. Decorative shapes hide on narrow screens or with enlarged text.

- Seller and rider registration, email/password sign-in, encrypted device sessions, logout and password changes that revoke all sessions.
- Operator approval of riders and account blocking.
- Feni service-area validation, BDT quotes, package sizes, pickup scheduling up to 30 days ahead, and duplicate-booking protection.
- Saved pickup addresses, current-location capture and Android address lookup with coordinate fallback.
- Preferred riders and favourites. Preferred riders receive a five-minute reservation before a job opens to others.
- Online/offline rider availability, nearby jobs, transparent rider pay and atomic job acceptance.
- Pickup confirmation, customer confirmation, five-attempt code lockout and operator unlock.
- Failed delivery reasons, retry, return to seller, return confirmation, release of accepted jobs and cancellation of unassigned jobs.
- Map navigation, phone dialling, foreground rider location sharing, delivery timeline and customer tracking links that require no app.
- Delivery chat, seller ratings, history search, pagination and CSV sharing.
- Product COD recording, exact cash confirmation and audited operator settlement records. **These records do not transfer money.**
- Support tickets and operator replies.
- Cached reads when offline. Mutations always need a live connection; they are never queued silently.
- Background status notifications, daily direct-update checks and optional automatic Wi-Fi downloads.
- Direct APK updates verify the SHA-256 digest, package name, increasing version and signing certificate before installation.
- Google Play flexible in-app updates in the Play build.
- Automatic main-branch deployment, GitHub Releases with optional production signing, generated version codes and release notes, and optional Google Play draft uploads after checks pass.
- Automatic Actions cleanup: successful runs are removed after completion; failed/cancelled runs are kept for 20 minutes, then swept automatically. Published releases are kept.
- API request limits, SQL parameter binding, role checks, private customer details and scheduled session cleanup.

## Architecture

```text
Android seller / rider / operator
               |
         Public gateway ---------------- GitHub Releases (direct APK updates)
               |
          Service binding
               |
           Private API Worker
               |
         Turso/libSQL
               |
      Public tracking page

GitHub Actions: API tests + Android tests/lint/build
               automatic Cloudflare deployment
               Android APK + update manifest + GitHub Release (signed Play AAB when configured)
               optional Play draft upload + completed-run cleanup
```

Database credentials are only in Workers and GitHub environment secrets. The Android app never connects directly to Turso.

## Run and configure

Use JDK 17, Gradle 8.11.1, Android SDK 36, Node 22 or newer, and a Turso **libSQL** database. This project uses the supported `@libsql/client` HTTP client, not the newer Turso-engine-only SDK. The app targets API 36 for current [Google Play submissions](https://support.google.com/googleplay/android-developer/answer/11926878).

```powershell
cd R:\Codex\ParcelBridge\api
npm ci
npm run check
npm test
Copy-Item .dev.vars.example .dev.vars
```

Edit `.dev.vars` locally with your database URL and token. Do not commit it. Apply `api/schema.sql` through the Turso SQL shell, or set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your shell environment and run `npm run migrate`. The initial schema is additive and preserves existing rows; subsequent schema changes will need reviewed migrations.

`npm run dev` starts the Worker locally. The app requires an HTTPS API address; deploy your Worker for phone testing or use an HTTPS development tunnel.

```powershell
cd R:\Codex\ParcelBridge
# No API origin is passed to the Android build. Pair devices after install.
.\gradlew.bat testDirectDebugUnitTest testPlayDebugUnitTest assembleDirectDebug assemblePlayDebug
```

Open this project in Android Studio for a normal local development setup. A standard Gradle wrapper with the official distribution checksum is included. CI supplies the same pinned Gradle version through `gradle/actions/setup-gradle`. Fresh installs show a device-pairing screen; no API origin is compiled into any build.

## Feni coverage and prices

Review `api/wrangler.jsonc` before deployment:

| Setting | Pilot default |
|---|---|
| City centre | 23.0144, 91.3966 |
| Coverage | Both endpoints within 3 km of the centre |
| Currency | BDT |
| Small-parcel base fee | BDT 60 |
| Fee per started straight-line kilometre | BDT 10 |
| Medium / large multiplier | 1.3 / 1.7 |
| Rider share | 85% of delivery fee |
| Maximum product COD | BDT 10,000 |
| Nearby job pickup distance | 10 km |

The centre coordinates are based on [GeoNames](https://www.geonames.org/search.html?country=BD&q=Feni). The radius is an approximate Feni launch zone, **not an official municipal boundary**. Replace it with a reviewed boundary polygon if municipal-only coverage is required. Rates are illustrative, not researched courier prices. Quotes use straight-line distance, not road distance. Delivery fee collection, cancellation charges, operator payouts, ID checks, parcel limits and compensation policies need operator decisions before a public launch.

## GitHub Actions setup

Push this folder as the repository root. Add a GitHub environment named `production`. Protect it if you want release/deployment approval through GitHub.

The backend Worker is private (`workers_dev: false`). The public entry Worker (`api/edge/`) exposes the application and forwards requests through a Cloudflare service binding. Configure these secrets at repository scope or in the `production` environment (environment values take precedence):

| Secret | Used for |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Worker deployment |
| `CLOUDFLARE_API_TOKEN` | Scoped Worker deployment token |
| `TURSO_DATABASE_URL` | libSQL database URL |
| `TURSO_AUTH_TOKEN` | Database token |
| `ANDROID_KEYSTORE_BASE64` | Base64 of your persistent release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Signing alias |
| `ANDROID_KEY_PASSWORD` | Key password |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Optional Play draft upload service account |

There is no API URL setting in GitHub Actions: no hostname is embedded into APKs or AABs. Signing settings remain optional. If any signing secrets are missing, the workflow publishes a test prerelease; invalid signing credentials still fail the build.

Keep signing keys and passwords in secure storage; future direct updates must use the same signing key. Do not put secret values in chat, app configuration, source files, or GitHub variables.

1. **Test and build:** on pull requests, main pushes or manual runs; verifies the API and automation scripts, tests/lints both Android variants and uploads debug APK artifacts. Configured API deployment is a job inside this run. Once a trusted main-branch build succeeds (including its configured deployment), a separate **Android release** Action checks whether Android code changed before publishing. Manual workflow dispatches can still force a build. Pull requests only run checks. Main runs are serialized rather than cancelling a deployment mid-flight; a commit that is no longer main skips production work. The run summary lists missing configuration by name without printing secret values.
2. **Deploy Cloudflare API:** automatically called after checks when API source changes and Cloudflare/Turso credentials exist, or run manually. A manual **Test and build** run can also request deployment even without source changes. Checks/tests, applies the additive initial schema and deploys the Worker plus private database bindings. It sets `GITHUB_REPOSITORY` to the current repository for direct updates. A failed deployment stops the following automatic release.
3. **Android release:** automatically starts as a separate Action after **Test and build** succeeds on `main`, when Android source or build configuration changed since the last published release, the tested commit is still current, the API URL exists and `AUTO_RELEASE` is not `false`. API-only, documentation-only and workflow-only edits do not publish an unnecessary new APK or bump the Android version. Manual or tag-triggered releases can still run without Android source changes. It checks out and tags the exact tested commit, rather than the default-branch SHA supplied by the completion event. Failed/cancelled checks, failed configured API deployments, fork runs and pull requests do not publish releases. With all four signing secrets, it builds a production-signed direct APK, a signed Play AAB and a checksummed manifest. Otherwise it builds an installable debug APK and manifest for a clearly labelled test prerelease, without a Play AAB. It uploads assets to a draft GitHub Release and publishes only after all uploads succeed. Release notes are generated automatically and published assets are immutable. You can also run it manually or push a tag such as `v1.0.0`. Test builds are always prereleases and never marked latest, even for a tag without a suffix. The stable APK updater does not select them.
4. **Upload Google Play draft:** automatically called after publishing a production-signed build when the service-account secret exists, or run manually with a release tag and track. It downloads the AAB and uploads a draft through the Android Publisher API. Review and publish in Play Console. Play requires initial app setup and appropriate service-account access.
5. **Clean completed Actions runs:** automatically after workflow completion and every 10 minutes, successful/skipped/neutral runs are removed immediately; failures, cancellations and timeouts remain for a 20-minute debugging window and are removed on a subsequent sweep. GitHub schedules can run late. Manual `all_completed` immediately removes completed runs from all workflows, including retired ones, without waiting. Select manual `automatic` to respect the 20-minute failure window. Queued/running jobs, the active cleanup job and all published GitHub Releases are preserved. The job always reads default-branch code, rechecks each candidate for reruns and fails visibly on insufficient GitHub Actions permissions. Completed workflow-run logs and run artifacts are deleted with their runs, so download anything needed before starting manual cleanup.

API deployment is invoked directly as a reusable job inside **Test and build**; the optional Play draft is a reusable job inside **Android release**. Automatic Android releases use a `workflow_run` completion trigger and appear as a separate run in Actions. The pipeline does not rely on a bot-created tag triggering another workflow, and CI no longer also calls the release workflow, so each successful push has one automatic publication path. No personal access token is required. Individual workflows retain their manual triggers.

Automatic Android version codes use seconds since 1 January 2024 plus 1,000,000, or the most recently published manifest's code plus one, whichever is higher. Release history is paginated; prereleases count for version numbering and unpublished drafts do not. This preserves increasing versions when different workflows run or counters reset. Automatic production tags are `v0.2.<versionCode>` and test tags are `v0.2.<versionCode>-debug`; explicit version tags keep their supplied name. Network errors or an invalid previous manifest stop publication instead of silently resetting the version.

Optional repository variables (blank uses the default):

| Variable | Default | Meaning |
|---|---|---|
| `AUTO_DEPLOY_API` | `true` | Set `false` to keep deployment manual |
| `AUTO_RELEASE` | `true` | Set `false` to keep Android releases manual |
| `AUTO_UPLOAD_PLAY` | `true` | Set `false` to keep Play drafts manual |
| `PLAY_TRACK` | `internal` | Automatic draft track: internal, alpha, beta or production |
| `CLEANUP_SUCCESS_MINUTES` | `0` | Delay before deleting successful completed runs; 0–10,080 minutes |
| `CLEANUP_FAILURE_MINUTES` | `20` | Delay before deleting failed/cancelled completed runs; 0–10,080 minutes |

To clean the runs visible in Actions now, open **Actions → Clean completed Actions runs → Run workflow**, use the default branch and select **all_completed**. The currently executing cleanup stays visible until a later cleanup. No variables are required for Yutaka-style automatic cleanup. If previously set, remove obsolete `CLEANUP_SUCCESS_DAYS` and `CLEANUP_FAILURE_DAYS` variables; the new minute-based settings above are optional.

Only configured automatic steps run; for example, Cloudflare deployment works before signing keys are added. After adding credentials, use **Test and build → Run workflow → main** to start checks and optional API deployment. If no Android source changed since the last published release, launch **Android release → Run workflow** manually to rebuild with new signing credentials without modifying source. GitHub environment approval rules, if you configure them, still apply. Uploading this project does not enable a workflow that you previously disabled in GitHub; enable it through its Actions page.

You can leave the four Android signing secrets unset to publish a test APK. Test builds use runner-generated debug keys and cannot update a production installation; a later test build may also need a reinstall. Use production signing for stable updates and Google Play.

To enable optional production signing, create your initial key with JDK `keytool` once in a secure local directory:

```powershell
keytool -genkeypair -v -storetype JKS -keystore parcelbridge-release.jks -alias parcelbridge -keyalg RSA -keysize 3072 -validity 10000
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path .\parcelbridge-release.jks))) | Set-Clipboard
```

Paste the clipboard only into `ANDROID_KEYSTORE_BASE64`. Set `ANDROID_KEY_ALIAS` to `parcelbridge`, and add the keystore and key passwords as the two password secrets. Keep a secure backup of this key and passwords; creating a different key later prevents existing direct installations from updating. If you already distribute ParcelBridge, use that existing release key instead of generating a replacement.

The release manifest uses public GitHub download links. **The direct update channel requires a public release repository.** A private repo needs a separate authenticated artifact-hosting design before direct updates will work.

The direct package is `com.parcelbridge.app.direct`; the Play package is `com.parcelbridge.app`. They can coexist and do not overwrite each other’s signing identities. Both connect to the same backend.

For Play, first create the app in Play Console, complete the listing/testing requirements, configure Play App Signing and grant the publishing service account app access. Changing the production package ID later requires edits to `app/build.gradle.kts` and `scripts/publish-play.py` before the first upload.

## Create the first operator

Register an ordinary seller account, then promote that one trusted account through the Turso SQL shell:

```sql
UPDATE users SET role='admin', approved=1 WHERE email='YOUR-OPERATOR-EMAIL';
```

Sign out and sign in again to refresh the role shown on the device. Operator tools are inside the Android app. Verify rider identities outside the app before approving them. Registration itself does not verify phone/email ownership or identity.

## Delivery flow

```text
pending → accepted → picked_up → delivered
   |          |          |
cancelled   pending     failed → picked_up (retry)
                           |
                       returning → returned
```

The seller sees the pickup and delivery codes. The rider does not. Share the tracking link separately from the customer’s delivery code. Pickup/return uses the seller’s code; completed delivery uses the customer’s code and exact product COD confirmation.

## Verification and launch limits

Backend tests cover geofencing, sessions, permissions, duplicate bookings, simultaneous claims, preferred riders, scheduling, codes, returns, COD, settlement, ratings, support, private tracking and input limits. Android unit tests cover exact paisa amounts. Workflows also run Android lint and compile both distribution variants.

Use two phones to test seller/rider handover, denied permissions, network loss after booking, code failures, failed deliveries, chat, return, COD and updates between two signed releases. Play update testing requires a Play testing track; a sideloaded Play APK cannot exercise that service. Direct debug APKs cannot upgrade to your release signer.

This pilot does **not** include SMS/email verification or password recovery, payment gateways, automated payouts, identity-document verification, background GPS tracking, instant push notifications, image evidence, recurring automatic order generation, or Bangla translations. Status notifications use Android’s approximately 15-minute job scheduling and may be delayed. Foreground order screens share fresh rider locations about every 30 seconds after permission; customers see only the last shared location for five minutes. Chat refresh is manual.

Before a public Play launch, provide an actual operator contact, privacy policy, data-retention policy and account-deletion handling, complete Play data-safety declarations, review location disclosure and test on real devices. Backend tests do not verify live Turso/Cloudflare configuration or Google Play delivery.

Platform references: [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Turso TypeScript client](https://docs.turso.tech/sdk/ts/reference), [Play updates](https://developer.android.com/guide/playcore/in-app-updates/kotlin-java), and [Android installation consent](https://developer.android.com/reference/android/content/pm/PackageManager#canRequestPackageInstalls()).

## Provision private connections

Cloudflare deploys two Workers in order: `parcelbridge-api` is a private backend with no public `workers.dev` route; `parcelbridge-entry` is the public HTTPS gateway. The gateway is publicly discoverable through normal DNS/TLS/network inspection. A URL is **not a secret**, and these measures cannot hide all network destinations from clients. They do prevent an APK extractor from obtaining any hardcoded server origin, and prevent clients from connecting directly to the private backend.

**Migration warning:** Existing apps that relied exclusively on the old embedded API origin need a pairing code after upgrading. Devices that had entered an endpoint manually migrate the existing value into Android Keystore-protected preferences. Deploy the gateway and distribute new pairing codes **before** disabling the old public backend; the new Worker deployment automatically disables the old `workers.dev` endpoint. Previously published APKs and historical Git commits may still expose the old hostname. Removing a current hardcoded value cannot remove it from those artifacts.

1. Deploy the private backend and public gateway together using **Deploy Cloudflare API**.
2. Obtain the gateway's HTTPS origin from Cloudflare (never put the private backend URL in the code).
3. On your own machine, run `python3 scripts/make-pairing-code.py`; paste the **public gateway origin** when prompted.
4. Send the resulting code privately to users. In **Settings → Private pairing code**, paste it and tap **Pair this device**. Pairing signs out the previous local session and clears cached responses to prevent cross-service mixing; server-side deliveries remain intact.
5. Remove any old `API_BASE_URL` GitHub Variable/Secret; it is no longer read. Consider private deployment changes, user availability, and previously distributed APKs before retiring old endpoints.

Pairing codes are **not cryptographic secrets**; they are URL-safe representations of a public address. Anyone with device/network access may identify the public gateway. Database credentials and Cloudflare API tokens stay on the server and are never put in pairing codes.
