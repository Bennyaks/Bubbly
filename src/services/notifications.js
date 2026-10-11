import { collection, onSnapshot, query, where, orderBy, limit, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const items = (uid) => collection(db, 'notifications', uid, 'items');

export const watchActivity = (uid, max, cb) =>
  onSnapshot(query(items(uid), orderBy('createdAt', 'desc'), limit(max)),
    (sn) => cb(sn.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))), (e) => console.warn('activity', e.message));
export const watchUnreadActivity = (uid, cb) =>
  onSnapshot(query(items(uid), where('read', '==', false), limit(50)), (sn) => cb(sn.size), () => {});
export const markActivityRead = (ref) => updateDoc(ref, { read: true }).catch(() => {});
