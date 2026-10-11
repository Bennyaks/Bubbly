import { collection, doc, onSnapshot, query, where, limit, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

const followId = (me, them) => `${me}_${them}`;

export const watchIsFollowing = (me, them, cb) => onSnapshot(doc(db, 'follows', followId(me, them)), (d) => cb(d.exists()));
export const follow = (me, them) => setDoc(doc(db, 'follows', followId(me, them)), { follower: me, followee: them, createdAt: serverTimestamp() });
export const unfollow = (me, them) => deleteDoc(doc(db, 'follows', followId(me, them)));

// uids I follow (and who follow me). Counters and notifications are done by the backend.
export const watchFollowing = (uid, max, cb, onErr) =>
  onSnapshot(query(collection(db, 'follows'), where('follower', '==', uid), limit(max)), (sn) => cb(sn.docs.map((d) => d.data().followee)), onErr);
export const watchFollowers = (uid, max, cb, onErr) =>
  onSnapshot(query(collection(db, 'follows'), where('followee', '==', uid), limit(max)), (sn) => cb(sn.docs.map((d) => d.data().follower)), onErr);
