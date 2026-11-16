# Release checklist — Meet in the Middle apps

Adapted from the repfindercanada-mobile setup (same Codemagic account). The
CI/CD lives in `codemagic.yaml` at the repo root.

## One-time setup

### Codemagic
- [ ] Add this repository as a new **application** in Codemagic
      (Apps → Add new app → pick `jiracipika/meet-in-the-middle`).
- [ ] The existing environment groups are reused from repfindercanada:
      `app_store_connect` (ASC API key + `DIST_CERT_PRIVATE_KEY`) and
      `google_play` (`GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`). Verify they are
      visible to the new app (team scope).
- [ ] Android keystore: upload under **Code signing → Android keystores** with
      identifier `akey` (same identifier the yaml expects). You can reuse the
      repfinder keystore or upload a new one — a new one is cleaner for a new
      app id.

### App Store Connect (iOS)
- [ ] The first `release-both` run mints the provisioning profile for
      `com.jiracipika.meetinthemiddle` automatically (`fetch-signing-files
      --create`). The app record for TestFlight is created on first upload;
      if the publishing step complains, create the app manually in
      App Store Connect first (same bundle id).

### Google Play (Android)
- [ ] Create the app in Play Console (package
      `com.jiracipika.meetinthemiddle`) and grant the same service account
      access (Users & permissions — the one whose JSON is in
      `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`).
- [ ] First upload goes to the **internal** track; fill store listing
      (description, screenshots, privacy policy URL) before promoting.

## Every release

1. Bump versions:
   - `mobile/android/app/build.gradle`: `versionCode` +1, `versionName`
   - `mobile/ios/App/App.xcodeproj/project.pbxproj`: `MARKETING_VERSION`,
     `CURRENT_PROJECT_VERSION` (both configs)
2. Push, then start **release-both** in the Codemagic UI (no auto-triggers —
   store uploads never happen by accident).
3. Android: promote internal → closed/open testing in Play Console as needed.
   To promote the same build on CI instead of re-uploading, use
   `google-play tracks promote-release` (re-uploading a used versionCode is
   rejected — that's why the yaml publishes to one track only).
4. iOS: TestFlight appears after processing; submit to review from ASC.

## Testing the pipeline without touching stores

Run **build-artifacts-only** in Codemagic: lint + unit tests, web export,
cap sync, unsigned Android apk + iOS simulator build. Use it for CI checks on
branch work; it needs no credentials.

## Live-site dependency

The apps call the deployed site's API (`/api/geocode`, `/api/venues` — CORS
allowlisted for the app origins in `src/lib/cors.ts`). Export the bundle
against the URL you intend to ship against by default it uses
`https://meetinthemiddlefair.vercel.app`; see `mobile/scripts/export-web.mjs`.
