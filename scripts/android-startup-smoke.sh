#!/usr/bin/env bash
# Android Emulator Runner executes its `script:` input with /bin/sh. CI calls
# this file explicitly with `bash` to retain strict Bash semantics.
set -euo pipefail

app='com.parcelbridge.app.direct'
apk='app/build/outputs/apk/direct/debug/app-direct-debug.apk'
report_dir="${GITHUB_WORKSPACE:-$PWD}/build/android-startup-smoke"

on_exit() {
  local status=$?
  trap - EXIT
  if (( status != 0 )); then
    mkdir -p "$report_dir"
    adb logcat -d -v time -t 5000 > "$report_dir/logcat.txt" 2>&1 || true
    adb shell dumpsys activity activities > "$report_dir/activities.txt" 2>&1 || true
    echo "::error::Android 16 cold-start smoke test failed (exit $status). See uploaded diagnostics."
    if [[ -s "$report_dir/logcat.txt" ]]; then
      echo '--- Recent Android logcat (last 80 lines) ---'
      tail -n 80 "$report_dir/logcat.txt"
    fi
  fi
  exit "$status"
}
trap on_exit EXIT

if [[ ! -f "$apk" ]]; then
  echo "::error::Expected Android direct debug APK not found: $apk"
  exit 1
fi
adb install -r "$apk"
adb shell pm clear "$app"
adb logcat -c
adb shell am start -W -n "$app/com.parcelbridge.app.MainActivity"
sleep 8

if [[ -z "$(adb shell pidof "$app" | tr -d '\r')" ]]; then
  echo '::error::ParcelBridge process died during Android 16 cold launch'
  exit 1
fi
if ! adb shell dumpsys activity activities | grep -F "$app" >/dev/null; then
  echo '::error::ParcelBridge did not reach a visible activity'
  exit 1
fi

# MainActivity has a recovery screen that keeps its process alive. That is not
# a successful startup. Detect the logged exception from that fallback path.
if adb logcat -d -v brief | grep -F 'Startup screen failed:'; then
  echo '::error::ParcelBridge opened its recovery UI rather than the normal startup screen'
  exit 1
fi

echo 'ParcelBridge remained running and did not enter startup recovery after Android 16 cold launch.'
