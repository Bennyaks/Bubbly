# Data model and who owns what

Rule of thumb: **the app may only create things that belong to the signed-in person, and may never write counters, scores,
statuses or other people's data. Those are written by Cloud Functions.** `tests/rules.test.js` proves each line below.

## Ownership table
| Collection | Who can read | Who can create | Who can change | Who can delete |
|---|---|---|---|---|
| `posts/{id}` | signed in; only `ready` videos (the owner also sees their own) | the owner, as `processing` with zero counters | nobody (server updates status, counters, score) | the owner |
| `posts/{id}/likes/{uid}` | signed in | that person | nobody | that person |
| `posts/{id}/comments/{id}` | signed in | the author (1 to 500 characters) | nobody | the author or the video owner |
| `profiles/{uid}` | signed in | that person, together with a valid unique username | the owner: display name, bio only | server (account deletion) |
| `usernames/{name}` | signed in | that person, once, valid format, not reserved | nobody | server |
| `users/{uid}` (settings) | only that person | only that person, only the `links` field | same | same |
| `follows/{a_b}` | signed in | `a` (the follower), correct id, not self | nobody | the follower |
| `chats/{id}` | members | any person for a direct chat with the fixed id, or a group they own (max 50) | members: only their own read marker and unread count; server: last message, members | server |
| `chats/{id}/messages/{id}` | members | a member, as themselves, 1 to 4000 characters | nobody | server |
| `channels/{id}` | signed in | the owner | anyone: only to add or remove THEMSELVES | server |
| `channels/{id}/posts/{id}` | signed in | the channel owner only | nobody | server |
| `notifications/{uid}/items/{id}` | that person | server only | that person: mark read | that person |
| `users/{uid}/chatPrefs/{chat}` | that person | that person | that person | that person |
| `lives/{id}` | signed in | server only | server only | server |
| `lives/{id}/messages/{id}` | signed in | anyone signed in, as themselves, while the live is running | nobody | server |
| `lives/{id}/viewers/{uid}` | signed in | that person | nobody | that person |
| `meta/trending` | signed in | server | server | server |
| `reports`, `pushTokens`, `ratelimits`, `users/{uid}/seen`, `users/{uid}/shared` | nobody | server | server | server |

**Storage:** `videos/{uid}/{postId}.mp4` is written only by the owner (1 KB to 100 MB, video type, no overwrite).
`thumbs/` is written only by the server. Everything else is closed.

## Known trade-offs (accepted for now)
- Anyone can add a person to a group chat without asking them. Add "accept invite" before a large launch.
- `channels.members` and `chats.members` are arrays (1 MB document limit): fine up to a few thousand members.
- A hot video's `likeCount` can exceed Firestore's ~1 write per second per document. Plan: sharded counters.

## Pagination (so reads and bills stay predictable)
| Screen | First load | More | Hard cap |
|---|---|---|---|
| For You / Following feed | 20 | +20 when you near the end | 100 |
| Comments | 30 | "Show more comments" +30 | no cap (user action) |
| Chat messages | newest 50 | "Load earlier messages" +50 | no cap (user action) |
| Activity | 30 | "Load more" +30 | no cap (user action) |
| Profile video grid | 30 | +30 when you scroll | 300 |
| Chat list | 100 | none | 100 |
| Search by #tag | 30 | none | 30 |

## Every query and its index
Single-field indexes are automatic. These need entries in `firestore.indexes.json` (already there):
| Query | Index |
|---|---|
| posts: status ==, order by score desc | status, score |
| posts: status ==, order by createdAt desc (ranking job) | status, createdAt |
| posts: uid ==, status ==, order by createdAt desc (profile, Following feed) | uid, status, createdAt |
| posts: hashtags array-contains, status ==, order by score desc | hashtags, status, score |
| lives: status ==, order by startedAt desc | status, startedAt |
| lives: status ==, lastBeat < (stale cleanup) | status, lastBeat |
| comments (collection group): uid == (account deletion) | field override on `comments.uid` |
The emulator does not need indexes, so a missing one only shows up in production. If a screen shows
"The query requires an index", the error message contains a link that creates it in one click.
