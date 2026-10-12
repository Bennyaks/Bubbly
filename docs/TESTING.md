# Testing the backend (start here if you just received the code)

Four layers, from fastest to most realistic. Run them in this order.

| # | Layer | Command | Needs | Proves |
|---|---|---|---|---|
| 1 | Unit and structure tests (33) | `npm test` | Node, `npm run backend:install` | business logic, video reader, error messages, app/backend/rules stay consistent |
| 2 | Security-rule tests (50) | `npm run test:rules` | Java 21, firebase-tools | unauthorized reads/writes are refused, valid ones work |
| 3 | Smoke test (12 checks) | `npm run smoke` | running emulators | real sign-up, rules, a callable and account deletion work together |
| 4 | Manual end-to-end | emulators + app + control panel | phone or web | triggers, pipeline and schedules (section 4) |

## 1. One-time setup
```
node -v                          # 20 or newer
java -version                    # 21 or newer (emulators only)
npm install -g firebase-tools
npm install                      # app + test dependencies
npm run backend:install          # functions/ dependencies (includes ffmpeg-static)
```
A warning that your Node version differs from the functions' Node 20 is harmless locally.

## 2. Layer 1: `npm test` (seconds, nothing running)
Expected: `# pass 33`, `# fail 0`, `# skipped 0`. If 5 tests are skipped, `ffmpeg-static` is missing: run `npm run backend:install`.

| File | Covers |
|---|---|
| `functions/test/logic.test.js` | ranking formula, hashtag extraction, notification milestones, video limits, username rules |
| `functions/test/video.test.js` | the real video reader on files made with ffmpeg: normal, fragmented, truncated, empty, 14-byte file, missing ffmpeg |
| `src/tests/errors.test.js` | every failure becomes one friendly sentence; Firebase internals never reach the screen |
| `src/tests/validation.test.js` | app, backend and rules agree on username rules and the reserved list |
| `src/tests/architecture.test.js` | screens never import Firebase directly; every callable the app uses exists in `functions/`; every queried collection has a rule; `dmId` matches the rules; production config is guarded |

## 3. Layer 2: `npm run test:rules`
Starts Firestore and Storage emulators with a fake project (`demo-zeva`), runs `tests/rules.test.js`, stops them.
- **Stop your normal emulators first**: both use ports 8080 and 9199 (see `firebase.json`).
- Each case tries something an attacker or buggy app might do (read signed out, post as someone else, fake counters, squat a username, forge a chat id, write into another user's chat, upload an oversized or wrong-type video...) and asserts it fails. Others assert the legitimate path still works.
- A failure means a rule has a gap or is too strict. The message names the case; fix `firestore.rules` / `storage.rules`.
- After changing any rule, add a test to `tests/rules.test.js` (helpers: `as(uid)`, `anon()`, `seed()`, `assertFails`, `assertSucceeds`).

## 4. Layer 3 and 4: run the backend and exercise it
Terminal 1: `npm run emulators:fresh` (first time) or `npm run emulators`. Wait for "All emulators ready". Control panel: http://localhost:4000.

**Smoke test** (terminal 2): `npm run smoke`. It signs up a throwaway user, claims a username, edits the profile, calls `searchUsers`, creates a post draft, checks five things are refused (fake like count, rename, push tokens, trending list, reserved name) and deletes the account through `deleteMyAccount`. Expect `12 of 12 checks passed` and exit code 0. It never uploads a video, so the video pipeline needs the manual check below.

**Manual checks** (use the app on a phone/web, or the control panel). `Now` URLs are `http://localhost:5001/bubbly-bfef3/us-central1/<name>`.

| Feature | Do this | Expect (control panel) |
|---|---|---|
| Video pipeline | sign up, claim a username, upload a 5–15 s video | Firestore `posts/{id}`: `processing` → `ready`, with `thumbPath`, `durationSec`, `hashtags`; Storage has `videos/` and `thumbs/` files; Functions log line `video {id}: storage says N bytes` |
| Failed upload | upload an empty or corrupt file | post becomes `failed` with an `error`, file deleted |
| Counters | with a second account, like, comment, follow | `likeCount`, `commentCount`, `followerCount/followingCount` change; `notifications/{uid}/items` gets items |
| Views and shares | watch a video to the end, share it twice | `viewCount` +1 once, `completeCount` +1, `shareCount` +1 once |
| Messaging | direct chat, then a group between 2–3 accounts | `lastMessage` set, other members' `unread.{uid}` incremented; muted chat gets no push |
| Group admin | owner adds a user; a member leaves; owner leaves | members change; ownership passes on; last one out deletes the group |
| Channels | create channel, join with another account, post as owner | members read; only the owner can post |
| Ranking | open `rankFeedNow` | `score` updated on ready posts; `meta/trending` rebuilt |
| Cleanup | open `cleanupNow` | old stuck/failed posts handled |
| Moderation | report the same video from 5 accounts | post `status` becomes `removed` |
| Live | Live tab, go live; second account joins and chats | `lives/{id}` created, `viewerCount` moves, followers get an activity item; stop sending heartbeats (close the app), wait 3 min, open `endStaleNow`; status becomes `ended` |
| Account deletion | Settings > Delete my account | profile, username, videos, files, follows and Auth user are gone; direct-chat messages remain |
| Email links | sign up or "Forgot password?" | the emulator prints the link in its terminal and under Authentication |

Push notifications are not delivered locally (no real device tokens); verify them against a deployed dev project.

## 5. Production-like check (after any deploy)
```
npm run deploy:dev
SMOKE_ENV=prod FIREBASE_API_KEY=... FIREBASE_PROJECT_ID=... FIREBASE_STORAGE_BUCKET=... npm run smoke
```
(`SMOKE_ENV=prod` just means "talk to a real project": use it for dev too.) Then confirm in the console: published rules match the files, all indexes are Enabled, all 32 functions listed without errors.

## 6. Before every release
`npm test` and `npm run test:rules` pass → deploy dev → smoke on dev → deploy prod → smoke on prod (DEPLOYMENT.md).

## 7. Offline and bad-network checks (manual, needs a phone)
| Do this | Expect |
|---|---|
| Airplane mode with the app open | red bar "You're offline..." |
| Offline: scroll an already loaded feed | loaded videos still show, no crash |
| Offline: like / send a chat message | applied locally, delivered after reconnecting |
| Offline: post a comment | no crash; if it fails, "Comment not sent" and the text is restored |
| Offline: log in or "Forgot password?" | "No internet connection. Check your network and try again." |
| Start an upload, then go offline | "Upload failed", draft post removed, no ghost video |
| Back online | bar disappears, feeds refresh |
| Stop the emulator while the app is open | friendly "Cannot reach the server", no raw error codes |
| Wrong password vs unknown email | both: "Wrong email or password." |
| Claim a taken name, then `admin` | "That username is already taken." / "...reserved." |
| Go live twice | "You are already live. End that live first." |
| Very poor connection | calls give up after 20 s with a clear message |

Firestore's offline cache lives in memory only; closing the app offline loses it.

## 8. Troubleshooting
| Symptom | Fix |
|---|---|
| `Could not spawn java` | install Java 21+, open a new terminal |
| `port already in use` | stop the other emulator terminal (rules tests and `npm run emulators` conflict) |
| smoke test: connection refused | emulators not running, or `EMULATOR_HOST` needs setting |
| smoke test fails on `searchUsers` / deletion | functions did not load: read the Functions log in the control panel (usually a syntax error or `npm run backend:install` not run) |
| "The query requires an index" (production only) | click the link in the error, or add the index to `firestore.indexes.json` and deploy |
| Video stays `processing` | check Functions log for `video {id}`; see BACKEND.md section 4 about upload bytes |
