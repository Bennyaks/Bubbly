import { collection, doc, onSnapshot, addDoc, updateDoc, query, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase';

export const watchChannels = (cb) =>
  onSnapshot(query(collection(db, 'channels'), orderBy('createdAt', 'desc'), limit(100)), (sn) => cb(sn.docs.map((d) => ({ id: d.id, ...d.data() }))));
export const createChannel = (uid, name) =>
  addDoc(collection(db, 'channels'), { name: name.trim(), ownerUid: uid, members: [uid], createdAt: serverTimestamp() });
export const toggleMembership = (channel, uid) =>
  updateDoc(doc(db, 'channels', channel.id), { members: (channel.members || []).includes(uid) ? arrayRemove(uid) : arrayUnion(uid) });
export const watchChannelPosts = (id, cb) =>
  onSnapshot(query(collection(db, 'channels', id, 'posts'), orderBy('createdAt', 'asc'), limit(200)), (sn) => cb(sn.docs.map((d) => ({ id: d.id, ...d.data() }))));
export const postToChannel = (id, text) => addDoc(collection(db, 'channels', id, 'posts'), { text, createdAt: serverTimestamp() });
