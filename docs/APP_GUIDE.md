# App guide: screens and navigation

## Layout
- **Top bar (every tab):** logo, search bar, and your **profile picture at the top right**. On Home it floats over the video.
- **Bottom tabs:** Home | Friends | + (upload) | Inbox | Live. The Inbox badge counts unread chats and unread activity.
- Pages that open over the tabs (Search, a profile, a chat, a live, Settings, the video viewer) have a back arrow.
  The Android back button closes them, then returns to Home.

## Screens
| Screen | File | What it does |
|---|---|---|
| Home | src/screens/Feed.js | For You (ranked) and Following feeds, auto-scroll, like, comment, share, follow |
| Comments | src/components/VideoPost.js | newest first, avatars, time, delete your own (or any on your video), tap a name to open that profile |
| Friends | src/screens/Friends.js | Friends (follow each other), Following, Followers, Discover; Message and Follow buttons; invite |
| Inbox | src/screens/Chats.js | Chats, Activity, Channels |
| Chats | same | filters All / Direct / Groups / Unread / Archived; press and hold to pin, mute, archive or leave; unread counts |
| Group chat | same | add people (owner), leave, member list |
| Activity | same | likes, comments, new followers, lives you can open |
| Live | src/screens/Live.js | who is live, Go live, live room with chat and viewers |
| Search | src/screens/Search.js | people by username, videos by #hashtag, trending hashtags |
| Profile | src/screens/UserProfile.js | anyone's profile: counts, videos grid, Follow, Message, Report. Yours: Edit profile and Settings |
| Settings | src/screens/Settings.js | invite, social usernames, log out, delete account |
| Upload | src/screens/Upload.js | choose a video, caption, post |

## Shared code
- `src/ui.js` colors, styles, Avatar, Segment, Overlay (the back-arrow page), Logo
- `src/nav.js` navigation helpers (openUser, openChat, openViewer, ...)
- `src/hooks.js` profile loader
- `src/components/` VideoPost (video, comments, list), VideoGrid, FollowButton
