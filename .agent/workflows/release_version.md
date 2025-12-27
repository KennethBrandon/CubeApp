---
description: Release a new version of the app
---
This workflow describes how to release a new version of the app and publish it to GitHub.

1. **Bump and Tag the Version**
   This command will:
   - Bump the version in `package.json`.
   - Update `android/app/build.gradle`.
   - Create a git commit "Release vX.Y.Z".
   - Create a git tag "vX.Y.Z".

   ```bash
   # Bump patch (0.1.0 -> 0.1.1)
   npm run version:release patch
   
   # Or minor/major
   npm run version:release minor
   ```

2. **Push to GitHub**
   Push the new commit and the tag to GitHub.
   ```bash
   git push && git push --tags
   ```

3. **Create Release on GitHub**
   - Go to the [GitHub Repository Releases page](https://github.com/KennethBrandon/CubeApp/releases).
   - Click "Draft a new release".
   - Choose the tag you just pushed (`vX.Y.Z`).
   - Click "Generate release notes" to automatically fill in changes.
   - Click "Publish release".

4. **Download & Publish**
   - Wait for the "Build Android App" action to finish on GitHub.
   - Go to the **Releases** page on GitHub.
   - Download the `app-release.aab` asset.
   - Upload this file manually to the **Google Play Console** (Internal Testing or Closed Testing track).
   - *Note: In the future, we can automate this upload step too, but the first upload must always be manual.*
