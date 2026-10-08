# Push ParcelBridge and build your Android app

1. Extract this ZIP. Upload the **contents of the `ParcelBridge` folder** to `SiamTest/ParcelBridge` on the `main` branch. Include the hidden `.github` folder, `.gitignore` and `.gitattributes`.
2. Open the repository's **Actions** tab. The **Test and build** workflow runs automatically on the push. Download the `parcelbridge-debug-apks` artifact after it passes.
3. Create a Turso **libSQL** database. Add a GitHub environment named `production`, with `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as secrets.
4. Review Feni coverage and prices in `api/wrangler.jsonc`. Run **Deploy Cloudflare API** manually from Actions.
5. Add repository variable `API_BASE_URL` with the deployed Worker HTTPS URL. Rerun **Test and build** to embed the address, or enter the server address in the debug app's Settings.
6. Register a seller and a rider. Promote your trusted operator account using the SQL in `README.md`; approve the rider from Operator tools.
7. For production APKs, create and securely back up a persistent Android signing keystore. Add the four `ANDROID_*` signing secrets listed in `README.md`, then push a tag such as `v0.1.0`. **Signed Android release** creates an APK, Play AAB and update manifest in GitHub Releases.
8. For Google Play, create the Play app and configure its signing, listing and service-account access. Add `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. Run **Upload Google Play draft**, review the draft and publish through Play Console.

Do not distribute debug APKs as production releases: they use a different signing key. APK and Play variants have separate package IDs and update channels. The direct APK build supports automatic update checks and optional verified Wi-Fi downloads; Android asks for installation approval.

No passwords or account credentials are included in this archive. Never commit your Turso token, Cloudflare token, Play service-account JSON or signing keystore.

This is a pilot. Test actual deliveries and two consecutive signed updates on real phones before launch. Prices and the approximate three-kilometre Feni zone are configurable. COD records are bookkeeping; this app does not transfer money.

See `README.md` for all features, setup details and remaining launch work.
