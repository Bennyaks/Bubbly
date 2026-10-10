# Live streaming

Anyone can go live. There is no follower minimum anywhere in the code.

## What works now (Expo Go, emulator, no extra service)
- Go live from the Live tab with a title. Followers get an activity item and a push.
- The room: live chat, viewer count, LIVE / ENDED state, host "End" button.
- Heartbeat: the host app pings every 30 seconds. If it goes silent for 3 minutes the live closes by itself
  (`endStaleLives`, every 5 minutes; locally open http://localhost:5001/bubbly-bfef3/us-central1/endStaleNow).
- Limits: 10 starts per hour and one live at a time per person.

## What is NOT working yet: the video itself
Streaming real video needs WebRTC, and **Expo Go cannot run WebRTC**. Two things are needed:
1. A LiveKit account (free tier; livekit.io). Cloud gives you a URL, an API key and an API secret.
2. A development build of the app (not Expo Go) that includes `@livekit/react-native` and
   `@livekit/react-native-webrtc`. Build it with EAS (`npx eas build --profile development --platform android`),
   which needs a free Expo account. Android builds do not need a Mac.

## Turning it on (when you are ready)
1. Put the three values in `functions/.env.local` for the emulator and `functions/.env` for deploys:
   ```
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=...
   LIVEKIT_API_SECRET=...
   ```
   Restart the emulator. `startLive` and `joinLive` then return real tokens and rooms are marked `video: "livekit"`.
2. In the LiveKit dashboard set the webhook to your `livekitWebhook` function URL.
3. Before the public launch, move the key and secret into Secret Manager
   (`firebase functions:secrets:set LIVEKIT_API_SECRET`) instead of a plain .env file.
4. In the app, replace the placeholder box at the top of `LiveRoom` (src/screens/Live.js) with the LiveKit room view:
   the host publishes camera and microphone, viewers subscribe. I will write this with you once the development build exists.

## Known limits
- Viewer counts rely on the app removing its presence when leaving. If a phone dies, the count can stay one too high.
- A web version of live can use `livekit-client` in the browser, which needs no development build.
