"""Protect smooth UI without disabling Material Expressive motion."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "app/src/main/java/com/parcelbridge/app"


class SmoothUiContract(unittest.TestCase):
    def test_remove_app_level_motion_toggle_but_keep_system_accessibility(self):
        screen = (SRC / "MainActivity.kt").read_text()
        motion = (SRC / "ExpressiveMotion.kt").read_text()
        self.assertNotIn('ui.preference(content, "Reduce motion"', screen)
        self.assertIn('fun enabled() = ValueAnimator.areAnimatorsEnabled()', motion)
        self.assertNotIn('getSharedPreferences(', motion)
        self.assertIn('SpringAnimation(view, property, end)', motion)
        self.assertIn('fun dialogShown(dialog: AlertDialog)', motion)

    def test_only_compact_hero_animates_not_entire_scrolling_page(self):
        ui = (SRC / "ExpressiveUi.kt").read_text()
        self.assertIn('ExpressiveMotion.enter(hero(column, title))', ui)
        self.assertNotIn('ExpressiveMotion.enter(column)', ui)
        self.assertIn('private fun hero(parent: LinearLayout, title: String): MaterialCardView', ui)
        self.assertIn('fun press(view: View)', (SRC / 'ExpressiveMotion.kt').read_text())

    def test_keyboard_insets_and_theme_colors_avoid_repeated_layout_work(self):
        ui = (SRC / "ExpressiveUi.kt").read_text()
        self.assertIn('if (view.paddingLeft != bars.left', ui)
        self.assertIn('if (nav.visibility != visibility)', ui)
        self.assertIn('private val colorCache', ui)

    def test_encrypted_configuration_keeps_cross_instance_cache_invalidation(self):
        api = (SRC / 'Api.kt').read_text()
        self.assertIn('endpointSealInMemory', api)
        self.assertIn('tokenSealInMemory', api)
        self.assertIn('if (encoded == tokenSealInMemory)', api)
        self.assertIn('if (encrypted == endpointSealInMemory)', api)
        self.assertIn('Cipher.getInstance("AES/GCM/NoPadding")', api)
        self.assertNotIn('BuildConfig.API_BASE_URL', api)

    def test_large_result_sets_do_not_allocate_eager_json_lists(self):
        api = (SRC / 'Api.kt').read_text()
        self.assertIn('fun JSONArray.objects(): Sequence<JSONObject>', api)
        self.assertIn('(0 until length()).asSequence()', api)

    def test_history_uses_reusable_formatter(self):
        activity = (SRC / 'MainActivity.kt').read_text()
        self.assertIn('private val localDateFormat by lazy', activity)
        self.assertIn('localDateFormat.format', activity)


if __name__ == "__main__":
    unittest.main()
