# Zeva

A short-video + messaging social app (TikTok-style feed, Telegram-style chats, groups and channels, follows, live rooms).
One Expo / React Native codebase runs on Android, iOS and web. The backend is Firebase (Auth, Firestore, Storage, Cloud Functions).
In development the whole backend runs free on your laptop through the Firebase Emulator Suite.

> **Legacy name:** the Firebase project ID is still `bubbly-bfef3` (the app's former name). Firebase project IDs cannot be renamed.
> It appears in `.firebaserc`, `firebase.js`, `scripts/smoke.js` and the emulator URLs in the docs. Leave it unless you migrate to a new project
> (see docs/DEPLOYMENT.md, "Moving to a different Firebase project").

## Where things are
```
zeva/
  App.js, index.js            app shell (login, tabs, screen stack)
  firebase.js                 Firebase config; auto-connects to the emulators in dev
  src/services/               ALL Firebase and Cloud Function calls from the app (screens never import firebase directly)
  src/screens, components/    UI
  functions/                  Cloud Functions backend (32 functions)  -> docs/BACKEND.md
  firestore.rules             Firestore security rules
  storage.rules               Storage security rules
  firestore.indexes.json      Composite indexes (needed in production, not in the emulator)
  firebase.json  .firebaserc  emulator ports, deploy targets, project aliases (dev / prod)
  tests/                      security-rule tests (need emulators)
  scripts/smoke.js            end-to-end check of a running backend
  docs/                       see below
```

## Quick start
Prerequisites: Node 20+, Java 21+ (emulators), `npm install -g firebase-tools`.
```
npm install
npm run backend:install          # installs functions/ dependencies
npm run emulators:fresh          # terminal 1, first run only. Afterwards: npm run emulators
npx expo start -c                # terminal 2; scan the QR code or press w for web
```
Emulator control panel: http://localhost:4000

## Commands
| Command | Purpose |
|---|---|
| `npm test` | 33 unit and structure tests, no emulator needed |
| `npm run test:rules` | 50 security-rule tests (starts its own emulators) |
| `npm run smoke` | end-to-end check against a running backend |
| `npm run emulators` / `emulators:fresh` | local backend, with / without previously saved data |
| `npm run deploy:dev` / `deploy:prod` | deploy to the dev / prod Firebase project |

## Docs (read in this order)
| File | What it covers |
|---|---|
| docs/BACKEND.md | what the backend contains: every function, flows, config values, maintenance gotchas |
| docs/TESTING.md | how to test the backend end to end, for someone new to the code |
| docs/DATA_MODEL.md | collections, who may read/write what, indexes, pagination |
| docs/EMULATOR.md | running and debugging the local backend |
| docs/DEPLOYMENT.md | environments, release steps, monitoring, backups, rollback |
| docs/LIVE.md | live rooms: what works, how to enable real video |
| docs/APP_GUIDE.md | screens and the service layer of the app |
