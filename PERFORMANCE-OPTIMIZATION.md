# ParcelBridge 0.2.4 — responsive Material 3 Expressive UI

## Changes

- Removed the redundant app-level Reduce motion toggle. Device-wide animation settings are still respected for accessibility.
- Physics-based entrance animations remain, but operate only on each screen’s hero card, not entire (potentially tall) scrolling forms and lists. Touch springs and dialog animations remain.
- The animation handler uses one detach listener per interactive control, cleans up running animations on detach, and no longer reads SharedPreferences on every press.
- Stream JSON array entries through a lazy Sequence instead of allocating a second full list.
- Reuse the date formatter when rendering event/chat histories.
- Cache resolved Material theme colors in the Activity-scoped UI renderer.
- Avoid redundant padding/layout and nav visibility changes on repeated window-insets or keyboard frames.
- Cache decrypted API origin/session and the Android Keystore key handle **only in the current Api instance memory**. The persisted endpoint/session remain Keystore-encrypted, and preference change detection handles updates from other Api instances. No endpoint hostname is compiled into the app.

## Safety / compatibility

- Existing encrypted credentials and legacy migration remain intact.
- No change to network protocol, Cloudflare API or endpoint pairing.
- App default version updated to 0.2.4 (versionCode 6); release automation's monotonic version-code strategy remains unchanged.

## Verification

- Local Python and JavaScript CI contract tests exercise scripts/workflows.
- Android source-level regression tests cover motion toggle absence, system animator behavior, navigation, keyboard sizing and Android 16 startup.
- Actual device frame times / Android compilation must be verified in GitHub Actions and on a device.
