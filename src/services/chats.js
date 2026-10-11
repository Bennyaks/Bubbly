import {
  collection, doc, onSnapshot, getDoc, setDoc, addDoc, updateDoc, query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { call } from './callable';
import { resolveUsernames } from './profiles';

const dmId = (a, b) => [a, b].sort().join('_'); // must match dmId() in firestore.rules

export function chatTitle(c, uid) {
  if (c.type === 'group') return c.title;
  const other = c.members.find((m) => m !== uid);
  return (c.names && c.names[other]) || 'Chat';
}

// Finds or creates the one-to-one chat between me and another person. Returns the chat id.
export async function startDirectChat(me, otherUid, otherName) {
  const id = dmId(me.uid, otherUid);
  const existing = await getDoc(doc(db, 'chats', id));
  if (!existing.exists()) {
    await setDoc(doc(db, 'chats', id), {
      type: 'direct', members: [me.uid, otherUid], names: { [me.uid]: me.username, [otherUid]: otherName }, createdAt: serverTimestamp(),
    });
  }
  return id;
}

// usernames: array of @names. Returns the new chat id.
export async function startChatByUsernames(me, usernames, groupTitle) {
  const found = await resolveUsernames(usernames);
  if (groupTitle) {
    const r = await addDoc(collection(db, 'chats'), {
      type: 'group', title: groupTitle, members: [me.uid, ...Object.keys(found)], names: { [me.uid]: me.username, ...found },
      ownerUid: me.uid, createdAt: serverTimestamp(),
    });
    return r.id;
  }
  const [uid, name] = Object.entries(found)[0];
  return startDirectChat(me, uid, name);
}

export const watchChats = (uid, cb) =>
  onSnapshot(query(collection(db, 'chats'), where('members', 'array-contains', uid), limit(100)), (sn) => cb(sn.docs.map((d) => ({ id: d.id, ...d.data() }))));
export const watchChat = (chatId, cb, onErr) =>
  onSnapshot(doc(db, 'chats', chatId), (d) => cb(d.exists() ? { id: d.id, ...d.data() } : null), onErr);

// Newest `max` messages, delivered oldest-first. Raise max to load earlier messages.
export const watchMessages = (chatId, max, cb) =>
  onSnapshot(query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(max)),
    (sn) => cb(sn.docs.map((d) => ({ id: d.id, ...d.data() })).reverse()));
export const sendMessage = (chatId, me, text) =>
  addDoc(collection(db, 'chats', chatId, 'messages'), { text, from: me.uid, fromName: me.username, createdAt: serverTimestamp() });
export const markRead = (chatId, uid) =>
  updateDoc(doc(db, 'chats', chatId), { [`lastRead.${uid}`]: serverTimestamp(), [`unread.${uid}`]: 0 }).catch(() => {});

// my own pin / mute / archive settings per chat
export const watchChatPrefs = (uid, cb) =>
  onSnapshot(collection(db, 'users', uid, 'chatPrefs'), (sn) => { const m = {}; sn.docs.forEach((d) => { m[d.id] = d.data(); }); cb(m); });
export const setChatPref = (uid, chatId, patch) => setDoc(doc(db, 'users', uid, 'chatPrefs', chatId), patch, { merge: true });

export const leaveGroup = (chatId) => call('leaveGroup', { chatId });
export const addGroupMembers = (chatId, usernames) => call('addGroupMembers', { chatId, usernames });
