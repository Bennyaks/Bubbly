# Running the backend locally (Firebase Emulator Suite)

Runs Auth, Firestore, Storage and Cloud Functions on your machine. Free, no billing, same code and rules as production.

## Ports (`firebase.json`)
| Service | Port |
|---|---|
| Auth | 9099 |
| Firestore | 8080 |
| Storage | 9199 |
| Functions | 5001 |
| Control panel | 4000 |

## Setup and daily use
1. Java 21+ (`java -version`), `npm install -g firebase-tools`, then `npm install` and `npm run backend:install`.
2. Terminal 1: `npm run emulators:fresh` the first time, `npm run emulators` afterwards. It imports and exports `./emulator-data` (git-ignored) so your test data survives restarts. Wait for "All emulators ready".
3. Terminal 2: `npx expo start -c`, scan the QR code with Expo Go (phone on the same Wi-Fi) or press `w` for web.
4. Control panel: http://localhost:4000 (users, documents, files, function logs).

`firebase.js` finds the laptop's address automatically. If that fails (for example Expo tunnel mode) set `EMULATOR_HOST_OVERRIDE` in `firebase.js`.
Windows firewall: allow Java and Node on private networks.

## Scheduled functions do not run locally. Trigger them by hand
| Job | URL |
|---|---|
| ranking + trending | http://localhost:5001/bubbly-bfef3/us-central1/rankFeedNow |
| cleanup | http://localhost:5001/bubbly-bfef3/us-central1/cleanupNow |
| close stale lives | http://localhost:5001/bubbly-bfef3/us-central1/endStaleNow |
(`bubbly-bfef3` is the Firebase project ID, kept from the old app name. Use the one in `.firebaserc`.)

## Differences from production
- No real emails: reset and verification links are printed in the emulator terminal and shown under Authentication.
- No real push notifications.
- Composite indexes are not enforced.
- Posts store storage paths, not URLs, so a changing laptop IP does not break old videos. Full URLs are written only in production.
- Videos play over plain http.
- Data lives only on your machine.

## Troubleshooting
| Problem | Fix |
|---|---|
| `Could not spawn java` | install Java 21+, open a new terminal |
| Phone cannot connect | same Wi-Fi? firewall? Many campus or public networks block device-to-device traffic: use your phone's hotspot |
| Port already in use | close the old emulator terminal (security-rule tests use the same ports) |
| Upload fails | the alert shows why; Functions log lines starting with `video` have details |

## Using real Firebase instead
Run the app with `EXPO_PUBLIC_USE_EMULATOR=false` (dev project) or `EXPO_PUBLIC_APP_ENV=prod` (production). See DEPLOYMENT.md.
