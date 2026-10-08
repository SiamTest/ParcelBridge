const assert = require('node:assert/strict');

module.exports = async function cleanup({ github, context, core, env, now = Date.now() }) {
  const mode = env.CLEANUP_MODE || 'expired';
  assert.ok(['expired', 'all_completed'].includes(mode), 'Cleanup mode must be expired or all_completed');
  const successDays = Number(env.CLEANUP_SUCCESS_DAYS || 1);
  const failureDays = Number(env.CLEANUP_FAILURE_DAYS || 7);
  for (const days of [successDays, failureDays]) assert.ok(Number.isInteger(days) && days >= 0 && days <= 90, 'Cleanup retention must be 0–90 days');
  const workflows = new Set(['ci.yml', 'release.yml', 'deploy-api.yml', 'play.yml', 'cleanup.yml']);
  const removable = run => {
    if (run.status !== 'completed' || !run.conclusion || Number(run.id) === Number(context.runId)) return false;
    if (mode === 'all_completed') return true;
    const finished = Date.parse(run.updated_at);
    const days = ['success', 'skipped', 'neutral'].includes(run.conclusion) ? successDays : failureDays;
    return workflows.has(run.path?.split('@')[0].split('/').pop()) && Number.isFinite(finished)
      && now - finished >= days * 86400000;
  };
  // Collect all pages before deleting; deleting during pagination shifts later pages.
  const runs = await github.paginate(github.rest.actions.listWorkflowRunsForRepo, { ...context.repo, status: 'completed', per_page: 100 });
  let deleted = 0;
  for (const run of runs.filter(removable)) {
    try {
      const fresh = await github.rest.actions.getWorkflowRun({ ...context.repo, run_id: run.id });
      if (!removable(fresh.data)) continue; // A user may have rerun it since the listing.
      await github.rest.actions.deleteWorkflowRun({ ...context.repo, run_id: run.id });
      deleted++;
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }
  const details = mode === 'all_completed'
    ? 'All completed runs selected, including retired workflows. The current cleanup and active runs are kept.'
    : `Success retention: ${successDays} day(s); other completed runs: ${failureDays} day(s). Recent or unrelated runs are kept. To clean recent runs now, run this workflow manually with mode all_completed.`;
  const summary = `Deleted ${deleted} of ${runs.length} inspected Actions runs and their artifacts. Mode: ${mode}. ${details} GitHub Releases are kept.`;
  core.info(summary);
  await core.summary.addRaw(summary).write();
  return deleted;
};
