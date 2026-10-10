# Review of the project and what changed

## What I found in your zip
- All earlier fixes were present (new rules, functions, native file upload, the emulator setup).
- `firebase.js` and `functions/.env.local` still had the placeholder `YOUR_LAPTOP_IP`. Anyone who copies a pack over
  their project loses the real IP, and the IP changes between Wi-Fi networks, so this kept breaking.
- The database stored video links with your laptop's IP baked in, so every old video broke when the IP changed.
- The bottom bar and top overlays ignored the phone's navigation buttons and status bar.
- Old clutter: `package.json.bak`, `package-lock.json.bak`, three `firebase-export-*` folders, debug logs, and a
  stage 1 README that no longer matched the app.
- Your saved test data shows two failed uploads that each arrived as 14 bytes (the old upload method). No video
  has been stored successfully yet, so the round 3 native upload is still unproven on your phone.

## What I changed
**firebase.js**: the laptop address is detected automatically from Expo (override available). Added helpers
`mediaUrl`, `videoSrc`, `thumbSrc`. `USE_EMULATOR` and `EMULATOR_HOST` are exported.

**functions/index.js**: posts now store `videoPath/videoToken/thumbPath/thumbToken` instead of a baked-in URL.
New: `recordShare`, `addGroupMembers`, `leaveGroup`, `cleanupStale`, `cleanupNow`. `.env.local` is no longer needed.

**App.js**: videos play from `videoSrc(post)`, share button counts shares, safe-area handling so the bottom bar sits
above the phone's navigation buttons and screens sit below the status bar.

**src/screens/Chats.js**: top padding adjusted for the safe-area change.

**package.json**: added `react-native-safe-area-context` and `expo-constants` (the versions Expo SDK 57 expects) and
scripts `emulators`, `emulators:fresh`, `backend:install`. **.gitignore** now ignores emulator data, logs, backups.

**Docs**: new README, rewritten EMULATOR.md, BACKEND.md updated with the function table.

## Checked
- Every file compiles; the backend loads and exports all 22 functions.
- NOT tested on a real phone or against the running emulator (not possible in this environment).

## Known gaps (next)
- The 14-byte upload: confirm round 3 works. If not, the server log now prints what the tiny file contains.
- Screens for follow/unfollow, public profiles, hashtag and user search (the backend for all three exists).
- Live streaming (live.js is written but switched off until LiveKit is set up).
- Photos and voice notes in chats; push notifications on the device; the design pass.
- You mentioned an unspecified error in Expo Go. Send me its text and I will fix it.


---
# Update: header, search, friends, inbox, comments, live
Everything from the previous update was confirmed working on a phone (connection, posting, layout).

**Added (app)**: top bar with search and profile at the top right; bottom tabs Home / Friends / + / Inbox / Live; For You and
Following feeds; public profiles with follow, message, report, edit profile; Friends screen; Search by username and #hashtag with
trending tags; Inbox with Chats (filters, pin, mute, archive, unread counts), Activity and Channels; group management; richer
comments; Live tab and live room; Android back button handling.
**Added (backend)**: activity notifications (`notifications/{uid}/items`), chat preferences with muted chats staying silent,
live rooms with chat, viewers, heartbeat and automatic closing, follower notifications for lives. 32 functions in total.
**Reorganized**: App.js was one 370-line file; it is now a small shell with screens in `src/screens` and shared parts in `src/`.
**Removed**: docs/CLIENT_PATCH.md (all of its changes were applied long ago).

**Checked**: every file compiles, all 64 local imports resolve, and the backend loads all 32 functions.
**Not checked**: running on a phone or against the emulator, and the new security rules (the rules tester needs the emulator).
Expect a few small bugs on first run; send me the message and I will fix them.
