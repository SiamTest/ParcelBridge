import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/i;
const allChanged = Object.freeze({ app: true, api: true });

async function getJson(request, repo, path, token) {
  const response = await request(`https://api.github.com/repos/${repo}/${path}`, {
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ParcelBridge-automation', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(30000),
  });
  assert.ok(response.ok, `Cannot inspect source changes (${response.status}) for ${path}`);
  return response.json();
}

/**
 * Inspect actual source changes, not workflow-only or documentation changes.
 * push: compare GitHub's push 'before' revision with tested head.
 * release: compare with last published GitHub release; this safely groups commits
 *            across pushes without releasing a new APK on every workflow edit.
 */
export async function projectChanges(env, request = fetch) {
  const repo = env.GITHUB_REPOSITORY;
  const head = env.RELEASE_SOURCE_SHA || env.GITHUB_SHA;
  assert.match(repo ?? '', /^[\w.-]+\/[\w.-]+$/);
  assert.match(head ?? '', SHA, 'Expected tested commit SHA');
  const mode = env.CHANGE_MODE;
  assert.ok(['push', 'release'].includes(mode), 'CHANGE_MODE must be push or release');
  let base;
  if (mode === 'push') {
    base = env.COMMIT_BASE;
    if (!base || /^0{40}$/.test(base)) return allChanged; // new branch initial push
  } else {
    // Find the latest published release, including prereleases (debug test builds).
    // The published release is created with --target <tested commit SHA>.
    const releases = await getJson(request, repo, 'releases?per_page=100', env.GH_TOKEN);
    assert.ok(Array.isArray(releases), 'Invalid GitHub releases response');
    const latest = releases.filter(r => !r.draft && r.published_at)
      .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
    if (latest) {
      base = latest.target_commitish;
      // Older manually-created releases may target a branch name instead of a SHA.
      // In that case, use the parent commit as a conservative fallback.
    }
    if (!base || !SHA.test(base)) {
      const commit = await getJson(request, repo, `commits/${head}`, env.GH_TOKEN);
      base = commit.parents?.[0]?.sha;
      if (!base) return allChanged;
    }
  }
  assert.match(base, SHA, 'Expected baseline commit SHA');
  if (base.toLowerCase() === head.toLowerCase()) return { app: false, api: false };
  const comparison = await getJson(request, repo, `compare/${base}...${head}?per_page=100`, env.GH_TOKEN);
  assert.ok(Array.isArray(comparison.files), 'Invalid GitHub compare response');
  // GitHub compares at most 300 files. Don't silently skip releases if truncated.
  if (comparison.files.length >= 300 || comparison.status === 'diverged') return allChanged;
  return {
    app: comparison.files.some(file => isAppPath(file.filename) || isAppPath(file.previous_filename)),
    api: comparison.files.some(file => isApiPath(file.filename) || isApiPath(file.previous_filename)),
  };
}

function isAppPath(path = '') {
  return path.startsWith('app/') || path.startsWith('gradle/') ||
    ['build.gradle.kts', 'settings.gradle.kts', 'gradle.properties'].includes(path);
}
function isApiPath(path = '') { return path.startsWith('api/'); }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const changes = await projectChanges(process.env);
  assert.ok(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required');
  appendFileSync(process.env.GITHUB_OUTPUT,
    `app_changed=${changes.app}\napi_changed=${changes.api}\n`);
  console.log(`Changes since baseline: Android ${changes.app ? 'yes' : 'no'}, API ${changes.api ? 'yes' : 'no'}`);
}
