import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function releaseVersion(env, request = fetch, now = Date.now()) {
  const repo = env.GITHUB_REPOSITORY;
  assert.match(repo ?? '', /^[\w.-]+\/[\w.-]+$/);
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'ParcelBridge-release' };
  if (env.GH_TOKEN) headers.Authorization = `Bearer ${env.GH_TOKEN}`;
  let latest;
  for (let page = 1; ; page++) {
    const response = await request(`https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`, { headers, signal: AbortSignal.timeout(30000) });
    assert.ok(response.ok, `Cannot inspect previous releases (${response.status})`);
    const releases = await response.json();
    assert.ok(Array.isArray(releases), 'Invalid release listing');
    for (const release of releases.filter(r => !r.draft)) {
      const published = Date.parse(release.published_at);
      assert.ok(Number.isFinite(published), 'Invalid release publication date');
      if (!latest || published > Date.parse(latest.published_at)) latest = release;
    }
    if (releases.length < 100) break;
  }
  let previous = 0;
  if (latest) {
    const asset = latest.assets?.find(a => a.name === 'update.json');
    assert.ok(asset?.browser_download_url?.startsWith(`https://github.com/${repo}/releases/download/`) && asset.browser_download_url.endsWith('/update.json'), 'Previous release has no trusted update manifest');
    const response = await request(asset.browser_download_url, { signal: AbortSignal.timeout(30000) });
    assert.ok(response.ok, 'Cannot read the previous update manifest');
    previous = (await response.json()).versionCode;
    assert.ok(Number.isSafeInteger(previous) && previous > 0, 'Invalid previous version code');
  }
  // A clock-based floor keeps versions increasing across different workflow run counters.
  const versionCode = Math.max(Math.floor(now / 1000) - 1704067200 + 1000000, previous + 1);
  assert.ok(Number.isSafeInteger(versionCode) && versionCode > 0 && versionCode <= 2100000000, 'Android version code exhausted');
  const signed = env.RELEASE_SIGNED !== 'false';
  const tag = env.REQUESTED_TAG || `v0.2.${versionCode}${signed ? '' : '-debug'}`;
  assert.match(tag, /^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/);
  const existing = await request(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers, signal: AbortSignal.timeout(30000) });
  assert.equal(existing.status, 404, existing.ok ? 'This release already exists; published assets are immutable' : `Cannot check release tag (${existing.status})`);
  return { versionCode, versionName: tag.slice(1), tag, prerelease: !signed || tag.includes('-') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = await releaseVersion(process.env);
  appendFileSync(process.env.GITHUB_ENV, `APP_VERSION_CODE=${version.versionCode}\nAPP_VERSION_NAME=${version.versionName}\nRELEASE_TAG=${version.tag}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `tag=${version.tag}\nprerelease=${version.prerelease}\n`);
  console.log(`Preparing ${version.tag} (Android ${version.versionCode})`);
}
