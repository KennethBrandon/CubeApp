---
description: Guide to setting up Google Play Console and uploading your first release
---

# Setting up Google Play Console

## 1. Create a Developer Account
1.  Go to [Google Play Console](https://play.google.com/console).
2.  Sign in with your Google Account.
3.  Accept the Developer Distribution Agreement.
4.  Pay the **$25 one-time registration fee**.
5.  Complete your account details (Identity verification may be required).

## 2. Create Your App
1.  Click **Create app**.
2.  **App Name**: `Cube Vault` (Must match config).
3.  **Default Language**: English (US).
4.  **App or Game**: Game.
5.  **Free or Paid**: Free.
6.  Accept the declarations (Content guidelines, US export laws).
7.  Click **Create app**.

## 3. Initial Setup (Dashboard)
The dashboard will guide you through mandatory steps before you can release. You must complete:
-   **Privacy Policy**: Enter your URL.
-   **App Access**: "All functionality is available without special access".
-   **Ads**: "My app does not contain ads" (or Yes if it does).
-   **Content Rating**: Fill out the questionnaire.
-   **Target Audience**: 13+ (Avoid "Kids" unless you want strict review).
-   **News Apps**: No.
-   **COVID-19**: My app is not a publicly available COVID-19 contact tracing or status app.
-   **Data Safety**: This is complex. Since we have Analytics/Feedback:
    -   Does your app collect or share any of the required user data types? **Yes**.
    -   *We will need to detail exactly what is collected (e.g., App Info, Performance, Crash Logs).*

## 4. Uploading the Release (Internal Testing)
1.  On the left menu, go to **Testing** -> **Internal testing**.
2.  Click **Create new release**.
3.  **Signing Key**:
    -   Google will ask about "Play App Signing".
    -   Click **Choose signing key**.
    -   Select **Use Google-generated key** (Recommended).
    -   *Crucial*: Since we signed our AAB with our `release-key.keystore`, Google will verify it, then strip that signature and sign it with their own key for delivery. This is standard.
4.  **Upload App Bundle**:
    -   Drop the `app-release.aab` you downloaded from GitHub here.
5.  **Release Name**: Enter `0.2.1` (or whatever version it is).
6.  **Release Notes**: Copy from your GitHub release notes.
7.  Click **Next** -> **Save** -> **Start rollout to Internal Testing**.

## 5. Add Testers
1.  In **Internal testing**, go to the **Testers** tab.
2.  Create an email list (add your own email).
3.  Copy the **Join on web** link and open it on your phone to download the app!
