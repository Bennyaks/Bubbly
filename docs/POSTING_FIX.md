# Posting fix (video upload failed: "unreadable or longer than 10 min")

## What that error meant
The server could not read the video it received. My test shows the reader works on good videos,
so the file that reached the server was most likely empty or damaged during the phone upload.
This pack changes both sides:

**Phone (App.js)**
- Reads the video a more reliable way (XMLHttpRequest blob instead of fetch().blob()).
- Uploads with a progress counter ("Uploading 45%").
- Refuses videos over 100 MB or 10 minutes before uploading.
- Tells you with an alert when your video is live, or why it failed. Failed posts are cleaned up automatically.

**Server (functions/index.js)**
- Logs how many bytes it received. An empty upload now says "arrived empty (0 bytes)".
- If the video header has no duration, it scans the file to find the length.
- If a video still cannot be read, the error includes the exact reason from the video reader.
- A missing or broken video reader no longer crashes the function.

## How to apply
1. Copy this pack over your project again (replace App.js and functions/index.js).
2. Stop the emulator (Ctrl+C in its terminal) and start it again so it loads the new function:
   `firebase emulators:start --import=./emulator-data --export-on-exit`
3. Reload the app on your phone (shake the phone, then Reload).
4. Try a SHORT video first (5 to 15 seconds).
5. You will get a failure alert for your old stuck video. That is the old failed post being cleaned up.

## If it still fails, do this 30-second check
1. Open http://localhost:4000 and go to **Storage**. Open `videos` > your user folder.
2. Look at the file size shown.
   - 0 B, or a few KB for a long video: the phone upload is the problem. Send me the size.
   - Normal size (MBs): download it to your laptop and play it. If it plays, the server read is the problem.
     If it does not play, the phone upload damaged it.
3. Open the **Functions** tab in the panel and send me the lines that start with `video` or `Video could not be read`.
   They now contain the exact reason.

## Other things to check
- Phone videos can be HEVC (H.265). They upload and get a thumbnail fine, but some older phones and web browsers cannot play them.
  Converting every upload to a widely playable format is the transcoding stage in BACKEND.md section 7.
- Keep test videos under about 30 MB while developing on the emulator.


---
## Round 2: what the first test found
The server log showed the video arrived as only **14 bytes**, so the phone upload was sending the wrong data,
not the server misreading it. Fixes:
- App.js now uploads the video straight to Storage over HTTP instead of using the Firebase JS upload helper.
- Before uploading, the app compares the size it read with the size the picker reports. If they do not match
  (or it read under 1 KB), it stops and tells you the real numbers instead of uploading a broken file.
- firebase.js needs two extra lines at the bottom (STORAGE_BUCKET and STORAGE_BASE). Do NOT copy firebase.js from
  this zip over yours, it contains the placeholder IP. Paste the two lines instead:

```js
export const STORAGE_BUCKET = firebaseConfig.storageBucket;
export const STORAGE_BASE = USE_EMULATOR ? `http://${EMULATOR_HOST}:9199` : 'https://firebasestorage.googleapis.com';
```
Put them at the very bottom of your firebase.js, after the `if (USE_EMULATOR ...) { ... }` block.

If the app now says "could not read the full video (read N bytes, expected M)", the problem is reading the file
from the phone gallery, and the numbers N and M tell us what to fix next. Send them to me.


---
## Round 3: still 14 bytes
The server log showed 14 bytes again. Two different phone upload methods gave the same result, which points at the
JavaScript Blob step that both used. Round 3 removes it:
- App.js now streams the video file straight from the phone with expo-file-system (File.upload). No Blob is built.
- Install it once: `npx expo install expo-file-system`
- The app checks the file size on the phone, and after upload checks the size the server says it stored. If they differ
  it tells you both numbers.
- The server now logs the actual CONTENT of any tiny upload (text and hex), so if it is still wrong we can see what was sent.
