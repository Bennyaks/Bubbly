// Security tests: prove that people CANNOT do things they should not be able to do.
// Needs the emulators, so run it with:   npm run test:rules
// (this script starts Firestore and Storage emulators on your laptop, runs the tests, and stops them)
const { describe, it, before, after, beforeEach } = require('node:test');
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, writeBatch, getDocs, query, where, arrayUnion, arrayRemove,
} = require('firebase/firestore');
const { ref, uploadBytes, getBytes, deleteObject } = require('firebase/storage');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-zeva',
    firestore: { rules: read('firestore.rules') },
    storage: { rules: read('storage.rules') },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await env.clearStorage(); });

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
const ts = () => serverTimestamp();

const newPost = (uid, extra = {}) => ({
  uid, author: `${uid}_name`, caption: 'hello #zeva', status: 'processing',
  likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 0, completeCount: 0, score: 0, createdAt: ts(), ...extra,
});
const readyPost = (uid) => ({ uid, author: uid, caption: 'x', status: 'ready', likeCount: 3, commentCount: 0, shareCount: 0, viewCount: 9, completeCount: 1, score: 2, createdAt: new Date() });

describe('signed-out visitors', () => {
  it('cannot read anything', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'posts/p1'), readyPost('alice'));
      await setDoc(doc(db, 'profiles/alice'), { username: 'alice1' });
      await setDoc(doc(db, 'usernames/alice1'), { uid: 'alice' });
    });
    const db = anon();
    await assertFails(getDoc(doc(db, 'posts/p1')));
    await assertFails(getDoc(doc(db, 'profiles/alice')));
    await assertFails(getDoc(doc(db, 'usernames/alice1')));
    await assertFails(getDocs(query(collection(db, 'posts'), where('status', '==', 'ready'))));
  });
  it('cannot write anything', async () => {
    await assertFails(setDoc(doc(anon(), 'posts/p1'), newPost('alice')));
  });
});

describe('videos (posts)', () => {
  it('anyone signed in can read a ready video and list the feed', async () => {
    await seed((db) => setDoc(doc(db, 'posts/p1'), readyPost('alice')));
    await assertSucceeds(getDoc(doc(as('bob'), 'posts/p1')));
    await assertSucceeds(getDocs(query(collection(as('bob'), 'posts'), where('status', '==', 'ready'))));
  });
  it('nobody else can see a video that is still processing, but the owner can', async () => {
    await seed((db) => setDoc(doc(db, 'posts/p1'), { ...readyPost('alice'), status: 'processing' }));
    await assertFails(getDoc(doc(as('bob'), 'posts/p1')));
    await assertSucceeds(getDoc(doc(as('alice'), 'posts/p1')));
  });
  it('cannot list the whole collection without filtering for ready videos', async () => {
    await assertFails(getDocs(collection(as('bob'), 'posts')));
  });
  it('can create your own post in the processing state', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'posts/p1'), newPost('alice')));
  });
  it('cannot post as someone else', async () => {
    await assertFails(setDoc(doc(as('mallory'), 'posts/p1'), newPost('alice')));
  });
  it('cannot publish directly, fake counters, fake a score, or add extra fields', async () => {
    const db = as('alice');
    await assertFails(setDoc(doc(db, 'posts/a'), newPost('alice', { status: 'ready' })));
    await assertFails(setDoc(doc(db, 'posts/b'), newPost('alice', { likeCount: 1000000 })));
    await assertFails(setDoc(doc(db, 'posts/c'), newPost('alice', { score: 99 })));
    await assertFails(setDoc(doc(db, 'posts/d'), newPost('alice', { videoUrl: 'http://evil.example' })));
    await assertFails(setDoc(doc(db, 'posts/e'), newPost('alice', { caption: 'x'.repeat(151) })));
  });
  it('cannot edit a post, even your own (counters belong to the server)', async () => {
    await seed((db) => setDoc(doc(db, 'posts/p1'), readyPost('alice')));
    await assertFails(updateDoc(doc(as('alice'), 'posts/p1'), { likeCount: 999 }));
    await assertFails(updateDoc(doc(as('alice'), 'posts/p1'), { caption: 'changed' }));
    await assertFails(updateDoc(doc(as('bob'), 'posts/p1'), { likeCount: 999 }));
  });
  it('only the owner can delete', async () => {
    await seed((db) => setDoc(doc(db, 'posts/p1'), readyPost('alice')));
    await assertFails(deleteDoc(doc(as('bob'), 'posts/p1')));
    await assertSucceeds(deleteDoc(doc(as('alice'), 'posts/p1')));
  });
});

describe('likes and comments', () => {
  beforeEach(() => seed((db) => setDoc(doc(db, 'posts/p1'), readyPost('alice'))));
  it('you can like and unlike as yourself only', async () => {
    await assertSucceeds(setDoc(doc(as('bob'), 'posts/p1/likes/bob'), { createdAt: ts() }));
    await assertFails(setDoc(doc(as('bob'), 'posts/p1/likes/carol'), { createdAt: ts() }));
    await assertFails(setDoc(doc(as('bob'), 'posts/p1/likes/bob'), { createdAt: ts(), extra: 1 }));
    await seed((db) => setDoc(doc(db, 'posts/p1/likes/carol'), { createdAt: new Date() }));
    await assertFails(deleteDoc(doc(as('bob'), 'posts/p1/likes/carol')));
    await assertSucceeds(deleteDoc(doc(as('carol'), 'posts/p1/likes/carol')));
  });
  it('you can comment as yourself, within the length limit', async () => {
    const c = (uid, text) => ({ text, uid, author: uid, createdAt: ts() });
    await assertSucceeds(addDoc(collection(as('bob'), 'posts/p1/comments'), c('bob', 'nice!')));
    await assertFails(addDoc(collection(as('bob'), 'posts/p1/comments'), c('carol', 'forged')));
    await assertFails(addDoc(collection(as('bob'), 'posts/p1/comments'), c('bob', '')));
    await assertFails(addDoc(collection(as('bob'), 'posts/p1/comments'), c('bob', 'x'.repeat(501))));
  });
  it('the commenter and the video owner can delete a comment, strangers cannot', async () => {
    await seed((db) => setDoc(doc(db, 'posts/p1/comments/c1'), { text: 'hi', uid: 'bob', author: 'bob', createdAt: new Date() }));
    await assertFails(deleteDoc(doc(as('mallory'), 'posts/p1/comments/c1')));
    await assertSucceeds(deleteDoc(doc(as('alice'), 'posts/p1/comments/c1')));
    await seed((db) => setDoc(doc(db, 'posts/p1/comments/c2'), { text: 'hi', uid: 'bob', author: 'bob', createdAt: new Date() }));
    await assertSucceeds(deleteDoc(doc(as('bob'), 'posts/p1/comments/c2')));
  });
});

describe('usernames and profiles', () => {
  const claim = (db, uid, name) => {
    const b = writeBatch(db);
    b.set(doc(db, 'usernames', name), { uid });
    b.set(doc(db, 'profiles', uid), { username: name, createdAt: ts() });
    return b.commit();
  };
  it('you can claim a valid username', async () => { await assertSucceeds(claim(as('alice'), 'alice', 'alice_1')); });
  it('a taken username cannot be stolen', async () => {
    await seed((db) => setDoc(doc(db, 'usernames/alice_1'), { uid: 'alice' }));
    await assertFails(claim(as('bob'), 'bob', 'alice_1'));
  });
  it('rejects bad formats and reserved names', async () => {
    for (const bad of ['ab', 'UPPER', 'has space', 'dash-name', 'x'.repeat(21), 'admin', 'support', 'zeva']) {
      await assertFails(claim(as('alice'), 'alice', bad));
    }
  });
  it('one account cannot hold two usernames', async () => {
    await assertSucceeds(claim(as('alice'), 'alice', 'first_name'));
    await assertFails(claim(as('alice'), 'alice', 'second_name'));
  });
  it('a username cannot be claimed without a matching profile, or for someone else', async () => {
    await assertFails(setDoc(doc(as('alice'), 'usernames/lonely'), { uid: 'alice' }));
    await assertFails(setDoc(doc(as('alice'), 'usernames/forged'), { uid: 'bob' }));
  });
  it('you can edit your bio and display name, but not your username or counters', async () => {
    await seed((db) => setDoc(doc(db, 'profiles/alice'), { username: 'alice_1', followerCount: 3 }));
    const db = as('alice');
    await assertSucceeds(updateDoc(doc(db, 'profiles/alice'), { bio: 'hello', displayName: 'Alice' }));
    await assertFails(updateDoc(doc(db, 'profiles/alice'), { username: 'someone_else' }));
    await assertFails(updateDoc(doc(db, 'profiles/alice'), { followerCount: 1000000 }));
    await assertFails(updateDoc(doc(db, 'profiles/alice'), { bio: 'x'.repeat(151) }));
    await assertFails(updateDoc(doc(as('bob'), 'profiles/alice'), { bio: 'hacked' }));
  });
});

describe('private settings', () => {
  it('only you can read or write yours, and only the allowed field', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'users/alice'), { links: { X: 'alice' } }));
    await assertFails(getDoc(doc(as('bob'), 'users/alice')));
    await assertFails(setDoc(doc(as('bob'), 'users/alice'), { links: {} }));
    await assertFails(setDoc(doc(as('alice'), 'users/alice'), { links: {}, isAdmin: true }));
  });
  it('server-only data is closed to everyone', async () => {
    const db = as('alice');
    await assertFails(setDoc(doc(db, 'users/alice/seen/p1'), { at: ts() }));
    await assertFails(getDoc(doc(db, 'pushTokens/alice')));
    await assertFails(setDoc(doc(db, 'pushTokens/alice'), { tokens: ['x'] }));
    await assertFails(setDoc(doc(db, 'reports/r1'), { type: 'post' }));
    await assertFails(setDoc(doc(db, 'ratelimits/alice_report'), { count: 0 }));
    await assertFails(setDoc(doc(db, 'meta/trending'), { tags: [] }));
  });
});

describe('following', () => {
  const f = (a, b) => ({ follower: a, followee: b, createdAt: ts() });
  it('you can follow and unfollow as yourself', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'follows/alice_bob'), f('alice', 'bob')));
    await assertSucceeds(deleteDoc(doc(as('alice'), 'follows/alice_bob')));
  });
  it('you cannot follow as someone else, follow yourself, or use a wrong id', async () => {
    await assertFails(setDoc(doc(as('mallory'), 'follows/alice_bob'), f('alice', 'bob')));
    await assertFails(setDoc(doc(as('alice'), 'follows/alice_alice'), f('alice', 'alice')));
    await assertFails(setDoc(doc(as('alice'), 'follows/anything'), f('alice', 'bob')));
  });
  it('you cannot remove someone else\'s follow', async () => {
    await seed((db) => setDoc(doc(db, 'follows/alice_bob'), { follower: 'alice', followee: 'bob', createdAt: new Date() }));
    await assertFails(deleteDoc(doc(as('bob'), 'follows/alice_bob')));
  });
});

describe('chats', () => {
  const dm = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const direct = (a, b) => ({ type: 'direct', members: [a, b], names: { [a]: a, [b]: b }, createdAt: ts() });
  it('you can open a direct chat with the correct id', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'chats', dm('alice', 'bob')), direct('alice', 'bob')));
  });
  it('you cannot forge a chat id, or create a chat between two OTHER people', async () => {
    await assertFails(setDoc(doc(as('alice'), 'chats/random_id'), direct('alice', 'bob')));
    await assertFails(setDoc(doc(as('mallory'), 'chats', dm('alice', 'bob')), direct('alice', 'bob')));
  });
  it('group chats: you must be the owner and a member', async () => {
    const g = (owner, members) => ({ type: 'group', title: 'Friends', members, names: {}, ownerUid: owner, createdAt: ts() });
    await assertSucceeds(addDoc(collection(as('alice'), 'chats'), g('alice', ['alice', 'bob'])));
    await assertFails(addDoc(collection(as('alice'), 'chats'), g('bob', ['alice', 'bob'])));
    await assertFails(addDoc(collection(as('mallory'), 'chats'), g('alice', ['alice', 'bob'])));
  });
  describe('inside an existing chat', () => {
    const id = dm('alice', 'bob');
    beforeEach(() => seed((db) => setDoc(doc(db, 'chats', id), { type: 'direct', members: ['alice', 'bob'], names: {}, createdAt: new Date(), lastMessage: { text: 'hi' } })));
    it('members can read, outsiders cannot', async () => {
      await assertSucceeds(getDoc(doc(as('alice'), 'chats', id)));
      await assertFails(getDoc(doc(as('mallory'), 'chats', id)));
      await assertFails(getDocs(query(collection(as('mallory'), 'chats'), where('members', 'array-contains', 'alice'))));
    });
    it('members can send messages as themselves; outsiders and impostors cannot', async () => {
      const m = (from, text) => ({ text, from, fromName: from, createdAt: ts() });
      await assertSucceeds(addDoc(collection(as('alice'), 'chats', id, 'messages'), m('alice', 'hello')));
      await assertFails(addDoc(collection(as('alice'), 'chats', id, 'messages'), m('bob', 'forged')));
      await assertFails(addDoc(collection(as('mallory'), 'chats', id, 'messages'), m('mallory', 'let me in')));
      await assertFails(addDoc(collection(as('alice'), 'chats', id, 'messages'), m('alice', '')));
      await assertFails(addDoc(collection(as('alice'), 'chats', id, 'messages'), m('alice', 'x'.repeat(4001))));
    });
    it('outsiders cannot read messages', async () => {
      await seed((db) => setDoc(doc(db, 'chats', id, 'messages', 'm1'), { text: 'secret', from: 'alice', fromName: 'a', createdAt: new Date() }));
      await assertSucceeds(getDoc(doc(as('bob'), 'chats', id, 'messages/m1')));
      await assertFails(getDoc(doc(as('mallory'), 'chats', id, 'messages/m1')));
    });
    it('you can only change YOUR OWN read marker and unread count', async () => {
      await assertSucceeds(updateDoc(doc(as('alice'), 'chats', id), { 'lastRead.alice': ts(), 'unread.alice': 0 }));
      await assertFails(updateDoc(doc(as('alice'), 'chats', id), { 'unread.bob': 0 }));
      await assertFails(updateDoc(doc(as('alice'), 'chats', id), { lastMessage: { text: 'forged' } }));
      await assertFails(updateDoc(doc(as('alice'), 'chats', id), { members: arrayUnion('mallory') }));
      await assertFails(updateDoc(doc(as('mallory'), 'chats', id), { 'unread.mallory': 0 }));
    });
  });
});

describe('channels', () => {
  const ch = (uid) => ({ name: 'News', ownerUid: uid, members: [uid], createdAt: ts() });
  it('you can create a channel you own', async () => {
    await assertSucceeds(addDoc(collection(as('alice'), 'channels'), ch('alice')));
  });
  it('you cannot create one for someone else, or start with other members', async () => {
    await assertFails(addDoc(collection(as('mallory'), 'channels'), ch('alice')));
    await assertFails(addDoc(collection(as('alice'), 'channels'), { ...ch('alice'), members: ['alice', 'bob'] }));
  });
  describe('existing channel', () => {
    beforeEach(() => seed((db) => setDoc(doc(db, 'channels/c1'), { name: 'News', ownerUid: 'alice', members: ['alice', 'carol'], createdAt: new Date() })));
    it('you can join and leave yourself', async () => {
      await assertSucceeds(updateDoc(doc(as('bob'), 'channels/c1'), { members: arrayUnion('bob') }));
      await assertSucceeds(updateDoc(doc(as('carol'), 'channels/c1'), { members: arrayRemove('carol') }));
    });
    it('you cannot add or remove OTHER people', async () => {
      await assertFails(updateDoc(doc(as('bob'), 'channels/c1'), { members: arrayUnion('mallory') }));
      await assertFails(updateDoc(doc(as('bob'), 'channels/c1'), { members: arrayRemove('carol') }));
      await assertFails(updateDoc(doc(as('bob'), 'channels/c1'), { members: ['bob'] }));
    });
    it('you cannot rename it or change the owner', async () => {
      await assertFails(updateDoc(doc(as('bob'), 'channels/c1'), { name: 'Hacked' }));
      await assertFails(updateDoc(doc(as('bob'), 'channels/c1'), { ownerUid: 'bob' }));
    });
    it('only the owner can post', async () => {
      await assertSucceeds(addDoc(collection(as('alice'), 'channels/c1/posts'), { text: 'update', createdAt: ts() }));
      await assertFails(addDoc(collection(as('bob'), 'channels/c1/posts'), { text: 'spam', createdAt: ts() }));
    });
  });
});

describe('activity feed and chat preferences', () => {
  it('only you can read, mark read, or delete your notifications; nobody can create them', async () => {
    await seed((db) => setDoc(doc(db, 'notifications/alice/items/n1'), { type: 'like', text: 'x', read: false, createdAt: new Date() }));
    await assertSucceeds(getDoc(doc(as('alice'), 'notifications/alice/items/n1')));
    await assertFails(getDoc(doc(as('bob'), 'notifications/alice/items/n1')));
    await assertSucceeds(updateDoc(doc(as('alice'), 'notifications/alice/items/n1'), { read: true }));
    await assertFails(updateDoc(doc(as('alice'), 'notifications/alice/items/n1'), { text: 'forged' }));
    await assertFails(setDoc(doc(as('alice'), 'notifications/alice/items/n2'), { type: 'like', read: false }));
    await assertFails(setDoc(doc(as('bob'), 'notifications/alice/items/n3'), { type: 'like', read: false }));
  });
  it('chat preferences are private', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'users/alice/chatPrefs/c1'), { pinned: true }));
    await assertFails(getDoc(doc(as('bob'), 'users/alice/chatPrefs/c1')));
    await assertFails(setDoc(doc(as('bob'), 'users/alice/chatPrefs/c1'), { muted: true }));
  });
});

describe('live', () => {
  beforeEach(() => seed(async (db) => {
    await setDoc(doc(db, 'lives/L1'), { hostUid: 'alice', status: 'live', title: 't', viewerCount: 0 });
    await setDoc(doc(db, 'lives/L2'), { hostUid: 'alice', status: 'ended', title: 't', viewerCount: 0 });
  }));
  it('anyone signed in can see lives, but nobody can create or edit one from the app', async () => {
    await assertSucceeds(getDoc(doc(as('bob'), 'lives/L1')));
    await assertFails(setDoc(doc(as('bob'), 'lives/L9'), { hostUid: 'bob', status: 'live' }));
    await assertFails(updateDoc(doc(as('alice'), 'lives/L1'), { viewerCount: 1000000 }));
  });
  it('there is no follower requirement: a brand-new user can chat in a live', async () => {
    await assertSucceeds(addDoc(collection(as('newbie'), 'lives/L1/messages'), { text: 'hi', from: 'newbie', fromName: 'newbie', createdAt: ts() }));
  });
  it('live chat is closed once the live has ended, and cannot be forged', async () => {
    await assertFails(addDoc(collection(as('bob'), 'lives/L2/messages'), { text: 'late', from: 'bob', fromName: 'bob', createdAt: ts() }));
    await assertFails(addDoc(collection(as('bob'), 'lives/L1/messages'), { text: 'x', from: 'carol', fromName: 'carol', createdAt: ts() }));
    await assertFails(addDoc(collection(as('bob'), 'lives/L1/messages'), { text: 'x'.repeat(201), from: 'bob', fromName: 'bob', createdAt: ts() }));
  });
  it('viewers can register and remove only their own presence', async () => {
    await assertSucceeds(setDoc(doc(as('bob'), 'lives/L1/viewers/bob'), { at: ts() }));
    await assertFails(setDoc(doc(as('bob'), 'lives/L1/viewers/carol'), { at: ts() }));
    await assertSucceeds(deleteDoc(doc(as('bob'), 'lives/L1/viewers/bob')));
  });
});

describe('video files (Storage)', () => {
  const st = (uid) => env.authenticatedContext(uid).storage();
  const bytes = (n) => new Uint8Array(n).fill(7);
  const mp4 = { contentType: 'video/mp4' };
  const seedFile = () => env.withSecurityRulesDisabled((ctx) => uploadBytes(ref(ctx.storage(), 'videos/alice/abc123.mp4'), bytes(4096), mp4));

  it('you can upload your own video', async () => {
    await assertSucceeds(uploadBytes(ref(st('alice'), 'videos/alice/abc123.mp4'), bytes(4096), mp4));
  });
  it('you cannot upload into someone else\'s folder', async () => {
    await assertFails(uploadBytes(ref(st('mallory'), 'videos/alice/abc123.mp4'), bytes(4096), mp4));
  });
  it('rejects tiny (broken) files, wrong types, wrong names, and signed-out uploads', async () => {
    await assertFails(uploadBytes(ref(st('alice'), 'videos/alice/tiny.mp4'), bytes(14), mp4));
    await assertFails(uploadBytes(ref(st('alice'), 'videos/alice/a.mp4'), bytes(4096), { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(st('alice'), 'videos/alice/a.exe'), bytes(4096), mp4));
    await assertFails(uploadBytes(ref(st('alice'), 'videos/alice/sub/dir.mp4'), bytes(4096), mp4));
    await assertFails(uploadBytes(ref(env.unauthenticatedContext().storage(), 'videos/alice/x.mp4'), bytes(4096), mp4));
  });
  it('you cannot overwrite an existing video', async () => {
    await seedFile();
    await assertFails(uploadBytes(ref(st('alice'), 'videos/alice/abc123.mp4'), bytes(5000), mp4));
  });
  it('signed-in people can watch; signed-out cannot', async () => {
    await seedFile();
    await assertSucceeds(getBytes(ref(st('bob'), 'videos/alice/abc123.mp4')));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), 'videos/alice/abc123.mp4')));
  });
  it('only the owner can delete', async () => {
    await seedFile();
    await assertFails(deleteObject(ref(st('bob'), 'videos/alice/abc123.mp4')));
    await assertSucceeds(deleteObject(ref(st('alice'), 'videos/alice/abc123.mp4')));
  });
  it('thumbnails are written by the server only, and no other paths are open', async () => {
    await assertFails(uploadBytes(ref(st('alice'), 'thumbs/alice/abc123.jpg'), bytes(4096), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(st('alice'), 'random/file.txt'), bytes(100), { contentType: 'text/plain' }));
  });
});
