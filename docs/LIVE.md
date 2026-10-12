# Live streaming

Anyone can go live; there is no follower requirement anywhere. Code: `functions/live.js`, `src/services/lives.js`, `src/screens/Live.js`.

## Works now (Expo Go and emulator, no extra service)
- Go live from the Live tab with a title. Followers get an activity item and a push (first 500).
- Room: live chat (≤200 chars, only while `status == live`), viewer count, LIVE/ENDED state, host End button.
- Host app calls `liveHeartbeat` every 30 s. No heartbeat for 3 min and `endStaleLives` (every 5 min) closes the room. Locally open `endStaleNow`.
- Limits: 10 starts per hour, one live at a time per user.
- `lives/{id}.video` is `livekit` when configured, otherwise `none`; `startLive`/`joinLive` then return `token: null`.

## Not working yet: the video itself
Needs WebRTC, which Expo Go cannot run. Requires a LiveKit account (url, API key, secret) and a development build including `@livekit/react-native` and `@livekit/react-native-webrtc` (`npx eas build --profile development --platform android`).

## Enabling video
1. Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `functions/.env.local` (emulator) or `functions/.env` (deploy); template in `functions/.env.example`. Restart the emulator.
2. In the LiveKit dashboard set the webhook to the `livekitWebhook` function URL (it ends the live on `room_finished`).
3. Replace the placeholder box at the top of `LiveRoom` in `src/screens/Live.js` with the LiveKit room view (host publishes, viewers subscribe).
4. Move key and secret to Secret Manager before launch.

## Known limits
- Viewer count relies on the app deleting its presence document; a dead phone can leave it one too high.
- A web version can use `livekit-client` without a development build.
