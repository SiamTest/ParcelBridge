# Android 16 startup crash fix (ParcelBridge 0.2.2)

The user-reported crash was `PhoneWindow.getInsetsController()` / `DecorView.getWindowInsetsController()`
from `ExpressiveUi.page()` during `MainActivity.onCreate()`. The app attempted to resolve
`WindowCompat.getInsetsController(window, layout)` before `setContentView(layout)`.
On Android 16 (API 36), the window's decor view can still be null at that point.

## Changes

- Install a view attach listener before `setContentView`. Apply light/dark system-bar
  appearance through the null-safe `ViewCompat.getWindowInsetsController(layout)` only
  once the content is attached. Insets are requested on attachment.
- Preserve edge-to-edge, navigation bar, IME padding, motion, and all Material styling.
- Add an SDK 36 `MainActivity` startup regression test.
- Tighten the emulator smoke gate: it now fails when the app falls back to the
  emergency recovery interface while its process remains running.
- Increment default Android versionName to 0.2.2 and versionCode to 4 (CI releases
  can override both through environment variables as before).

## Verification

Local script tests can be run with `python3 -m unittest discover -s scripts -p 'test_*.py'`
and `node --test scripts/*.test.mjs`. Gradle unit tests and a live Android 16 emulator
must run in GitHub Actions. On a new commit, verify the `Android 16 cold-start smoke test`
job reaches the regular welcome screen.

## Data and release behavior

No user account data, database, or Worker API schemas were changed. All existing
GitHub Actions and signing requirements are preserved.
