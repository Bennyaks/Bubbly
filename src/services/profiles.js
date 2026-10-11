import {
  doc, onSnapshot, getDoc, getDocs, updateDoc, setDoc, runTransaction, serverTimestamp, collection, query, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { call } from './callable';
import { usernameProblem, cleanUsername } from '../validation';

export const watchProfile = (uid, onData, onError) =>
  onSnapshot(doc(db, 'profiles', uid), (d) => onData(d.exists() ? d.data() : null), onError);

// uid -> profile for a list of people (people who no longer exist come back as {username:'user'})
export async function loadProfiles(uids) {
  const pairs = await Promise.all(uids.map((u) => getDoc(doc(db, 'profiles', u)).then((d) => [u, d.exists() ? d.data() : { username: 'user' }])));
  return Object.fromEntries(pairs);
}

// Claims a unique @username and creates the profile in one transaction.
export async function claimUsername(uid, raw) {
  const problem = usernameProblem(raw);
  if (problem) throw new Error(problem);
  const name = cleanUsername(raw);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'usernames', name);
    if ((await tx.get(ref)).exists()) throw new Error('That username is already taken.');
    tx.set(ref, { uid });
    tx.set(doc(db, 'profiles', uid), { username: name, createdAt: serverTimestamp() });
  });
  return name;
}

export const updateProfile = (uid, { displayName, bio }) =>
  updateDoc(doc(db, 'profiles', uid), { displayName: displayName.trim(), bio: bio.trim() });

export async function uidOfUsername(raw) {
  const d = await getDoc(doc(db, 'usernames', cleanUsername(raw)));
  return d.exists() ? d.data().uid : null;
}

// Resolves @names to {uid: name}. Throws a readable error for the first name that does not exist.
export async function resolveUsernames(names) {
  const out = {};
  for (const n of names) {
    const uid = await uidOfUsername(n);
    if (!uid) throw new Error(`No user called @${cleanUsername(n)}`);
    out[uid] = cleanUsername(n);
  }
  return out;
}

export const searchUsers = (q) => call('searchUsers', { q }).then((r) => r.users || []);

// Most followed people, then the newest members, so the list is never empty
export async function discoverProfiles() {
  const [top, fresh] = await Promise.all([
    getDocs(query(collection(db, 'profiles'), orderBy('followerCount', 'desc'), limit(20))),
    getDocs(query(collection(db, 'profiles'), orderBy('createdAt', 'desc'), limit(20))),
  ]);
  const seen = new Set();
  return [...top.docs, ...fresh.docs].filter((d) => (seen.has(d.id) ? false : seen.add(d.id))).map((d) => ({ uid: d.id, ...d.data() }));
}

export const watchTrending = (onData) =>
  onSnapshot(doc(db, 'meta', 'trending'), (d) => onData((d.data() || {}).tags || []), () => {});

// private settings: linked social usernames
export const watchLinks = (uid, onData) => onSnapshot(doc(db, 'users', uid), (d) => onData((d.data() || {}).links || {}));
export const setLinks = (uid, links) => setDoc(doc(db, 'users', uid), { links }, { merge: true });
