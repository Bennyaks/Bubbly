# Bubbly backend: Telegram + TikTok on Firebase

Project: `bubbly-bfef3`. Everything below runs on Firebase (Auth, Firestore, Storage, Cloud Functions), which suits a small team and scales to the first hundreds of thousands of users. Section 7 says honestly where it stops scaling.

## 1. What each half needs

| Capability | TikTok side | Telegram side | Built here |
|---|---|---|---|
| Identity | accounts, profiles, follow graph | unique @username | Auth + `usernames`/`profiles` + `follows` |
| Content | video upload, processing, feed ranking, hashtags, trending | messages, groups, channels | Storage trigger, `rankFeed`, `onMessageCreated`, channels |
| Engagement | likes, comments, views, shares | read markers, unread counts | counter triggers, `recordView`, unread map |
| Realtime | live streaming | instant chat | LiveKit (`live.js`) + Firestore listeners |
| Notifications | likes, comments, followers, live | new messages, channel posts | Expo push via `push()` |
| Safety | reports, auto-hide, blocks, rate limits | privacy | `reportContent`, rules, `rateLimit()` |
| Compliance | account deletion | | `deleteMyAccount` |

## 2. Architecture

```
 Mobile app / Web (Expo)
   |  Firebase Auth (ID token)
   |--> Firestore (realtime listeners, rules enforce who can read/write)
   |--> Storage (video upload)  --event--> onVideoUploaded (ffmpeg thumbnail, validate, mark ready)
   |--> Callable functions: recordView, searchUsers, registerPushToken, reportContent,
   |                        deleteMyAccount, startLive / joinLive / endLive
   |--> LiveKit Cloud (WebRTC video for live)  --webhook--> livekitWebhook

 Firestore triggers (server only): likes/comments/follows counters, onMessageCreated,
   onChannelPostCreated, onReportCreated, onLiveCreated
 Scheduled: rankFeed every 15 min (scores + trending hashtags)
 Expo Push Service <-- push() from functions
```

Principle: **clients may only create their own content and their own markers. Every counter, score, status and last-message field is written by functions**, so it can't be faked.

## 3. Data model

```
profiles/{uid}        username, displayName, bio, avatarUrl, followerCount, followingCount, videoCount
usernames/{name}      uid                                  (unique handle, create-only)
users/{uid}           private settings (linked social usernames)
users/{uid}/seen/{postId}   at, completed                  (server only: views + "already watched")
users/{uid}/shared/{postId} at                                 (server only: one share counted per user)
pushTokens/{uid}      tokens[]                             (server only)
follows/{follower_followee}  follower, followee, createdAt
blocks/{uid}/list/{target}   createdAt

posts/{postId}        uid, author, caption, hashtags[], status, videoPath+videoToken, thumbPath+thumbToken
                      (production also writes videoUrl/thumbUrl), durationSec,
                      likeCount, commentCount, shareCount, viewCount, completeCount, score, createdAt
  likes/{uid}         createdAt
  comments/{id}       text, uid, author, createdAt
  status: processing -> ready | failed | removed

chats/{chatId}        type (direct|group), title, members[], names{uid:username}, ownerUid,
                      lastMessage{text,from,at}  (server), lastRead{uid:ts}, unread{uid:n}
  messages/{id}       text, from, fromName, createdAt
channels/{id}         name, ownerUid, members[]
  posts/{id}          text, createdAt
lives/{id}            hostUid, hostName, title, status, viewerCount, startedAt, endedAt   (server only)
meta/trending         tags[{tag,score}], updatedAt
notifications/{uid}/items/{id}   type, fromUid, fromName, text, postId|liveId, read, createdAt   (activity feed; server writes)
users/{uid}/chatPrefs/{chatId}   pinned, muted, archived                                        (yours only)
lives/{id}/messages/{id}         text, from, fromName, createdAt                                (live chat)
lives/{id}/viewers/{uid}         at                                                              (presence)
reports/{type_id_uid} server only
ratelimits/{uid_key}  server only
```

## 4. The main flows

**Upload a video.** App creates `posts/{id}` (status `processing`, all counters 0) then uploads `videos/{uid}/{id}.mp4`. `onVideoUploaded` downloads it, rejects unreadable or longer than 10 minutes, makes a thumbnail, extracts hashtags from the caption, and sets `status: ready`. Only `ready` posts are visible to others.

**For You feed.** `rankFeed` scores recent videos every 15 minutes:
`score = (likes + 3*comments + 5*shares + 0.1*views + 20*completionRate + newVideoBoost) / (ageHours + 2)^1.5`.
The app reads `posts where status == "ready" order by score desc`. New videos with under 200 views get a boost for 24 hours so they get a fair chance. Following feed: `posts where uid in [followees]` (up to 30 per query, chunk for more).

**Messaging.** App writes a message. `onMessageCreated` sets `lastMessage`, increments `unread` for everyone else, and sends a push. The app clears its own `unread` and `lastRead` when a room is open. Direct chats use the id `uidA_uidB` (sorted), so duplicates are impossible.

**Channels.** Telegram-style: only the owner can post, members read. `onChannelPostCreated` pushes to members.

**Live.** `startLive` creates the `lives` doc and returns a LiveKit host token. `joinLive` returns a viewer token. There is **no follower requirement**; the only limits are 10 starts per hour and one live at a time per user. Followers get a push when someone goes live.

**Moderation.** `reportContent` stores one report per user per target. Five distinct reports on a video set it to `removed` automatically. This is a safety net, not a replacement for review; an admin dashboard is a later stage.

**Account deletion.** `deleteMyAccount` removes the user's videos, files, follows, profile and username, then the Auth account.

**Group management.** Clients cannot edit a chat's member list, so `addGroupMembers` (owner only, max 50) and `leaveGroup`
(hands ownership to the next member; deletes the group when the last person leaves) run on the server.

**Shares.** `recordShare` counts one share per user per video and feeds the ranking.

**Housekeeping.** `cleanupStale` runs daily: uploads stuck in `processing` for over an hour are marked failed,
failed posts older than a day are deleted, and old rate-limit records are cleared.

## 4b. Every function at a glance

| Function | Type | What it does |
|---|---|---|
| onVideoUploaded | Storage trigger | validate video, thumbnail, hashtags, mark post ready |
| onLikeCreated / onLikeDeleted | Firestore trigger | like counter, milestone push |
| onCommentCreated / onCommentDeleted | Firestore trigger | comment counter, push to author |
| onFollowCreated / onFollowDeleted | Firestore trigger | follower and following counters, push |
| onMessageCreated | Firestore trigger | last message, unread counts, push |
| onChannelPostCreated | Firestore trigger | push to channel members |
| onReportCreated | Firestore trigger | hide a video after 5 distinct reports |
| rankFeed (+ rankFeedNow in emulator) | Scheduled | score videos, compute trending hashtags |
| cleanupStale (+ cleanupNow in emulator) | Scheduled | housekeeping |
| recordView, recordShare | Callable | one view / one share per user per video |
| searchUsers | Callable | find people by username prefix |
| registerPushToken | Callable | save or remove an Expo push token |
| reportContent | Callable | report a video, comment, user, message or channel |
| addGroupMembers, leaveGroup | Callable | group admin |
| deleteMyAccount | Callable | full account deletion |
| startLive, joinLive, liveHeartbeat, endLive | Callable | live rooms (see docs/LIVE.md) |
| onLiveCreated | Firestore trigger | notify followers when someone goes live |
| onLiveViewerJoined / onLiveViewerLeft | Firestore trigger | viewer count |
| endStaleLives (+ endStaleNow in emulator) | Scheduled | close lives whose host went silent |
| livekitWebhook | HTTP | LiveKit room events (needs LiveKit configured) |

## 4c. Error handling and logging
- Every callable is wrapped by `safe()` (`functions/lib.js`). Expected problems (rate limit, not the owner, name not found) reach the app
  with a clear message. Anything unexpected is logged in full to Cloud Logging and the user only sees "Something went wrong. Please try again."
- All logging uses structured `logger` calls, so alerts can filter by severity (PRODUCTION.md section 2).
- Pure logic lives in `functions/logic.js` and `functions/video.js` so it can be unit tested (TESTING.md).

## 5. Security model
- Rules deny everything not listed. Clients cannot write counters, scores, status, `lastMessage`, or other people's data.
- Usernames are create-only, so a taken name can never be overwritten.
- Storage: only the owner uploads `videos/{uid}/{id}.mp4`, video type only, under 100 MB.
- Callable functions check sign-in and rate-limit abuse-prone actions.
- Before launch, also enable **App Check** (Play Integrity on Android) to block fake clients.

## 6. Deploy (in order, from your `bubbly` project folder)

1. Copy this folder's contents into the project root so `firebase.json` and `functions/` sit next to `App.js`.
2. Upgrade Firebase to the **Blaze (pay-as-you-go)** plan. Functions and the video trigger need it; it needs a card, with a free monthly allowance first.
3. Open `functions/lib.js` and set `REGION` to your Firestore region (console > Firestore > Data).
4. Install and log in:
   ```
   npm install -g firebase-tools
   firebase login
   cd functions && npm install && cd ..
   ```
5. Deploy functions and indexes first (the app keeps working on the old rules):
   ```
   firebase deploy --only functions,firestore:indexes
   ```
   Wait until the indexes show "Enabled" in the console (a few minutes).
6. Apply `CLIENT_PATCH.md` to the app and test.
7. Finally deploy the new rules (they close the old write paths):
   ```
   firebase deploy --only firestore:rules,storage
   ```
8. Old test videos from stage 1 and 2 have no `status`, so they won't appear. Delete them in the console.

## 7. Honest limits and the upgrade path

- **Hot documents.** Firestore handles about 1 sustained write per second per document. A viral video's `likeCount` will exceed that. Upgrade: sharded counters or batching increments.
- **Arrays.** `channels.members` and `chats.members` are arrays (1 MiB document cap). Fine to a few thousand members. For large channels, move members to a subcollection and notify through topics.
- **Fan-out.** Push to followers and members is capped at 1000 per event. Large audiences need queued, chunked fan-out (Cloud Tasks or Pub/Sub).
- **Video delivery.** Videos play as raw MP4 from Storage. For smooth playback worldwide, add transcoding to HLS (Google Transcoder API or Mux) plus a CDN.
- **Recommendations.** Ranking here is engagement-based, not personalized. Personalization needs view events in BigQuery and a model.
- **Telegram itself** runs on its own custom stack built for billions of messages. Firestore chats suit up to hundreds of thousands of users. Past that, plan a move to a dedicated messaging service.

## 8. Not built yet
Phone and Google sign-in; photos, voice notes and files in chat; voice and video calls; end-to-end encrypted chats (Telegram only does this for secret chats); message edit/delete; group admin tools; full-text search (Algolia or Typesense); admin moderation dashboard; analytics; video transcoding; app-side screens for follow, profile pages, hashtags and live.

## 9. Suggested order
1. Deploy this backend and patch the client (this stage).
2. Follow/profile pages, hashtag and user search screens.
3. Live streaming (LiveKit account, then enable `live.js`).
4. Media in chats, push notifications on device, App Check.
5. Transcoding and CDN, then the design pass.
