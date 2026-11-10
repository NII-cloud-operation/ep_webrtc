# Releasing ep_webrtc

Use `YYYY.M.N` versions and `vYYYY.M.N` tags. `M` has no leading zero.
Start `N` at `0` each month and increment it for subsequent releases.

1. Update `version` in `package.json` and commit the changes to `feature/sfu`.
2. Tag that commit with the matching version and push the commit and tag:
   ```sh
   git tag -a v2026.11.0 -m "Release 2026.11.0"
   git push <remote> feature/sfu
   git push <remote> v2026.11.0
   ```
3. The Tests and Release workflow runs the backend, frontend, and notebook E2E
   tests, checks that the tag matches `package.json`, and creates a draft Release
   with generated release notes.
4. Review and publish the draft Release. GitHub supplies the tagged source as
   ZIP and tar.gz archives. Publishing does not upload a package to npm.

Install from Git using the desired release tag, for example:

```sh
git clone --branch v2026.11.0 https://github.com/NII-cloud-operation/ep_webrtc.git
```
