import test from 'node:test';
import assert from 'node:assert/strict';
import cleanup from './cleanup-runs.cjs';

const now = Date.UTC(2026, 9, 9);
const run = (id, minutes, conclusion = 'success', status = 'completed', path = '.github/workflows/ci.yml') => ({
  id, conclusion, status, path, updated_at: new Date(now - minutes * 60000).toISOString(),
});
function fixture(runs, fresh = {}) {
  const removed = [], messages = [], errors = [];
  const rest = { actions: {
    listWorkflowRunsForRepo: () => {},
    getWorkflowRun: async ({ run_id }) => ({ data: fresh[run_id] || runs.find(r => r.id === run_id) }),
    deleteWorkflowRun: async ({ run_id }) => { removed.push(run_id); },
  } };
  const github = { rest, paginate: async (_, opts) => {
    assert.equal(opts.status, 'completed');
    assert.equal(opts.per_page, 100);
    assert.equal(removed.length, 0);
    return runs;
  } };
  const context = { repo: { owner: 'SiamTest', repo: 'ParcelBridge' }, runId: 99 };
  const core = { info: message => messages.push(message), error: message => errors.push(message),
    summary: { addRaw(message) { messages.push(message); return this; }, write: async () => {} } };
  return { args: { github, context, core, env: {}, now }, removed, messages, errors };
}

test('successful, skipped and neutral runs are deleted immediately; failures wait 20 minutes', async () => {
  const f = fixture([run(1, 0), run(2, 0, 'skipped'), run(3, 0, 'neutral'),
    run(4, 19, 'failure'), run(5, 20, 'failure'), run(6, 21, 'cancelled'),
    run(7, 5, 'timed_out'), run(8, 30, null, 'in_progress'), run(9, 50, null, 'queued'),
    run(99, 50)]);
  assert.equal(await cleanup(f.args), 5);
  assert.deepEqual(f.removed, [1, 2, 3, 5, 6]);
  assert.match(f.messages[0], /20 minute\(s\)/);
});

test('retired and renamed workflows are automatically cleaned', async () => {
  const f = fixture([run(1, 0, 'success', 'completed', '.github/workflows/retired-workflow.yml'),
    run(2, 24, 'failure', 'completed', '.github/workflows/old-deploy.yml')]);
  assert.equal(await cleanup(f.args), 2);
  assert.deepEqual(f.removed, [1, 2]);
});

test('manual all-completed immediately clears failure logs but not active or current jobs', async () => {
  const f = fixture([run(1, 0.01, 'failure'), run(2, 0, 'success'), run(3, 50, null, 'in_progress'), run(99, 40)]);
  f.args.env.CLEANUP_MODE = 'all_completed';
  assert.equal(await cleanup(f.args), 2);
  assert.deepEqual(f.removed, [1, 2]);
});

test('check fresh run state before deletion, including rerun and newly updated jobs', async () => {
  const f = fixture([run(1, 40, 'failure'), run(2, 40, 'failure')], {
    1: run(1, 0, null, 'in_progress'), 2: run(2, 1, 'failure'),
  });
  assert.equal(await cleanup(f.args), 0);
  assert.deepEqual(f.removed, []);
});

test('never delete a run with a future timestamp or absent completion time', async () => {
  const f = fixture([run(1, -1), { ...run(2, 50), updated_at: null }]);
  assert.equal(await cleanup(f.args), 0);
});

test('tunable minute retention uses numeric zero correctly', async () => {
  const f = fixture([run(1, 0, 'failure'), run(2, 0, 'success')]);
  f.args.env = { CLEANUP_SUCCESS_MINUTES: '0', CLEANUP_FAILURE_MINUTES: '0' };
  assert.equal(await cleanup(f.args), 2);
});

test('invalid retention configuration never deletes anything', async () => {
  for (const bad of ['-1', '2.5', '999999', 'abc']) {
    const f = fixture([run(1, 30)]);
    f.args.env.CLEANUP_FAILURE_MINUTES = bad;
    await assert.rejects(cleanup(f.args), /must/);
    assert.deepEqual(f.removed, []);
  }
});

test('racing concurrent cleanup tolerates already deleted runs', async () => {
  const f = fixture([run(1, 35)]);
  f.args.github.rest.actions.deleteWorkflowRun = async () => { throw Object.assign(new Error(), { status: 404 }); };
  assert.equal(await cleanup(f.args), 0);
  assert.match(f.messages[0], /Already removed elsewhere: \*\*1\*\*/);
});

test('API permission errors fail the workflow instead of reporting fake success', async () => {
  const f = fixture([run(1, 35)]);
  f.args.github.rest.actions.deleteWorkflowRun = async () => { throw Object.assign(new Error('Forbidden'), { status: 403 }); };
  await assert.rejects(cleanup(f.args), /Forbidden/);
  assert.match(f.errors[0], /Could not delete Actions run 1/);
});

test('invalid cleanup mode fails before mutation', async () => {
  const f = fixture([run(1, 35)]);
  f.args.env.CLEANUP_MODE = 'invalid';
  await assert.rejects(cleanup(f.args), /Cleanup mode/);
  assert.deepEqual(f.removed, []);
});
