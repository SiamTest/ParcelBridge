"""Check same-repository reusable-workflow references before publishing changes.

GitHub validates `jobs.<id>.uses` before starting any jobs, so a reference
not present in the commit makes the entire calling workflow invalid.
"""

from pathlib import Path
import re
import sys

WORKFLOW_USES = re.compile(
    r'^\s+uses:\s*["\']?(\./\.github/workflows/[A-Za-z0-9_.-]+\.ya?ml)["\']?\s*(?:#.*)?$',
    re.MULTILINE,
)
CALL_ENTRY = re.compile(r'^  workflow_call:\s*(?:#.*)?$', re.MULTILINE)


def errors_for(root: Path) -> list[str]:
    workflow_dir = root / '.github' / 'workflows'
    problems = []
    for workflow in sorted((*workflow_dir.glob('*.yml'), *workflow_dir.glob('*.yaml'))):
        for ref in WORKFLOW_USES.findall(workflow.read_text(encoding='utf-8')):
            target = root / ref
            if not target.is_file():
                problems.append(f'{workflow.relative_to(root)} references missing {ref}')
            elif not CALL_ENTRY.search(target.read_text(encoding='utf-8')):
                problems.append(f'{workflow.relative_to(root)} references {ref} without on.workflow_call')
    return problems


if __name__ == '__main__':
    project_root = Path(__file__).resolve().parent.parent
    problems = errors_for(project_root)
    if problems:
        for problem in problems:
            print(f'::error::{problem}', file=sys.stderr)
        raise SystemExit(1)
    print('All local reusable-workflow references resolve.')
