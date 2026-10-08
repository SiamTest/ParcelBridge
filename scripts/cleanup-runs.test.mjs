import test from 'node:test';
import assert from 'node:assert/strict';
import cleanup from './cleanup-runs.cjs';

const now = Date.UTC(2026, 9, 8);
const run = (id, age, conclusion = 'success', status = 'completed', path = '.github/workflows/ci.yml') => ({
  id, conclusion, status, path, updated_at: new Date(now - age * 86400000).toISOString(),
});
function fixture(runs, fresh = {}) {
  const removed = [];
  const messages = [];
  const rest = { actions: {
    listWorkflowRunsForRepo: () => {},
    getWorkflowRun: async ({ run_id }) => ({ data: fresh[run_id] || runs.find(r => r.id === run_id) }),
    deleteWorkflowRun: async ({ run_id }) => { removed.push(run_id); },
  } };
  let listed = false;
  const github = { rest, paginate: async () => { assert.equal(removed.length, 0); listed = true; return runs; } };
  const context = { repo: { owner: 'SiamTest', repo: 'ParcelBridge' }, runId: 99 };
  const core = { info: message => messages.push(message), summary: { addRaw(message) { messages.push(message); return this; }, write: async () => {} } };
  return { args: { github, context, core, env: {}, now }, removed, messages, listed: () => listed };
}

test('only expired completed runs of ParcelBridge workflows are removed', async () => {
  const f = fixture([run(1, 2), run(2, 0.5), run(3, 2, 'failure'), run(4, 8, 'failure'),
    run(5, 8, 'cancelled'), run(6, 8, null, 'in_progress'), run(99, 8), run(7, 8, 'success', 'completed', '.github/workflows/unrelated.yml')]);
  assert.equal(await cleanup(f.args), 3);
  assert.deepEqual(f.removed, [1, 4, 5]);
  assert.equal(f.listed(), true);
});
test('rerunning and recently updated runs survive a stale listing', async () => {
  const f = fixture([run(1, 8), run(2, 8)], { 1: run(1, 8, null, 'in_progress'), 2: run(2, 0.1) });
  assert.equal(await cleanup(f.args), 0);
});
test('invalid retention cannot delete anything', async () => {
  const f = fixture([run(1, 8)]);
  f.args.env.CLEANUP_SUCCESS_DAYS = '-1';
  await assert.rejects(cleanup(f.args), /0–90/);
  assert.deepEqual(f.removed, []);
});
test('workflow paths with a ref suffix still match the cleanup filter', async () => {
  const f = fixture([run(1, 8, 'success', 'completed', '.github/workflows/ci.yml@refs/heads/main'),
    run(2, 8, 'failure', 'completed', '.github/workflows/release.yml@main'),
    run(3, 8, 'success', 'completed', '.github/workflows/unrelated.yml@main')]);
  assert.equal(await cleanup(f.args), 2);
  assert.deepEqual(f.removed, [1, 2]);
});
test('manual all-completed mode deletes recent and retired workflow runs', async () => {
  const f = fixture([run(1, 0.001), run(2, 0.001, 'failure'), run(3, 0.001, 'cancelled'),
    run(4, 0.001, 'success', 'completed', '.github/workflows/retired-deploy.yml@main'),
    run(99, 8), run(5, 0, null, 'in_progress'), run(6, 0, null, 'queued')]);
  f.args.env.CLEANUP_MODE = 'all_completed';
  assert.equal(await cleanup(f.args), 4);
  assert.deepEqual(f.removed, [1, 2, 3, 4]);
  assert.ok(f.messages[0].includes('Mode: all_completed'));
});
test('manual cleanup rechecks rerun status before deleting', async () => {
  const f = fixture([run(1, 0.001)], { 1: run(1, 0, null, 'in_progress') });
  f.args.env.CLEANUP_MODE = 'all_completed';
  assert.equal(await cleanup(f.args), 0);
});
test('zero-day retention enables immediate automatic cleanup', async () => {
  const f = fixture([run(1, 0.001), run(2, 0.001, 'failure'), run(3, 0.001, 'cancelled')]);
  f.args.env = { CLEANUP_SUCCESS_DAYS: '0', CLEANUP_FAILURE_DAYS: '0' };
  assert.equal(await cleanup(f.args), 3);
  assert.deepEqual(f.removed, [1, 2, 3]);
});
test('expired mode explains why recent runs were kept and invalid modes stop', async () => {
  const f = fixture([run(1, 0.001), run(2, 0.001, 'failure')]);
  assert.equal(await cleanup(f.args), 0);
  assert.ok(f.messages[0].includes('run this workflow manually with mode all_completed'));
  f.args.env.CLEANUP_MODE = 'unknown';
  await assert.rejects(cleanup(f.args), /Cleanup mode/);
  assert.deepEqual(f.removed, []);
});
test('already deleted runs are tolerated but permission failures stop cleanup', async () => {
  const f = fixture([run(1, 8)]);
  f.args.github.rest.actions.getWorkflowRun = async () => { throw Object.assign(new Error(), { status: 404 }); };
  assert.equal(await cleanup(f.args), 0);
  f.args.github.rest.actions.getWorkflowRun = async () => { throw Object.assign(new Error('denied'), { status: 403 }); };
  await assert.rejects(cleanup(f.args), /denied/);
});
