# Bubbly

A Telegram + TikTok style social app: short videos with a ranked feed, chats, groups, channels, follows, and live streaming (coming).
Runs on Android, iPhone and web from one Expo codebase. The backend is Firebase, and for development it runs free on your laptop.

## Folder map
```
Bubbly/bubbly/
  App.js                    app screens: login, video feed, upload, channels, profile
  firebase.js               connects the app to Firebase or to the local emulators (auto-detects your laptop)
  src/screens/Chats.js      chats, groups, unread markers
  src/screens/ClaimUsername.js   unique @username
  src/theme.js              shared colors and styles
  firebase.json             Firebase config + emulator ports
  firestore.rules           database security rules
  firestore.indexes.json    database indexes
  storage.rules             video upload rules
  functions/                the backend (Cloud Functions): see docs/BACKEND.md
  docs/                     guides (start with EMULATOR.md)
```

## First-time setup (once)
1. Install Java 21+ (for the emulators), then `npm install -g firebase-tools`
2. In this folder run:  `npm install`   then   `npm run backend:install`
3. The packages added in this update are installed by step 2 (`react-native-safe-area-context`, `expo-constants`)

## Every day
Terminal 1 (backend):  `npm run emulators`
   (very first time ever use `npm run emulators:fresh`)
Terminal 2 (app):      `npx expo start -c`   then scan the QR code with Expo Go (same Wi-Fi), or press `w` for web
Control panel:         http://localhost:4000

You no longer need to type your laptop's IP anywhere. It is detected automatically.

## Guides
- docs/EMULATOR.md   run everything free on your laptop
- docs/BACKEND.md    architecture, data model, every function, deploy steps, limits
- docs/POSTING_FIX.md  history of the video-upload bug and how it is diagnosed
- docs/REVIEW.md     what was reviewed and changed in the latest update
# Bubbly
