# Data model

Rule: **the app may only create things that belong to the signed-in user and may never write counters, scores, statuses or other people's data. Cloud Functions write those.** `tests/rules.test.js` proves each row below.

## Collections and ownership
| Path | Fields | Read | Create | Update | Delete |
|---|---|---|---|---|---|
| `posts/{id}` | uid, author, caption (≤150), status, likeCount, commentCount, shareCount, viewCount, completeCount, score, createdAt; server adds videoPath/Token, thumbPath/Token, (prod) videoUrl/thumbUrl, durationSec, hashtags[], error, removedReason | signed in; only `ready` (owner sees own) | owner, as `processing` with all counters 0 | nobody (server) | owner |
| `posts/{id}/likes/{uid}` | createdAt | signed in | that user | nobody | that user |
| `posts/{id}/comments/{id}` | text (1–500), uid, author, createdAt | signed in | author | nobody | author or video owner |
| `profiles/{uid}` | username, displayName (≤40), bio (≤150), avatarUrl, followerCount, followingCount, videoCount | signed in | that user, with a matching username claim | owner: displayName, bio, avatarUrl only | server |
| `usernames/{name}` | uid | signed in | that user, once; `[a-z0-9_]{3,20}`, not reserved, must match the profile in the same batch | nobody | server |
| `users/{uid}` | links (map ≤10) | owner | owner, `links` only | same | server |
| `users/{uid}/chatPrefs/{chatId}` | pinned, muted, archived | owner | owner | owner | owner |
| `users/{uid}/seen/{postId}`, `shared/{postId}` | at, completed | nobody | server | server | server |
| `follows/{follower_followee}` | follower, followee, createdAt | signed in | follower; id must be `follower_followee`, not self | nobody | follower |
| `blocks/{uid}/list/{target}` | createdAt | owner | owner | owner | owner |
| `chats/{id}` | type (direct/group), title (≤40), members[≤50], names{}, ownerUid, createdAt; server: lastMessage; members: lastRead{}, unread{} | members | direct: id = both uids sorted joined by `_`; group: caller is owner | members: only their own `lastRead`/`unread` | server |
| `chats/{id}/messages/{id}` | text (1–4000), from, fromName, createdAt | members | a member, as themselves | nobody | server |
| `channels/{id}` | name (≤40), ownerUid, members[], createdAt | signed in | owner, members = [owner] | anyone: add or remove only themselves | server |
| `channels/{id}/posts/{id}` | text (≤4000), createdAt | signed in | channel owner | nobody | server |
| `notifications/{uid}/items/{id}` | type, fromUid, fromName, text, postId/liveId, read, createdAt | owner | server | owner: `read` only | owner |
| `lives/{id}` | hostUid, hostName, title, status, viewerCount, video, startedAt, endedAt, lastBeat | signed in | server | server | server |
| `lives/{id}/messages/{id}` | text (≤200), from, fromName, createdAt | signed in | signed in, as self, while `status == live` | nobody | server |
| `lives/{id}/viewers/{uid}` | at | signed in | that user | nobody | that user |
| `meta/trending` | tags[{tag,score}], updatedAt | signed in | server | server | server |
| `reports/{type_id_uid}`, `pushTokens/{uid}`, `ratelimits/{uid_key}` | server data | nobody | server | server | server |

Post `status`: `processing` → `ready` | `failed` | `removed`.

**Storage:** `videos/{uid}/{postId}.mp4` written only by the owner (1 KB–100 MB, `video/*`, no overwrite, owner may delete). `thumbs/` written by functions only. All signed-in users may read. Everything else closed.

## Pagination (keeps reads and cost predictable)
| Screen | First load | More | Cap |
|---|---|---|---|
| For You / Following feed | 20 | +20 near the end | 100 |
| Comments | 30 | +30 | none |
| Chat messages | newest 50 | +50 | none |
| Activity | 30 | +30 | none |
| Profile video grid | 30 | +30 | 300 |
| Chat list | 100 | no | 100 |
| #tag search | 30 | no | 30 |
Following feed uses `uid in [followees]`, 30 per query.

## Indexes (`firestore.indexes.json`)
Single-field indexes are automatic. Required composite indexes:
| Query | Fields |
|---|---|
| feed | posts: status, score desc |
| ranking job | posts: status, createdAt desc |
| profile grid, Following feed | posts: uid, status, createdAt desc |
| #tag search | posts: hashtags (array-contains), status, score desc |
| following / followers lists | follows: follower, createdAt desc · followee, createdAt desc |
| live list | lives: status, startedAt desc |
| stale live cleanup | lives: status, lastBeat asc |
| account deletion | collection-group override on `comments.uid` |

The emulator ignores indexes; a missing one fails only in production, and the error contains a link that creates it.

## Known trade-offs
- Anyone can add a person to a group without consent.
- Array `members` fields cap at 1 MiB per document.
- A hot video's `likeCount` can exceed Firestore's ~1 write/second per document.
