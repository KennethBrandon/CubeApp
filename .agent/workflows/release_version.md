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

4. **Build and Release App**
   Now you can proceed with building the app binary for stores.
   ```bash
   npm run build:android
   npx cap open android
   # Then generate Signed Bundle in Android Studio
   ```
