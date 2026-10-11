import { collection, doc, onSnapshot, query, where, orderBy, limit, addDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { call } from './callable';

export const watchLives = (cb) =>
  onSnapshot(query(collection(db, 'lives'), where('status', '==', 'live'), orderBy('startedAt', 'desc'), limit(30)),
    (sn) => cb(sn.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.warn('lives', e.message));
export const watchLive = (id, cb) => onSnapshot(doc(db, 'lives', id), (d) => cb(d.exists() ? { id: d.id, ...d.data() } : null), () => cb(null));
export const watchLiveMessages = (id, cb) =>
  onSnapshot(query(collection(db, 'lives', id, 'messages'), orderBy('createdAt', 'desc'), limit(60)), (sn) => cb(sn.docs.map((d) => ({ id: d.id, ...d.data() }))));
export const sendLiveMessage = (id, me, text) =>
  addDoc(collection(db, 'lives', id, 'messages'), { text, from: me.uid, fromName: me.username, createdAt: serverTimestamp() });

// A viewer registers presence so the room can count them. Returns a function that removes it.
export function joinPresence(id, uid) {
  const ref = doc(db, 'lives', id, 'viewers', uid);
  setDoc(ref, { at: serverTimestamp() }).catch(() => {});
  return () => { deleteDoc(ref).catch(() => {}); };
}

export const startLive = (title) => call('startLive', { title });
export const heartbeat = (liveId) => call('liveHeartbeat', { liveId }).catch(() => {});
export const endLive = (liveId) => call('endLive', { liveId });
