# App guide: screens and the service layer

Expo SDK 57 / React Native app. Navigation is custom (no Expo Router): `App.js` holds the tab state and a screen stack; helpers in `src/nav.js` (`openUser`, `openChat`, `openViewer`...). Android back closes the top page, then returns to Home.

## Screens
| Tab / page | File | What it does |
|---|---|---|
| Home | `src/screens/Feed.js` | For You (ranked) and Following feeds, like, comment, share, follow |
| Friends | `Friends.js` | friends, following, followers, discover, invite |
| + | `Upload.js` | pick video, caption, upload, progress |
| Inbox | `Chats.js` | Chats (filters, pin/mute/archive, groups), Activity, Channels |
| Live | `Live.js` | who is live, go live, live room |
| Search | `Search.js` | users by username, videos by #hashtag, trending |
| Profile | `UserProfile.js` | anyone's profile, follow, message, report; edit own |
| Settings | `Settings.js` | invite, social links, verification email, log out, delete account |
| Other | `Viewer.js`, `Channels.js`, `ClaimUsername.js` | video viewer, channel room, username claim after sign-up |
Shared: `src/ui.js` (colors, Avatar, Overlay), `src/nav.js`, `src/hooks.js`, `src/errors.js` (friendly messages), `src/validation.js`, `src/components/` (VideoPost, VideoGrid, FollowButton, OfflineBanner).

## Service layer (`src/services/`)
Screens never import Firebase; they call these modules (enforced by `architecture.test.js`). Errors are turned into one friendly sentence by `src/errors.js`.
| Module | Wraps |
|---|---|
| `callable.js` | `call(name, data)`: Cloud Function call with a 20 s timeout |
| `auth.js` | sign up/in/out, password reset, email verification, ID token |
| `profiles.js` | profiles, username claim (batch with the profile), search, trending, links |
| `posts.js` | feeds, drafts, likes, comments, `recordView`, `recordShare` |
| `storage.js` | native video upload to Storage with size checks |
| `follows.js` | follow/unfollow, lists |
| `chats.js` | chats, messages, read markers, prefs, group admin calls |
| `channels.js` | channels and channel posts |
| `notifications.js` | activity feed |
| `lives.js` | live list, room, chat, presence, start/heartbeat/end |
| `account.js` | report content, delete account |

`firebase.js` selects emulator or real project, and exposes `mediaUrl`, `videoSrc`, `thumbSrc` for media links.

## Commands for working on the app
`npx expo start -c` (run), `npx expo lint`, `npx expo-doctor`. Add packages with `npx expo install <pkg>` so versions match the SDK. Libraries with native code need a development build, not Expo Go (`eas build --profile development`). `ios/` and `android/` are generated; configure native settings in `app.json`.
