# Client patch: make the app use the new backend

These edits match your current `App.js` and `src/screens/Chats.js`. Apply them after deploying the functions (BACKEND.md step 5) and before deploying the new rules (step 7).

## 1. `firebase.js`
Add at the top with the other imports:
```js
import { getFunctions } from 'firebase/functions';
```
Add at the bottom:
```js
export const functions = getFunctions(app, 'us-central1'); // use the same REGION as functions/lib.js
```

## 2. `App.js`: imports
Change the Firestore import to also include `where`, `limit`, `deleteDoc`:
```js
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc,
  arrayUnion, arrayRemove, increment, setDoc, where, limit, deleteDoc,
} from 'firebase/firestore';
```
Change the firebase import and add the callable import:
```js
import { auth, db, storage, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
```

## 3. `App.js`: comments (in `function Comments`, inside `send`)
Delete this line. The server now counts comments:
```js
await updateDoc(doc(db, 'posts', post.id), { commentCount: increment(1) });
```

## 4. `App.js`: likes and views (replace the top of `function Post`)
Replace these two lines:
```js
const liked = (item.likedBy || []).includes(user.uid);
const like = () => updateDoc(doc(db, 'posts', item.id), { likedBy: ... });
```
with:
```js
const [liked, setLiked] = useState(false);
const likeRef = doc(db, 'posts', item.id, 'likes', user.uid);
useEffect(() => onSnapshot(likeRef, (d) => setLiked(d.exists())), [item.id]);
const like = () => (liked ? deleteDoc(likeRef) : setDoc(likeRef, { createdAt: serverTimestamp() }));
useEffect(() => {
  if (!active) return;
  const t = setTimeout(() => httpsCallable(functions, 'recordView')({ postId: item.id }).catch(() => {}), 3000);
  return () => clearTimeout(t);
}, [active]);
```
In the like button, change the count from `{(item.likedBy || []).length}` to `{item.likeCount || 0}`.

## 5. `App.js`: the feed query (in `function Feed`)
Replace:
```js
useEffect(() => onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc')),
  (sn) => setPosts(sn.docs.map((d) => ({ id: d.id, ...d.data() })))), []);
```
with:
```js
useEffect(() => onSnapshot(
  query(collection(db, 'posts'), where('status', '==', 'ready'), orderBy('score', 'desc'), limit(50)),
  (sn) => setPosts(sn.docs.map((d) => ({ id: d.id, ...d.data() }))),
  (e) => console.warn('feed', e.message),
), []);
```

## 6. `App.js`: upload (replace the whole `const post = async () => { ... };` in `function Upload`)
```js
const post = async () => {
  if (!asset) return Alert.alert('Choose a video first');
  setBusy(true);
  const id = doc(collection(db, 'posts')).id;
  try {
    await setDoc(doc(db, 'posts', id), {
      uid: user.uid, author: nameOf(user), caption: cap.trim() || 'New video', status: 'processing',
      likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 0, completeCount: 0, score: 0,
      createdAt: serverTimestamp(),
    });
    const blob = await (await fetch(asset.uri)).blob();
    await uploadBytes(ref(storage, `videos/${user.uid}/${id}.mp4`), blob, { contentType: 'video/mp4' });
    onClose();
    Alert.alert('Uploaded', 'Your video is being processed and will appear in a minute.');
  } catch (e) {
    deleteDoc(doc(db, 'posts', id)).catch(() => {});
    Alert.alert('Upload failed', e.message);
  }
  setBusy(false);
};
```

## 7. `src/screens/Chats.js`
In `send`, delete the second write. The server now sets the last message:
```js
await updateDoc(doc(db, 'chats', chat.id), {
  lastMessage: { text: t.slice(0, 80), from: user.uid, at: serverTimestamp() },
});
```
In the "mark as read" effect, replace the update with:
```js
updateDoc(doc(db, 'chats', chat.id), {
  [`lastRead.${user.uid}`]: serverTimestamp(),
  [`unread.${user.uid}`]: 0,
}).catch(() => {});
```

## 8. Test checklist
1. Upload a short video. In the Firebase console its post shows `status: processing`, then `ready` within a minute, with a `thumbUrl`. Then it appears in the feed.
2. Like it: `likeCount` goes to 1 in the console. Unlike: back to 0.
3. Comment on it: `commentCount` rises.
4. Message a second account: the chat's `lastMessage` and `unread` update.
5. If something fails, open Firebase console > Functions > Logs and send me the error.
