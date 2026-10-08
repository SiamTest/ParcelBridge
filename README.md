# ParcelBridge

Android delivery app for sellers and riders in Feni, Bangladesh. Kotlin app, Cloudflare Workers API, Turso/libSQL database and GitHub Actions. This is a pilot implementation, not a deployed service.

## Features included

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
- API request limits, SQL parameter binding, role checks, private customer details and scheduled session cleanup.

## Architecture

```text
Android seller / rider / operator
               |
         HTTPS Worker API ---------------- GitHub Releases (direct APK updates)
               |
         Turso/libSQL
               |
      Public tracking page

GitHub Actions: API tests + Android tests/lint/build
               signed APK + signed Play AAB + update manifest
               manual Cloudflare deployment and Play draft upload
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
$env:API_BASE_URL = 'https://parcelbridge-api.YOUR-SUBDOMAIN.workers.dev'
.\gradlew.bat testDirectDebugUnitTest testPlayDebugUnitTest assembleDirectDebug assemblePlayDebug
```

Open this project in Android Studio for a normal local development setup. A standard Gradle wrapper with the official distribution checksum is included. CI supplies the same pinned Gradle version through `gradle/actions/setup-gradle`. A debug build without `API_BASE_URL` opens a server-setup screen.

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

Set repository variable `API_BASE_URL` to the deployed HTTPS Worker URL. Configure these environment secrets:

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

Keep signing keys and passwords in secure storage; future direct updates must use the same signing key. Do not put secret values in chat, app configuration, source files, or GitHub variables.

1. **Test and build:** on pull requests, main pushes or manual runs; verifies the API, tests/lints both Android variants and uploads debug APK artifacts.
2. **Deploy Cloudflare API:** manual run; checks/tests, applies the initial schema and deploys the Worker plus private database bindings. It sets `GITHUB_REPOSITORY` to the current repository for direct updates.
3. **Signed Android release:** push a version tag such as `v0.1.0`; builds a signed direct APK, a signed Play AAB and a checksummed manifest, then creates a GitHub Release. Version codes are release-workflow run numbers plus 1000. Do not reset the workflow run-number sequence after distribution. API URL and all signing secrets are required.
4. **Upload Google Play draft:** manual run with the release tag and track; downloads the AAB and uploads a draft through the Android Publisher API. Review and publish in Play Console.

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
