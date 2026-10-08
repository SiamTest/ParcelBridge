"""Upload the signed bundle as a Play draft; publication stays in Play Console."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

token = os.environ["PLAY_ACCESS_TOKEN"]
track = os.environ.get("PLAY_TRACK", "internal")
assert track in {"internal", "alpha", "beta", "production"}
package = "com.parcelbridge.app"
base = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{package}"

def call(url, method="GET", data=None, media=False):
    payload = data if media else (json.dumps(data).encode() if data is not None else None)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/octet-stream" if media else "application/json"}
    with urlopen(Request(url, data=payload, headers=headers, method=method), timeout=180) as response:
        content = response.read()
        return json.loads(content) if content else {}

edit = call(f"{base}/edits", "POST", {})["id"]
try:
    bundle = Path("release/parcelbridge-play.aab").read_bytes()
    assert bundle, "Bundle is empty"
    uploaded = call(f"https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{package}/edits/{edit}/bundles?uploadType=media", "POST", bundle, True)
    manifest = json.loads(Path("release/update.json").read_text())
    assert uploaded["versionCode"] == manifest["versionCode"], "Bundle version does not match the signed release"
    call(f"{base}/edits/{edit}/tracks/{track}", "PUT", {"track": track, "releases": [{"versionCodes": [str(uploaded["versionCode"])], "status": "draft", "name": manifest["versionName"]}]})
    call(f"{base}/edits/{edit}:commit", "POST", {})
    print(f"Version {uploaded['versionCode']} uploaded to the {track} track as a draft.")
except Exception:
    try:
        call(f"{base}/edits/{edit}", "DELETE")
    except Exception:
        pass  # Preserve the original publishing failure if cleanup also fails.
    raise
