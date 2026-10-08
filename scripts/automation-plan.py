import os
from pathlib import Path
from urllib.parse import urlsplit


def plan(env):
    groups = {
        "deploy": ("AUTO_DEPLOY_API", ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"]),
        "release": ("AUTO_RELEASE", ["API_BASE_URL"]),
        "play": ("AUTO_UPLOAD_PLAY", ["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"]),
    }
    result, messages = {}, []
    source_sha = env.get("RELEASE_SOURCE_SHA") or env.get("GITHUB_SHA")
    current = source_sha == env.get("CURRENT_MAIN_SHA") and bool(source_sha)
    for job, (flag, required) in groups.items():
        value = env.get(flag, "").strip().lower()
        if value not in ("", "true", "false"):
            raise ValueError(f"{flag} must be true or false")
        missing = [key for key in required if not env.get(key)]
        result[job] = current and value != "false" and not missing
        reason = "enabled" if result[job] else ("source is no longer main" if not current else "disabled" if value == "false" else "missing " + ", ".join(missing))
        messages.append(f"- {job}: {reason}")
    if result["release"]:
        url = urlsplit(env["API_BASE_URL"])
        if url.scheme != "https" or not url.hostname or url.username or url.password or url.path not in ("", "/") or url.query or url.fragment:
            raise ValueError("API_BASE_URL must be an HTTPS origin without a path")
    signing_missing = [key for key in ("ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD") if not env.get(key)]
    if result["release"] and signing_missing:
        messages[1] = "- release: enabled (test APK prerelease; missing " + ", ".join(signing_missing) + ")"
    if not result["release"]:
        result["play"] = False
        messages[-1] = "- play: skipped because no Android release is configured"
    elif signing_missing:
        result["play"] = False
        messages[-1] = "- play: skipped because signing secrets are incomplete"
    return result, "\n".join(messages) + "\n"


if __name__ == "__main__":
    result, summary = plan(os.environ)
    with Path(os.environ["GITHUB_OUTPUT"]).open("a") as output:
        output.write("".join(f"{key}={str(value).lower()}\n" for key, value in result.items()))
    with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a") as output:
        output.write(summary)
    print(summary)
