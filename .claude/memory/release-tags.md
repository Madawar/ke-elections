Release tags cannot be pushed from Claude Code cloud sessions for this repo; the owner pushes them.

**What was seen (2026-11-27, v0.3.0):** from a cloud session, pushing branches works (`main`,
`develop`, `feature/*`), but `git push origin v0.3.0` was refused with HTTP 403 on the push
request. GitHub has no separate permission for tags, so there is nothing more to grant on the
GitHub side; the owner pushed the tag from their own machine. Deleting a remote branch from a
cloud session has not been tried.

**How to apply, in a git flow release:**
1. Do the whole release as usual: merge the feature branch into `develop` (`--no-ff`), make
   `release/x.y.z` with `chore(release): changelog for x.y.z`, merge it into `main` (`--no-ff`,
   "Merge branch 'release/x.y.z'"), merge back into `develop`, and push `main` and `develop`.
2. Try the tag once: `git tag -a vX.Y.Z -m "vX.Y.Z" <the merge commit on main>` and
   `git push origin vX.Y.Z`. If it is refused, do not retry and do not work around it.
3. Tell the owner the tag is not on the remote and give these commands for their machine:

   ```bash
   git fetch origin
   git tag -a vX.Y.Z -m "vX.Y.Z" origin/main
   git push origin vX.Y.Z
   ```

4. Leave merged feature branches on the remote unless the owner asks for them to be deleted; to
   delete one from their machine: `git push origin --delete feature/<name>`.

Tags are annotated, named `vX.Y.Z` with the message `vX.Y.Z`, on the merge commit of the release
branch into `main`.
