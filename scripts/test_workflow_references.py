import runpy
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

script = Path(__file__).with_name('validate-workflow-references.py')
errors_for = runpy.run_path(str(script))['errors_for']
PROJECT = Path(__file__).resolve().parent.parent


class WorkflowReferenceTests(unittest.TestCase):
    def test_project_has_no_unresolved_reusable_workflows(self):
        self.assertEqual([], errors_for(PROJECT))
        ci = (PROJECT / '.github/workflows/ci.yml').read_text()
        release = (PROJECT / '.github/workflows/release.yml').read_text()
        self.assertNotIn('uses: ./.github/workflows/deploy-api.yml', ci)
        self.assertNotIn('uses: ./.github/workflows/play.yml', release)
        self.assertIn('npx wrangler deploy', ci)
        self.assertIn('scripts/publish-play.py', release)

    def test_missing_reference_is_rejected(self):
        with TemporaryDirectory() as folder:
            wf = Path(folder) / '.github/workflows'
            wf.mkdir(parents=True)
            (wf / 'ci.yml').write_text('jobs:\n  deploy:\n    uses: ./.github/workflows/deploy-api.yml\n')
            self.assertIn('missing', errors_for(Path(folder))[0])

    def test_target_must_support_workflow_call(self):
        with TemporaryDirectory() as folder:
            wf = Path(folder) / '.github/workflows'
            wf.mkdir(parents=True)
            (wf / 'ci.yml').write_text('jobs:\n  deploy:\n    uses: ./.github/workflows/deploy-api.yml\n')
            (wf / 'deploy-api.yml').write_text('on:\n  workflow_dispatch:\njobs: {}\n')
            self.assertIn('without on.workflow_call', errors_for(Path(folder))[0])
            (wf / 'deploy-api.yml').write_text('on:\n  workflow_call:\njobs: {}\n')
            self.assertEqual([], errors_for(Path(folder)))


if __name__ == '__main__':
    unittest.main()
