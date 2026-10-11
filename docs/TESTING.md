# Testing

## 1. Automated tests that need nothing running
```
npm test
```
33 tests, a few seconds. They check:
- **Backend logic** (`functions/test/logic.test.js`): ranking formula, hashtag extraction, notification milestones, video rules, username rules.
- **The real video reader** (`functions/test/video.test.js`): makes real video files with ffmpeg (normal, fragmented, cut short, empty,
  the 14-byte file from the old upload bug, missing ffmpeg) and checks each is handled without crashing.
- **Friendly errors** (`src/tests/errors.test.js`): login, sign-up, network, permission and server errors all become one clear sentence,
  and Firebase internals never reach the screen.
- **Validation** (`src/tests/validation.test.js`): the app, the backend and the security rules all agree on username rules.
- **App structure** (`src/tests/architecture.test.js`): screens never call Firebase directly, never show raw errors, every function the app
  calls exists in the backend, every queried collection has a rule, the direct-chat id matches the rule, production settings are guarded.

## 2. Security tests: proving unauthorized access is refused
```
npm run test:rules
```
Needs Java 21 (same as the emulators). It starts the Firestore and Storage emulators with a fake project, runs 50 test cases and stops.
Each case tries something an attacker or a buggy app might do, and checks it fails:
read while signed out; post as someone else; publish directly; fake likes; edit a post; steal or squat a username; claim a reserved name;
hold two usernames; edit another person's profile or settings; read server-only data; follow as someone else; forge a chat id;
read or write another chat; forge a message sender; change another person's read marker; add people to a channel;
post in a channel you do not own; read someone's notifications; create a live from the app; chat in an ended live;
upload a broken or oversized or wrong-type video; upload to another person's folder; overwrite a video.
It also checks the things that MUST work: valid posts, likes, comments, follows, chats, joining a channel, a brand-new user chatting in a live.
If a test fails, either the rules have a gap or a rule is too strict. Send me the failing line.

## 3. Smoke test (after any deploy)
```
npm run smoke                       # against the emulator
SMOKE_ENV=prod FIREBASE_API_KEY=... FIREBASE_PROJECT_ID=... FIREBASE_STORAGE_BUCKET=... npm run smoke   # against production
```
Creates a throwaway account and checks sign-up, username claim, profile, search function, a post draft, five refusals
(fake like count, rename, push tokens, trending list, reserved name), and account deletion. Prints PASS or FAIL per line.

## 4. Offline and network failure scenarios (manual, 10 minutes)
These need a real phone. Use airplane mode, or turn Wi-Fi off, as noted. Expected behaviour is in the right column.
| # | Do this | Expect |
|---|---|---|
| 1 | Open the app, turn on airplane mode | red bar: "You're offline. Changes will sync when you're back online." |
| 2 | Offline: scroll the feed you already loaded | videos already loaded keep showing; no crash |
| 3 | Offline: like a video | heart changes; when you go online the like count rises |
| 4 | Offline: send a chat message | the message is queued; after reconnecting it is delivered |
| 5 | Offline: post a comment | nothing crashes; after reconnecting it appears (if it fails you see "Comment not sent" with your text restored) |
| 6 | Offline: try to log in | message: "No internet connection. Check your network and try again." |
| 7 | Offline: tap "Forgot password?" | the same friendly connection message |
| 8 | Start a video upload, then turn on airplane mode | after a while: "Upload failed", the draft post is removed, no ghost video |
| 9 | Come back online | red bar disappears; feeds refresh by themselves |
| 10 | Stop the emulator while the app is open | the first action shows a friendly "Cannot reach the server" message, not a code |
| 11 | Wrong password, then a made-up email | both say "Wrong email or password." (it must not reveal which emails exist) |
| 12 | Try to claim an existing username, then "admin" | "That username is already taken." and "That username is reserved." |
| 13 | Go live twice in a row | second attempt: "You are already live. End that live first." |
| 14 | Poor connection (move away from Wi-Fi) | calls give up after 20 seconds with a clear message instead of freezing |

Note: a loaded-but-offline Firestore keeps working from memory only while the app stays open. Closing the app offline loses the cache
(persistent offline storage is a later stage and needs a dev build).
