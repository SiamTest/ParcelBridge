'use strict';

/**
 * Yutaka-style Actions housekeeping. Only completed runs are eligible:
 * - successes/skipped/neutral: immediately after completion
 * - failed/cancelled/timed out/action_required/etc: after 20 minutes
 * - manual all_completed: immediately (including failures)
 *
 * Never delete the running cleanup job or an active/re-run workflow.
 * GitHub Releases and tags are intentionally outside this API.
 */
const assert = require('node:assert/strict');

function nonnegativeMinutes(value, name, fallback) {
  const text = value === undefined || value === '' ? String(fallback) : String(value);
  assert.match(text, /^(?:0|[1-9]\d*)$/, `${name} must be a whole number of minutes`);
  const minutes = Number(text);
  assert.ok(Number.isSafeInteger(minutes) && minutes <= 10080,
    `${name} must be between 0 and 10080 minutes`);
  return minutes;
}

module.exports = async function cleanup({ github, context, core, env, now = Date.now() }) {
  const mode = env.CLEANUP_MODE || 'automatic';
  assert.ok(['automatic', 'all_completed'].includes(mode),
    'Cleanup mode must be automatic or all_completed');
  const successMinutes = nonnegativeMinutes(env.CLEANUP_SUCCESS_MINUTES, 'CLEANUP_SUCCESS_MINUTES', 0);
  const failureMinutes = nonnegativeMinutes(env.CLEANUP_FAILURE_MINUTES, 'CLEANUP_FAILURE_MINUTES', 20);
  const cleanupId = Number(context.runId);

  function eligible(run) {
    if (!run || run.status !== 'completed' || !run.conclusion || Number(run.id) === cleanupId) return false;
    if (mode === 'all_completed') return true;
    const finished = Date.parse(run.updated_at);
    if (!Number.isFinite(finished) || finished > now) return false;
    const successful = ['success', 'neutral', 'skipped'].includes(run.conclusion);
    return now - finished >= (successful ? successMinutes : failureMinutes) * 60000;
  }

  // List all candidates before making any deletions to avoid pagination shifts.
  // Don't limit this to known workflow paths: obsolete/renamed workflows must be cleaned too.
  const runs = await github.paginate(github.rest.actions.listWorkflowRunsForRepo, {
    ...context.repo, status: 'completed', per_page: 100,
  });
  const eligibleRuns = runs.filter(eligible);
  const stats = { deleted: 0, vanished: 0, changed: 0, kept: runs.length - eligibleRuns.length };
  for (const run of eligibleRuns) {
    try {
      // A completed run can be re-run between listing and deleting it.
      const fresh = await github.rest.actions.getWorkflowRun({ ...context.repo, run_id: run.id });
      if (!eligible(fresh.data)) {
        stats.changed++;
        continue;
      }
      await github.rest.actions.deleteWorkflowRun({ ...context.repo, run_id: run.id });
      stats.deleted++;
    } catch (error) {
      // Another cleanup may have removed this run concurrently.
      if (error.status === 404) {
        stats.vanished++;
        continue;
      }
      core.error(`Could not delete Actions run ${run.id}: ${error.message}`);
      throw error;
    }
  }
  const policy = mode === 'all_completed'
    ? 'Manual: remove all completed workflow runs immediately.'
    : `Automatic: successful runs ${successMinutes} minute(s), failed/other runs ${failureMinutes} minute(s).`;
  const summary = [
    '### Actions cleanup',
    policy,
    `- Completed runs inspected: **${runs.length}**`,
    `- Runs deleted: **${stats.deleted}**`,
    `- Still retained: **${stats.kept}**`,
    `- Changed state during cleanup: **${stats.changed}**`,
    `- Already removed elsewhere: **${stats.vanished}**`,
    '',
    'Active/queued runs, this cleanup run and all GitHub Releases are preserved.',
    'GitHub scheduled jobs are best-effort; failures may remain longer than 20 minutes if a schedule is delayed.',
  ].join('\n');
  core.info(summary);
  await core.summary.addRaw(summary).write();
  return stats.deleted;
};
