import io
import json
import os
import runpy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("publish-play.py")

class PublishingTests(unittest.TestCase):
    def execute(self, bundle_version=1001):
        calls = []
        def respond(request, timeout):
            calls.append(request)
            if request.method == "DELETE":
                return io.BytesIO(b"")
            if "uploadType=media" in request.full_url:
                return io.BytesIO(json.dumps({"versionCode": bundle_version}).encode())
            return io.BytesIO(b'{"id":"edit-1"}')
        with tempfile.TemporaryDirectory(dir=Path.cwd()) as directory:
            before = Path.cwd()
            try:
                os.chdir(directory)
                Path("release").mkdir()
                Path("release/parcelbridge-play.aab").write_bytes(b"test bundle")
                Path("release/update.json").write_text(json.dumps({"versionCode":1001,"versionName":"0.1.0"}))
                with patch.dict(os.environ, {"PLAY_ACCESS_TOKEN":"test-token", "PLAY_TRACK":"internal"}), patch("urllib.request.urlopen", respond):
                    if bundle_version != 1001:
                        with self.assertRaisesRegex(AssertionError, "version"):
                            runpy.run_path(str(SCRIPT))
                    else:
                        runpy.run_path(str(SCRIPT))
            finally:
                os.chdir(before)
        return calls

    def test_only_creates_draft_release(self):
        calls = self.execute()
        track = next(r for r in calls if "/tracks/" in r.full_url)
        self.assertEqual(json.loads(track.data)["releases"][0]["status"], "draft")
        self.assertTrue(calls[-1].full_url.endswith(":commit"))

    def test_version_mismatch_abandons_edit(self):
        calls = self.execute(999)
        self.assertEqual(calls[-1].method, "DELETE")
        self.assertFalse(any(r.full_url.endswith(":commit") for r in calls))

if __name__ == "__main__":
    unittest.main()
