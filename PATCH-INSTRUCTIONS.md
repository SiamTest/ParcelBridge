# ParcelBridge v0.2.1 — Yutaka-style GitHub Actions patch

This is an **overlay patch** for `ParcelBridge-0.2.1-startup-recovery.zip` or the matching GitHub repository version, **not a standalone Android project**.

1. Extract the existing ParcelBridge project (or open your GitHub repository).
2. Copy the folders/files from `ParcelBridge-main/` in this patch onto the same relative paths in the existing project, overwriting matching files only.
3. **Do not delete other project files.** Your existing fonts, Android code, Cloudflare Worker, signing files (if any), application resources and version remain unchanged.
4. Commit/push the patched files to `main`, including the hidden `.github/workflows` folder. Open **Actions → Test and build** and verify the pipeline.
5. Open **Actions → Clean completed Actions runs → Run workflow → all_completed** once to delete existing completed runs immediately. Future completed successes are removed automatically; failures are retained for 20 minutes then cleaned by a sweep. GitHub's scheduled triggers may be delayed.
6. Automatic builds on `main` release new APKs only after Android source changes and successful tests. Use **Android release → Run workflow** if you intentionally need to rebuild without Android code changes.

The app and Worker source code were not modified. No app or Worker version bump is included.

The latest signed stable release remains controlled by the existing optional production keystore secrets. Un-signed debug prereleases cannot update stable-signed installations.

**Warning:** Workflow cleanup destroys completed-run logs and CI artifacts. Published GitHub Releases are not deleted. If you need failure diagnostics, retrieve them during the 20-minute retention window or temporarily increase `CLEANUP_FAILURE_MINUTES`.
