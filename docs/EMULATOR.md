# Run Bubbly's backend free on your laptop (Firebase Emulator Suite)

This runs Auth, Firestore, Storage and your Cloud Functions locally. No card, no Blaze plan.
It uses the same code and the same rules as the real Firebase, so switching later is one setting.

## One-time setup
1. **Java 21 or newer** (the Firestore and Storage emulators need it). Check with `java -version`.
   If missing, install "Temurin 21" from adoptium.net and open a NEW terminal.
2. **Firebase tools:** `npm install -g firebase-tools`
3. **Packages:** in the project folder run `npm install` then `npm run backend:install`

You do NOT need to find or type your laptop's IP address. `firebase.js` detects it from Expo automatically.
(If detection ever fails, for example when using Expo tunnel mode, type the IP into `EMULATOR_HOST_OVERRIDE` in `firebase.js`.)

## Every time you work
Open two terminals in the project folder.

**Terminal 1: the backend**
- First run ever: `npm run emulators:fresh`
- Every run after that (keeps your test data): `npm run emulators`

Wait for "All emulators ready". If Windows asks about the firewall, allow Java and Node on **private** networks.

**Terminal 2: the app**
`npx expo start -c` then scan the QR code with Expo Go (phone on the SAME Wi-Fi as the laptop), or press `w` for web.

**Control panel:** http://localhost:4000 shows users, database documents, uploaded files and live function logs.

## Test it
1. Create an account, pick a username, and upload a short video (5 to 15 seconds).
2. In the panel, Firestore > posts: the post goes `processing` then `ready`. It then shows in the feed.
3. Like, comment and share it. Watch likeCount, commentCount and shareCount change.
4. Message a second account. Try a group chat.
5. Scheduled jobs do not run on a timer locally. Run them by hand:
   - ranking:  http://localhost:5001/bubbly-bfef3/us-central1/rankFeedNow
   - cleanup:  http://localhost:5001/bubbly-bfef3/us-central1/cleanupNow

## Password reset and verification emails
The emulator never sends real emails. After "Forgot password?" or sign-up, the reset or verification LINK is printed in the terminal
where the emulator runs, and listed in the control panel under Authentication. Copy the link into a browser to complete the step.

## Differences from real Firebase
- Scheduled functions do not fire locally (use the two links above).
- Composite indexes are not needed locally; they are needed in production (already in `firestore.indexes.json`).
- No real push notifications yet.
- Videos play over plain http from your laptop. Fine for development only.
- Posts store storage paths, not full links, so changing Wi-Fi or IP does not break old videos.
- Data lives only on your laptop.

## If something goes wrong
- "Could not spawn java": install Java 21+ and open a new terminal.
- Phone cannot connect: same Wi-Fi? Firewall allows Java and Node? Many university and public networks block device-to-device traffic. Use your phone's hotspot and connect the laptop to it.
- "Port already in use": close the old emulator terminal first.
- A warning that Node does not match 20 is harmless for the emulator.
- Upload failed: the alert shows the reason. The Functions log in the panel has lines starting with `video`.

## Switching to real Firebase later
1. In `firebase.js` set `USE_EMULATOR = false`.
2. Follow the deploy steps in docs/BACKEND.md (Blaze plan, region, deploy functions and indexes, then rules).
3. Do not copy local test data across.
