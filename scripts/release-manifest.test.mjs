import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('automatic tag takes precedence over the main branch name in update manifest', () => {
  const directory = mkdtempSync(join(process.cwd(), 'manifest-test-'));
  try {
    mkdirSync(join(directory, 'release'));
    const apk = Buffer.from('test APK');
    writeFileSync(join(directory, 'release/parcelbridge.apk'), apk);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./release-manifest.mjs', import.meta.url))], {
      cwd: directory, env: { ...process.env, GITHUB_REPOSITORY: 'SiamTest/ParcelBridge', GITHUB_REF_NAME: 'main', RELEASE_TAG: 'v0.1.1002', APP_VERSION_CODE: '1002' }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(readFileSync(join(directory, 'release/update.json'), 'utf8'));
    assert.equal(manifest.versionCode, 1002);
    assert.equal(manifest.versionName, '0.1.1002');
    assert.equal(manifest.apkUrl, 'https://github.com/SiamTest/ParcelBridge/releases/download/v0.1.1002/parcelbridge.apk');
    assert.equal(manifest.sha256, createHash('sha256').update(apk).digest('hex'));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
