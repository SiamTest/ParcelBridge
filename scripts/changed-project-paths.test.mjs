import test from 'node:test';
import assert from 'node:assert/strict';
import { projectChanges } from './changed-project-paths.mjs';

const SHA = { base: 'a'.repeat(40), head: 'b'.repeat(40), older: 'c'.repeat(40) };
const env = { GITHUB_REPOSITORY: 'SiamTest/ParcelBridge', RELEASE_SOURCE_SHA: SHA.head,
  COMMIT_BASE: SHA.base, CHANGE_MODE: 'push' };
const response = data => ({ ok: true, status: 200, json: async () => data });
const mocks = (files, opts = {}) => async url => {
  if (url.includes('/releases?')) return response(opts.releases ?? []);
  if (url.includes('/commits/')) return response({ parents: [{ sha: SHA.base }] });
  if (url.includes('/compare/')) {
    assert.ok(url.includes(`/compare/${opts.expectedBase || SHA.base}...${SHA.head}`), url);
    return response({ status: opts.status || 'ahead', files: files.map(filename => ({ filename })) });
  }
  throw new Error(`Unexpected URL: ${url}`);
};

test('workflow-only and documentation-only changes must not bump app or API versions', async () => {
  assert.deepEqual(await projectChanges(env, mocks(['.github/workflows/cleanup.yml', 'README.md', 'scripts/cleanup-runs.cjs'])), { app: false, api: false });
});
test('app and API changes are detected separately', async () => {
  assert.deepEqual(await projectChanges(env, mocks(['app/src/main/AndroidManifest.xml'])), { app: true, api: false });
  assert.deepEqual(await projectChanges(env, mocks(['api/src/index.ts'])), { app: false, api: true });
  assert.deepEqual(await projectChanges(env, mocks(['gradle/wrapper/gradle-wrapper.properties', 'api/schema.sql'])), { app: true, api: true });
});
test('release comparison uses previous published release instead of only the last commit', async () => {
  const releases = [
    { published_at: '2026-10-08T00:00:00Z', target_commitish: SHA.base, draft: false },
    { published_at: '2026-10-09T00:00:00Z', target_commitish: SHA.older, draft: true },
  ];
  assert.deepEqual(await projectChanges({ ...env, CHANGE_MODE: 'release' }, mocks(['app/build.gradle.kts'], { releases })), { app: true, api: false });
});
test('release first-time fallback uses parent commit', async () => {
  assert.deepEqual(await projectChanges({ ...env, CHANGE_MODE: 'release' }, mocks(['app/src/main/AndroidManifest.xml'])), { app: true, api: false });
});
test('repo initialization with a zero SHA conservatively checks both components', async () => {
  assert.deepEqual(await projectChanges({ ...env, COMMIT_BASE: '0'.repeat(40) }, async () => { throw Error('No API call expected'); }), { app: true, api: true });
});
test('same commit as prior release does not publish again', async () => {
  const releases = [{ published_at: '2026-10-09T00:00:00Z', target_commitish: SHA.head, draft: false }];
  assert.deepEqual(await projectChanges({ ...env, CHANGE_MODE: 'release' }, mocks([], { releases })), { app: false, api: false });
});
test('very large and diverged comparisons fail open rather than missing changes', async () => {
  assert.deepEqual(await projectChanges(env, mocks(Array(300).fill('.github/workflows/ci.yml'))), { app: true, api: true });
  assert.deepEqual(await projectChanges(env, mocks(['README.md'], { status: 'diverged' })), { app: true, api: true });
});
test('untrusted or failed GitHub compare API cannot silently turn off builds', async () => {
  await assert.rejects(projectChanges(env, async () => ({ ok: false, status: 403 })), /Cannot inspect/);
});
