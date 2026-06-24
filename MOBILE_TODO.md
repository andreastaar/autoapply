# iOS & Android App — Pending Tasks

## Status
Capacitor is installed and configured in `frontend/`. Both `ios/` and `android/` 
platform folders were generated. Code ready — needs native tools to build.

## What's done
- [x] `@capacitor/core`, `@capacitor/ios`, `@capacitor/android` installed
- [x] `capacitor.config.ts` created (appId: com.autoapply.app, appName: AutoApply)
- [x] API client auto-detects native vs web and calls Railway backend directly
- [x] `npx cap add ios` → generated `frontend/ios/` project
- [x] `npx cap add android` → generated `frontend/android/` project

## To build iOS app
1. Install Xcode from Mac App Store (free, ~10 GB)
2. Install CocoaPods: `sudo gem install cocoapods`
3. Run:
   ```bash
   cd /Users/andrea_star/autoapply/frontend
   npm run build
   npx cap sync ios
   npx cap open ios
   ```
4. In Xcode: select your iPhone as target → Run

## To build Android app  
1. Install Android Studio: `brew install --cask android-studio`
2. Open Android Studio → SDK Manager → install Android SDK
3. Run:
   ```bash
   cd /Users/andrea_star/autoapply/frontend
   npm run build
   npx cap sync android
   npx cap open android
   ```
4. In Android Studio: Run → select emulator or connected device

## Backend URL
Both apps call: `https://autoapply-production-5b15.up.railway.app`
Configured in: `frontend/src/api/client.ts`

## To publish to App Store / Play Store
- iOS: Need Apple Developer Account ($99/year) → Archive in Xcode → TestFlight
- Android: Need Google Play Console account ($25 one-time) → Generate signed APK
