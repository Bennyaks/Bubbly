# Backend

Everything runs on Firebase: **Auth** (email/password), **Firestore** (data + realtime), **Storage** (videos, thumbnails), **Cloud Functions** (Node 20, 2nd gen).
Optional: **LiveKit** for live video, **Expo Push** for notifications. There is no separate server.

**Core principle:** clients may only create their own content and their own markers. Every counter, score, status and `lastMessage` is written by
a Cloud Function (the admin SDK bypasses rules), so clients cannot fake them. The rules (`firestore.rules`, `storage.rules`) enforce this; `tests/rules.test.js` proves it.

## 1. What is in the backend folder
| File | Contents |
|---|---|
| `functions/index.js` | video pipeline, counters, messaging, ranking, views/shares, search, push tokens, reports, group admin, cleanup, account deletion |
| `functions/live.js` | live rooms: start/join/heartbeat/end, viewer count, stale cleanup, LiveKit webhook (loaded by index.js) |
| `functions/lib.js` | shared helpers: `db`, `REGION`, `needAuth`, `callable`/`safe` (error wrapper), `notify` (activity feed), `push` (Expo push), `rateLimit` |
| `functions/logic.js` | pure functions, unit tested: ranking formula, hashtags, milestones, username rules, video limits |
| `functions/video.js` | ffmpeg wrapper: reads video duration (header, then full scan fallback) |
| `functions/test/` | `logic.test.js`, `video.test.js` (builds real videos with ffmpeg) |
| `functions/.env.example` | LiveKit variables (optional) |
| `firestore.rules`, `storage.rules`, `firestore.indexes.json` | access control and indexes |

## 2. Architecture
```
App (Expo)
 |-- Auth ID token on every request
 |-- Firestore: realtime listeners and simple writes (rules decide what is allowed)
 |-- Storage: video upload videos/{uid}/{postId}.mp4 --event--> onVideoUploaded
 |-- Callable functions: recordView, recordShare, searchUsers, registerPushToken, reportContent,
 |                       addGroupMembers, leaveGroup, deleteMyAccount, startLive, joinLive, liveHeartbeat, endLive
 '-- LiveKit (optional) --webhook--> livekitWebhook

Firestore triggers (server only): likes, comments, follows, messages, channel posts, reports, lives, live viewers
Schedules: rankFeed (15 min), cleanupStale (24 h), endStaleLives (5 min)
```

## 3. Function reference (32)
Global options: region `REGION` (lib.js), `maxInstances: 20`. "Emulator-only" endpoints return 403 unless `FUNCTIONS_EMULATOR=true`.

| Function | Type | What it does | Limits / notes |
|---|---|---|---|
| `onVideoUploaded` | Storage finalize | downloads video, checks size/length, makes thumbnail, extracts hashtags, sets post `ready` and `videoCount`+1; on any failure sets `failed` and deletes the file | 1 GiB RAM, 300 s; max 10 min video; ignores files not matching `videos/{uid}/{id}.mp4` or posts not in `processing` |
| `onLikeCreated` / `onLikeDeleted` | Firestore | `likeCount` ±1; activity item; push only at milestones (1, 10, 50, 100, 1000...) | no notification for liking your own video |
| `onCommentCreated` / `onCommentDeleted` | Firestore | `commentCount` ±1; activity item and push to video owner | |
| `onFollowCreated` / `onFollowDeleted` | Firestore | follower/following counters; activity item and push | |
| `onMessageCreated` | Firestore | sets `lastMessage`, `unread.{uid}`+1 for other members, push (skips muted chats) | |
| `onChannelPostCreated` | Firestore | push to channel members | first 1000 members only |
| `onReportCreated` | Firestore | when a post has 5 reports it becomes `removed` | only `type == post` |
| `onLiveCreated` | Firestore | activity item and push to followers | first 500 followers |
| `onLiveViewerJoined` / `Left` | Firestore | `viewerCount` ±1 | can drift +1 if a phone dies without leaving |
| `rankFeed` | Schedule 15 min | rescores `ready` posts from the last 30 days (max 2000), rebuilds `meta/trending` | 512 MiB, 300 s |
| `cleanupStale` | Schedule 24 h | `processing` > 1 h → `failed`; `failed` > 1 day → deleted; rate-limit docs > 2 days deleted | 200 / 200 / 400 per run |
| `endStaleLives` | Schedule 5 min | closes lives with no heartbeat for 3 min | 100 per run |
| `rankFeedNow`, `cleanupNow`, `endStaleNow` | HTTP, emulator-only | run the three schedules by hand (schedules never fire locally) | |
| `recordView` | Callable | one view per user per video; `completed` upgrades it once | tracked in `users/{uid}/seen` |
| `recordShare` | Callable | one share per user per video | tracked in `users/{uid}/shared` |
| `searchUsers` | Callable | username prefix search, 2–20 chars, max 15 results | |
| `registerPushToken` | Callable | add/remove an Expo push token | token format checked; 20/day |
| `reportContent` | Callable | one report per user per target (post, comment, user, message, channel) | 10/hour |
| `addGroupMembers` | Callable | group owner adds by username | max 20 per call, 50 per group |
| `leaveGroup` | Callable | leave; ownership passes to next member; last one out deletes the group | |
| `deleteMyAccount` | Callable | removes lives, videos + files, comments, follows, group/channel membership, private data, profile, username, then the Auth user | 300 s. Direct-chat messages already sent are kept for the other person |
| `startLive` | Callable | creates the live room, returns LiveKit token if configured | 10/hour, one live at a time, title required |
| `joinLive` / `liveHeartbeat` / `endLive` | Callable | viewer token / host keep-alive (app sends every 30 s) / host closes | |
| `livekitWebhook` | HTTP | LiveKit `room_finished` → mark live ended | 503 until LiveKit is configured |

All callables go through `safe()` (lib.js): expected errors (`HttpsError`) reach the app as is; anything else is logged with `logger.error` and the user sees "Something went wrong. Please try again."

## 4. Main flows
- **Upload:** app creates `posts/{id}` (`status: processing`, all counters 0) then uploads the file. `onVideoUploaded` validates and flips it to `ready`. Only `ready` posts are visible to others. The app uploads with `expo-file-system` `File.upload` (not a JS Blob) because Blob uploads arrived as 14 bytes on this Expo version. Do not switch back.
- **Media URLs:** posts store `videoPath/videoToken/thumbPath/thumbToken`; the app builds the URL (`mediaUrl` in `firebase.js`) for the emulator or real Storage. Full `videoUrl/thumbUrl` are written only in production.
- **For You ranking:** `score = (likes + 3·comments + 5·shares + 0.1·views + 20·completionRate + boost) / (ageHours + 2)^1.5`; boost = 10 while a video has < 200 views and is < 24 h old (`logic.js: rankScore`). Feed query: `status == ready order by score desc`. Trending = hashtags of posts < 24 h old.
- **Messaging:** clients write messages and their own read marker only. Direct chat id = both uids sorted and joined by `_` (identical logic in `firestore.rules` `dmId` and `src/services/chats.js`).
- **Channels:** only the owner posts; anyone may add/remove only themselves from `members`.
- **Live:** works without video (chat, viewers, heartbeat). Real video needs LiveKit and a development build, see LIVE.md.
- **Moderation:** 5 distinct reports hide a video. No admin dashboard exists; remove content by setting `status: "removed"` in the console.

## 5. Security summary
Rules deny everything not listed. Highlights: usernames are create-only, one per account, 3–20 chars `[a-z0-9_]`, reserved list; post create must have zero counters and `status == processing`; posts cannot be updated by clients; chat members can only change their own `lastRead`/`unread`; storage upload only to own folder, 1 KB–100 MB, `video/*`, no overwrite; `thumbs/` is server-written. Full table in DATA_MODEL.md. App Check is not enabled yet.

## 6. Values you may need to change
| Value | Where |
|---|---|
| Function region | `REGION` in `functions/lib.js` **and** `getFunctions(app, 'us-central1')` in `firebase.js`; must match the Firestore region |
| Max instances | `setGlobalOptions` in `functions/index.js` |
| Max video length (10 min), ranking boost, milestones, username regex, reserved names | `functions/logic.js` |
| Max video size (100 MB), min size (1 KB) | `storage.rules` and `src/services/storage.js` |
| Report threshold (5), group size (50), caps and schedules | `functions/index.js` |
| Rate limits | `rateLimit(uid, key, max, windowSec)` calls |

## 7. Maintenance gotchas
- **Values duplicated on purpose** (a test fails if they drift): reserved usernames in `functions/logic.js`, `src/validation.js`, `firestore.rules` and the tests; `dmId` in rules and `chats.js`.
- **New collection or query:** add a rule (default is deny) and, for compound queries, an entry in `firestore.indexes.json`. The emulator does not need indexes, so a missing one only fails in production ("The query requires an index" error contains a one-click link).
- **New counter or server-owned field:** write it from a function, never allow it in rules.
- **New callable:** wrap with `callable()`, call `needAuth`, add `rateLimit` if abusable, add a wrapper in `src/services/`. A test checks every function the app calls exists in the backend.
- **Notifications:** `notify()` uses fixed ids (e.g. `like_{post}_{user}`) so like/unlike/like never duplicates. `push()` swallows failures so notifications never break the main job.
- **Counter triggers swallow "not found"** (`.catch(ignore)`) so deleting a parent first does not crash them.
- **Scheduled functions don't run locally**: use the `*Now` URLs (EMULATOR.md).
- **Firebase project ID** is `bubbly-bfef3` (legacy name), see README.

## 8. Known limits
| Limit | Consequence / upgrade path |
|---|---|
| ~1 sustained write/s per document | a viral video's `likeCount` can exceed it → sharded counters |
| members stored as arrays (1 MiB doc cap) | fine to a few thousand members; then move to a subcollection |
| push fan-out capped (1000 members / 500 followers) | large audiences need queued fan-out (Cloud Tasks / Pub/Sub) |
| raw MP4 playback | add HLS transcoding + CDN for scale |
| engagement-only ranking, not personalised | needs view events in BigQuery |
| Firestore chat | fine to hundreds of thousands of users |
| anyone can add anyone to a group | add an accept-invite step before a large launch |

Not built: phone/Google sign-in, media in chats, calls, E2E encryption, message edit/delete, full-text search, admin dashboard, analytics, transcoding.
