import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseVersion } from './release-version.mjs';

const env = { GITHUB_REPOSITORY: 'SiamTest/ParcelBridge' };
const now = Date.UTC(2026, 9, 8);
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
const manifestUrl = 'https://github.com/SiamTest/ParcelBridge/releases/download/v0.1.0/update.json';
function mock(previous, latestStatus = 200, existingStatus = 404) {
  return async url => url.includes('/releases?')
    ? response(latestStatus, previous === 0 ? [] : [{ published_at: '2026-10-07T00:00:00Z', assets: [{ name: 'update.json', browser_download_url: manifestUrl }] }])
    : url === manifestUrl ? response(200, { versionCode: previous }) : response(existingStatus, {});
}

test('first automatic release has a valid clock-based version and tag', async () => {
  const result = await releaseVersion(env, mock(0), now);
  assert.ok(result.versionCode > 1001);
  assert.equal(result.tag, `v0.1.${result.versionCode}`);
  assert.equal(result.prerelease, false);
});
test('a prior higher version cannot be downgraded after a clock change', async () => {
  const result = await releaseVersion(env, mock(2000000000), now);
  assert.equal(result.versionCode, 2000000001);
});
test('manual tag and prerelease are preserved', async () => {
  const result = await releaseVersion({ ...env, REQUESTED_TAG: 'v1.2.3-beta.1' }, mock(1001), now);
  assert.equal(result.versionName, '1.2.3-beta.1');
  assert.equal(result.prerelease, true);
});
test('test builds receive debug tags and never become stable releases', async () => {
  const result = await releaseVersion({ ...env, RELEASE_SIGNED: 'false' }, mock(1001), now);
  assert.equal(result.tag, `v0.1.${result.versionCode}-debug`);
  assert.equal(result.prerelease, true);
  const manual = await releaseVersion({ ...env, RELEASE_SIGNED: 'false', REQUESTED_TAG: 'v1.2.3' }, mock(1001), now);
  assert.equal(manual.tag, 'v1.2.3');
  assert.equal(manual.prerelease, true);
});
test('network errors and malformed manifests cannot reset the previous version', async () => {
  await assert.rejects(releaseVersion(env, mock(1001, 403), now), /Cannot inspect/);
  await assert.rejects(releaseVersion(env, mock('1001'), now), /Invalid previous/);
  await assert.rejects(releaseVersion(env, mock(2100000000), now), /exhausted/);
  await assert.rejects(releaseVersion(env, mock(1001, 200, 200), now), /immutable/);
});
test('untrusted manifest URL is rejected before fetching it', async () => {
  let calls = 0;
  await assert.rejects(releaseVersion(env, async () => {
    calls++;
    return response(200, [{ published_at: '2026-10-07T00:00:00Z', assets: [{ name: 'update.json', browser_download_url: 'https://attacker.example/update.json' }] }]);
  }, now), /trusted update manifest/);
  assert.equal(calls, 1);
});
test('newest publication includes prereleases, scans all pages, and ignores drafts', async () => {
  const older = { published_at: '2026-10-06T00:00:00Z', assets: [{ name: 'update.json', browser_download_url: manifestUrl }] };
  const newerUrl = manifestUrl.replace('v0.1.0', 'v1.0.0-beta.1');
  const newer = { prerelease: true, published_at: '2026-10-07T00:00:00Z', assets: [{ name: 'update.json', browser_download_url: newerUrl }] };
  const pages = [];
  const result = await releaseVersion(env, async url => {
    if (url.includes('/releases?')) {
      pages.push(url);
      return response(200, url.endsWith('page=1') ? Array(100).fill(older) : [newer, { draft: true, published_at: null }]);
    }
    if (url === newerUrl) return response(200, { versionCode: 2000000001 });
    assert.ok(url.includes('/releases/tags/'));
    return response(404);
  }, now);
  assert.equal(result.versionCode, 2000000002);
  assert.equal(pages.length, 2);
});
