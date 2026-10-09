"""Guard against the Android 16 decor-view initialization crash."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / "app/src/main/java/com/parcelbridge/app/ExpressiveUi.kt"
TEST = ROOT / "app/src/test/java/com/parcelbridge/app/MainActivityStartupTest.kt"
GRADLE = ROOT / "app/build.gradle.kts"


class WindowInsetsStartupContract(unittest.TestCase):
    def test_bar_controller_lookup_is_attachment_safe(self):
        source = UI.read_text()
        self.assertNotIn("WindowCompat.getInsetsController(activity.window, layout).apply", source)
        self.assertIn("ViewCompat.getWindowInsetsController(layout)?.apply", source)
        self.assertIn("override fun onViewAttachedToWindow(view: View)", source)
        self.assertLess(source.index("layout.addOnAttachStateChangeListener"),
                        source.index("activity.setContentView(layout)"))
        self.assertIn("ViewCompat.isAttachedToWindow(layout)", source)
        self.assertIn("ViewCompat.requestApplyInsets(view)", source)
        self.assertIn("WindowInsetsCompat.Type.ime()", source)

    def test_android36_activity_launch_has_its_own_regression(self):
        source = TEST.read_text()
        self.assertIn("@Test @Config(sdk = [36])", source)
        self.assertIn("android16ColdLaunchReachesWelcomeInsteadOfRecovery", source)
        self.assertIn('contains("Welcome back")', source)
        self.assertIn("couldn't open its interface", source)

    def test_app_code_change_increments_default_version(self):
        source = GRADLE.read_text()
        name = re.search(r'versionName\s*=\s*System.getenv\("APP_VERSION_NAME"\)\s*\?:\s*"([0-9.]+)"', source)
        code = re.search(r'versionCode\s*=\s*\(System.getenv\("APP_VERSION_CODE"\)\s*\?:\s*"(\d+)"\)', source)
        self.assertIsNotNone(name)
        self.assertIsNotNone(code)
        self.assertGreaterEqual(tuple(map(int, name.group(1).split('.'))), (0, 2, 4))
        self.assertGreaterEqual(int(code.group(1)), 6)


if __name__ == '__main__':
    unittest.main()
