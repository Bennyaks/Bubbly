import {
  collection, doc, onSnapshot, getDoc, getDocs, query, where, orderBy, limit, setDoc, deleteDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { call } from './callable';

const toList = (sn) => sn.docs.map((d) => ({ id: d.id, ...d.data() }));
const feedErr = (label) => (e) => console.warn(label, e.message);

// ---------- feeds (max = how many to load; the screen raises it as you scroll) ----------
export const watchForYou = (max, cb) =>
  onSnapshot(query(collection(db, 'posts'), where('status', '==', 'ready'), orderBy('score', 'desc'), limit(max)), (sn) => cb(toList(sn)), feedErr('feed'));

// followees: up to 30 uids (Firestore's limit for an "in" query)
export const watchFollowingFeed = (followees, max, cb) =>
  onSnapshot(query(collection(db, 'posts'), where('uid', 'in', followees), where('status', '==', 'ready'), orderBy('createdAt', 'desc'), limit(max)),
    (sn) => cb(toList(sn)), feedErr('following feed'));

export const watchUserPosts = (uid, max, cb) =>
  onSnapshot(query(collection(db, 'posts'), where('uid', '==', uid), where('status', '==', 'ready'), orderBy('createdAt', 'desc'), limit(max)),
    (sn) => cb(toList(sn)), feedErr('profile videos'));

// everything I posted, any status, to tell me when an upload finished or failed
export const watchMyPosts = (uid, onChange) =>
  onSnapshot(query(collection(db, 'posts'), where('uid', '==', uid)), (sn) => sn.docChanges().forEach((c) => onChange(c.type, c.doc.ref, c.doc.data())), feedErr('my posts'));

export async function postsByHashtag(tag) {
  const sn = await getDocs(query(collection(db, 'posts'), where('hashtags', 'array-contains', tag.toLowerCase()), where('status', '==', 'ready'), orderBy('score', 'desc'), limit(30)));
  return toList(sn);
}

export async function getPost(id) {
  const d = await getDoc(doc(db, 'posts', id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

// ---------- publishing ----------
// Step 1 of 2: create the post record (status "processing"). Step 2 is storage.uploadVideo; the server then marks it ready.
export async function createPostDraft(user, username, caption) {
  const id = doc(collection(db, 'posts')).id;
  await setDoc(doc(db, 'posts', id), {
    uid: user.uid, author: username, caption: caption.trim() || 'New video', status: 'processing',
    likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 0, completeCount: 0, score: 0, createdAt: serverTimestamp(),
  });
  return id;
}
export const deletePostRecord = (id) => deleteDoc(doc(db, 'posts', id));
export const deleteByRef = (ref) => deleteDoc(ref);

// ---------- likes ----------
export const watchLiked = (postId, uid, cb) => onSnapshot(doc(db, 'posts', postId, 'likes', uid), (d) => cb(d.exists()));
export const like = (postId, uid) => setDoc(doc(db, 'posts', postId, 'likes', uid), { createdAt: serverTimestamp() });
export const unlike = (postId, uid) => deleteDoc(doc(db, 'posts', postId, 'likes', uid));

// ---------- comments ----------
export const watchComments = (postId, max, cb) =>
  onSnapshot(query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'desc'), limit(max)), (sn) => cb(toList(sn)));
export const addComment = (postId, me, text) =>
  addDoc(collection(db, 'posts', postId, 'comments'), { text, uid: me.uid, author: me.username, createdAt: serverTimestamp() });
export const deleteComment = (postId, commentId) => deleteDoc(doc(db, 'posts', postId, 'comments', commentId));

// ---------- counted once per person by the server ----------
export const recordView = (postId) => call('recordView', { postId });
export const recordShare = (postId) => call('recordShare', { postId });
