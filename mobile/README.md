# Meet in the Middle — mobile apps

Capacitor shells that package the web app as native iOS/Android apps. The UI
is the exact same codebase as the website: `scripts/export-web.mjs` exports it
as static files into `www/`, and the apps call the deployed site's API for
address search and nearby venues (CORS is allowlisted for the app origins in
`src/lib/cors.ts`).

## One-time setup

- **iOS**: Xcode + CocoaPods. If `xcodebuild` complains about "command line
  tools", run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **Android**: Android Studio (which installs the SDK), or set `ANDROID_HOME`.
- Run `npm install` in this directory.

## Everyday workflow

From this directory:

```bash
npm run sync       # re-export the web UI from the parent app + cap sync
npm run open:ios   # open in Xcode → pick a simulator → Run
npm run open:android  # open in Android Studio → Run
```

After changing web code only: `npm run sync`, then re-run from the IDE.
The export script accepts a site URL override for testing:

```bash
node scripts/export-web.mjs https://your-preview.vercel.app
```

`www/` is generated — never edit it by hand, it is not committed.

## Device capabilities

| Feature | How |
| --- | --- |
| Find me (GPS) | `@capacitor/geolocation` (iOS usage string + Android permissions are already configured) |
| Share plan | `@capacitor/share` sheet; links point at the website |
| Copy link | `@capacitor/clipboard` |
| Open in Google Maps | `@capacitor/browser` |

All native paths live in `src/lib/native.ts` in the parent app; on the website
the same code uses the standard browser APIs.

## App identity

- App ID: `com.jiracipika.meetinthemiddle` (change in `capacitor.config.ts`,
  then delete/re-add the platforms, before store submission)
- Name: Meet in the Middle
- Icons/splash: generated from `assets/icon.png` + `assets/splash.png` with
  `npx @capacitor/assets generate --assetPath assets`

## Store submission (outline)

1. iOS: Apple Developer Program ($99/yr) → in Xcode set a team, archive,
   upload via App Store Connect, fill the listing. Location usage string is
   already in `ios/App/App/Info.plist`.
2. Android: Google Play developer account ($25 once) →
   `cd android && ./gradlew bundleRelease` (or Android Studio → Generate
   Signed Bundle), upload to Play Console.
3. Version bumps: `versionCode`/`versionName` in
   `android/app/build.gradle`, and `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`
   in `ios/App/App.xcodeproj`.
