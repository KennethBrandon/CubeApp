---
description: Set up Android Signing Secrets for GitHub Actions
---
To enable automatic signed builds for Google Play (Release AAB), you need to add secrets to your GitHub repository.

## 1. Generate the Keystore
Run the helper script locally:
```bash
./scripts/generate_keystore.sh
```
Follow the prompts. It will generate `release-key.keystore`.

## 2. Get the Base64 String
Run this command to copy the file content as a base64 string to your clipboard:
```bash
base64 -i release-key.keystore | pbcopy
```
*(On Linux/Windows, use `base64 release-key.keystore` and copy the output manually)*

## 3. Add Config to GitHub
Go to your Repository -> **Settings** -> **Secrets and variables** -> **Actions**.

Click **New repository secret** and add the following 4 secrets:

| Name | Value |
|------|-------|
| `ANDROID_KEYSTORE_BASE64` | *Paste the base64 string from Step 2* |
| `KEYSTORE_PASSWORD` | The password you set during generation |
| `KEY_ALIAS` | `key0` (default in our script) |
| `KEY_PASSWORD` | The same password |

## 4. Done!
Next time you push a tag (e.g. `v0.2.1`), the action will detect these keys and build a signed `app-release.aab`.
