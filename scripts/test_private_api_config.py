import importlib.util
import json
import re
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]


class PrivateApiConfigurationTests(unittest.TestCase):
    def test_android_build_never_embeds_api_url(self):
        text = (ROOT / 'app/build.gradle.kts').read_text()
        self.assertNotIn('API_BASE_URL', text)
        self.assertNotIn('buildConfigField("String", "API_BASE_URL"', text)
        for path in (ROOT / '.github/workflows').glob('*.yml'):
            self.assertNotIn('API_BASE_URL', path.read_text(), path.name)

    def test_android_ui_only_accepts_pairing_code(self):
        source = (ROOT / 'app/src/main/java/com/parcelbridge/app/MainActivity.kt').read_text()
        self.assertNotIn('HTTPS API address', source)
        self.assertNotIn('Save server address', source)
        self.assertIn('api.pair(', source)
        api = (ROOT / 'app/src/main/java/com/parcelbridge/app/Api.kt').read_text()
        self.assertIn('endpoint_secure', api)
        self.assertIn('AES/GCM/NoPadding', api)
        self.assertNotIn('BuildConfig.API_BASE_URL', api)

    def test_backend_is_private_and_gateway_binds_to_it(self):
        backend = json.loads((ROOT/'api/wrangler.jsonc').read_text())
        edge = json.loads((ROOT/'api/edge/wrangler.jsonc').read_text())
        self.assertFalse(backend['workers_dev'])
        self.assertTrue(edge['workers_dev'])
        self.assertEqual(edge['services'][0]['service'], backend['name'])
        for path in (ROOT/'.github/workflows/ci.yml', ROOT/'.github/workflows/deploy-api.yml'):
            text = path.read_text()
            self.assertIn('wrangler deploy --config edge/wrangler.jsonc', text)

    def test_archive_guard_detects_baked_in_host(self):
        import io
        import zipfile
        import importlib.util
        spec = importlib.util.spec_from_file_location('apkguard', ROOT/'scripts/verify-apk-endpoints.py')
        guard = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(guard)
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            path = Path(d)/'app.apk'
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr('classes.dex', b'noop')
            guard.check(path)
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr('classes.dex', b'https://private.workers.dev')
            with self.assertRaisesRegex(ValueError, 'Embedded workers.dev hostname'):
                guard.check(path)

    def test_generate_out_of_band_pairing_code(self):
        spec = importlib.util.spec_from_file_location('pair', ROOT/'scripts/make-pairing-code.py')
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        from base64 import urlsafe_b64decode
        code = mod.encode('https://gateway.example.org')
        self.assertTrue(code.startswith('PB1-'))
        encoded = code.removeprefix('PB1-')
        self.assertEqual(urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4)).decode(), 'https://gateway.example.org')
        for invalid in ('http://example.org', 'https://example.org/path', 'https://a:b@example.org'):
            with self.assertRaises(ValueError): mod.encode(invalid)

    def test_no_deployed_worker_address_in_current_source(self):
        for path in (ROOT/'README.md', ROOT/'QUICKSTART.md', ROOT/'VERIFICATION.md'):
            self.assertNotIn('koinlytest.workers.dev', path.read_text())


if __name__ == '__main__':
    unittest.main()
