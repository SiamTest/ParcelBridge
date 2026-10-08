const assert = require('node:assert/strict');

module.exports = async function cleanup({ github, context, core, env, now = Date.now() }) {
  const successDays = Number(env.CLEANUP_SUCCESS_DAYS || 1);
  const failureDays = Number(env.CLEANUP_FAILURE_DAYS || 7);
  for (const days of [successDays, failureDays]) assert.ok(Number.isInteger(days) && days >= 1 && days <= 90, 'Cleanup retention must be 1–90 days');
  const workflows = new Set(['ci.yml', 'release.yml', 'deploy-api.yml', 'play.yml', 'cleanup.yml']);
  const removable = run => {
    const finished = Date.parse(run.updated_at);
    const days = ['success', 'skipped', 'neutral'].includes(run.conclusion) ? successDays : failureDays;
    return run.status === 'completed' && run.conclusion && Number(run.id) !== Number(context.runId)
      && workflows.has(run.path?.split('/').pop()) && Number.isFinite(finished)
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
  core.info(`Deleted ${deleted} expired runs and their artifacts. GitHub Releases and active runs are kept.`);
  await core.summary.addRaw(`Deleted ${deleted} expired Actions runs. Success retention: ${successDays} day(s); other completed runs: ${failureDays} day(s).`).write();
  return deleted;
};
