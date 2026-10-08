import test from 'node:test';
import assert from 'node:assert/strict';
import cleanup from './cleanup-runs.cjs';

const now = Date.UTC(2026, 9, 8);
const run = (id, age, conclusion = 'success', status = 'completed', path = '.github/workflows/ci.yml') => ({
  id, conclusion, status, path, updated_at: new Date(now - age * 86400000).toISOString(),
});
function fixture(runs, fresh = {}) {
  const removed = [];
  const rest = { actions: {
    listWorkflowRunsForRepo: () => {},
    getWorkflowRun: async ({ run_id }) => ({ data: fresh[run_id] || runs.find(r => r.id === run_id) }),
    deleteWorkflowRun: async ({ run_id }) => { removed.push(run_id); },
  } };
  let listed = false;
  const github = { rest, paginate: async () => { assert.equal(removed.length, 0); listed = true; return runs; } };
  const context = { repo: { owner: 'SiamTest', repo: 'ParcelBridge' }, runId: 99 };
  const core = { info: () => {}, summary: { addRaw() { return this; }, write: async () => {} } };
  return { args: { github, context, core, env: {}, now }, removed, listed: () => listed };
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
  f.args.env.CLEANUP_SUCCESS_DAYS = '0';
  await assert.rejects(cleanup(f.args), /1–90/);
  assert.deepEqual(f.removed, []);
});
test('already deleted runs are tolerated but permission failures stop cleanup', async () => {
  const f = fixture([run(1, 8)]);
  f.args.github.rest.actions.getWorkflowRun = async () => { throw Object.assign(new Error(), { status: 404 }); };
  assert.equal(await cleanup(f.args), 0);
  f.args.github.rest.actions.getWorkflowRun = async () => { throw Object.assign(new Error('denied'), { status: 403 }); };
  await assert.rejects(cleanup(f.args), /denied/);
});
