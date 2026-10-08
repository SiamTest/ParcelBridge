# Push ParcelBridge and build your Android app

1. Extract this ZIP. Upload the **contents of the `ParcelBridge` folder** to `SiamTest/ParcelBridge` on the `main` branch. Include the hidden `.github` folder, `.gitignore` and `.gitattributes`.
2. Open the repository's **Actions** tab. **Test and build** runs automatically. After checks pass on `main`, it runs each configured production step: API deployment, signed GitHub Release, then an optional Play draft. Missing secrets appear in the run summary and skip the corresponding step. Pull requests run checks only.
3. Create a Turso **libSQL** database and a GitHub environment named `production`. Add `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as repository or production-environment secrets. Your existing repository secrets work; you do not need to duplicate them.
4. Review Feni coverage and prices in `api/wrangler.jsonc`. API deployment runs automatically when its credentials exist; **Deploy Cloudflare API** can also be run manually.
5. Add repository **variable** `API_BASE_URL` (an existing secret with the same name also works; the variable takes precedence) with `https://parcelbridge-api.koinlytest.workers.dev` for your current Worker. Rerun **Test and build** on `main` to embed it, or enter the server address in the debug app's Settings.
6. Register a seller and a rider. Promote your trusted operator account using the SQL in `README.md`; approve the rider from Operator tools.
7. For production APKs, create and securely back up a persistent Android signing keystore. Add the four `ANDROID_*` signing secrets listed in `README.md`, then run **Test and build** on `main` or push a commit. **Signed Android release** automatically assigns an increasing version code and publishes the signed APK, Play AAB and update manifest in GitHub Releases. You can still push a tag such as `v1.0.0` or run the release workflow manually.
8. For Google Play, create the Play app and configure its signing, listing and service-account access. Add `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`; each configured signed release then uploads an internal-track draft automatically. Review and publish through Play Console. Use `PLAY_TRACK` to choose another track, or `AUTO_UPLOAD_PLAY=false` to keep draft uploads manual.
9. Successful Actions runs, logs and artifacts are automatically deleted after one day; failed/cancelled runs after seven days. Download debug artifacts promptly. Published GitHub Releases and active runs are kept. Cleanup runs after completion and every six hours; retention is configurable in the variables listed in `README.md`.

Do not distribute debug APKs as production releases: they use a different signing key. APK and Play variants have separate package IDs and update channels. The direct APK build supports automatic update checks and optional verified Wi-Fi downloads; Android asks for installation approval.

No passwords or account credentials are included in this archive. Never commit your Turso token, Cloudflare token, Play service-account JSON or signing keystore.

This is a pilot. Test actual deliveries and two consecutive signed updates on real phones before launch. Prices and the approximate three-kilometre Feni zone are configurable. COD records are bookkeeping; this app does not transfer money.

See `README.md` for all features, setup details and remaining launch work.
