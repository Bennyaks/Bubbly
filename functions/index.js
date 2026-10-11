const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const { randomUUID } = require('crypto');
const ffmpegPath = require('ffmpeg-static');

const { FieldValue, FieldPath, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');
const { setGlobalOptions } = require('firebase-functions/v2');
const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const { db, REGION, profileOf, needAuth, push, rateLimit, notify, callable, logger } = require('./lib');
const { milestone, extractHashtags, rankScore, videoProblem } = require('./logic');
const { run, videoDuration } = require('./video');
setGlobalOptions({ region: REGION, maxInstances: 20 });

// Live rooms (chat, viewers, heartbeat). Video transport needs LiveKit: see docs/LIVE.md
Object.assign(exports, require('./live'));

const ignore = () => {}; // counters must not crash if the target was deleted

// =====================================================================
// 1. VIDEO PIPELINE (TikTok)
// Client creates posts/{id} with status "processing", then uploads
// videos/{uid}/{id}.mp4. This trigger validates it, makes a thumbnail,
// then flips the post to "ready" so it can appear in feeds.
// =====================================================================
exports.onVideoUploaded = onObjectFinalized({ memory: '1GiB', timeoutSeconds: 300 }, async (event) => {
  const obj = event.data;
  const m = obj.name.match(/^videos\/([^/]+)\/([^/.]+)\.mp4$/);
  if (!m) return;
  const [, uid, postId] = m;
  const postRef = db.doc(`posts/${postId}`);
  const post = (await postRef.get()).data();
  if (!post || post.uid !== uid || post.status !== 'processing') return;

  const bucket = getStorage().bucket(obj.bucket);
  const base = path.join(os.tmpdir(), postId);
  const src = `${base}.mp4`;
  const thumb = `${base}.jpg`;
  try {
    await bucket.file(obj.name).download({ destination: src });
    const bytes = (await fs.stat(src)).size;
    logger.info(`video ${postId}: storage says ${obj.size} bytes, downloaded ${bytes} bytes`);
    let dur = 0;
    if (bytes >= 1024) {
      const r = await videoDuration(ffmpegPath, src);
      dur = r.dur;
      if (!dur) logger.error(`video ${postId} unreadable (${bytes} bytes): ${r.detail}`);
    } else {
      const buf = await fs.readFile(src);
      logger.error(`video ${postId} tiny file content`, { text: JSON.stringify(buf.toString('utf8')).slice(0, 80), hex: buf.toString('hex').slice(0, 80) });
    }
    const problem = videoProblem(bytes, dur);
    if (problem) throw new Error(problem);

    const t = await run(ffmpegPath, ['-y', '-ss', String(Math.min(1, dur / 2)), '-i', src, '-frames:v', '1', '-vf', 'scale=480:-2', thumb]);
    if (t.code !== 0) throw new Error('Could not create thumbnail.');

    const thumbPath = `thumbs/${uid}/${postId}.jpg`;
    const thumbToken = randomUUID();
    await bucket.upload(thumb, { destination: thumbPath, metadata: { contentType: 'image/jpeg', metadata: { firebaseStorageDownloadTokens: thumbToken } } });

    let vToken = ((obj.metadata || {}).firebaseStorageDownloadTokens || '').split(',')[0];
    if (!vToken) {
      vToken = randomUUID();
      await bucket.file(obj.name).setMetadata({ metadata: { firebaseStorageDownloadTokens: vToken } });
    }
    // Store paths + tokens; the app builds the URL for whichever Storage it talks to (emulator or real).
    // Full URLs are only written in production, where the address never changes.
    const url = (p, tok) => `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(p)}?alt=media&token=${tok}`;
    const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
    const tags = extractHashtags(post.caption);

    await postRef.update({
      status: 'ready',
      videoPath: obj.name, videoToken: vToken, thumbPath, thumbToken,
      ...(emulator ? {} : { videoUrl: url(obj.name, vToken), thumbUrl: url(thumbPath, thumbToken) }),
      durationSec: Math.round(dur), hashtags: tags, score: 1,
    });
    await db.doc(`profiles/${uid}`).update({ videoCount: FieldValue.increment(1) }).catch(ignore);
  } catch (e) {
    logger.error(`video ${postId} failed`, { error: e.message });
    await postRef.update({ status: 'failed', error: String(e.message).slice(0, 200) }).catch(ignore);
    await bucket.file(obj.name).delete().catch(ignore);
  } finally {
    await fs.rm(src, { force: true });
    await fs.rm(thumb, { force: true });
  }
});

// =====================================================================
// 2. ENGAGEMENT COUNTERS + NOTIFICATIONS (likes, comments, follows)
// Clients can never write counters; only these triggers do.
// =====================================================================
exports.onLikeCreated = onDocumentCreated('posts/{postId}/likes/{uid}', async (e) => {
  const { postId, uid } = e.params;
  const ref = db.doc(`posts/${postId}`);
  await ref.update({ likeCount: FieldValue.increment(1) }).catch(ignore);
  const post = (await ref.get()).data();
  if (post && post.uid !== uid) {
    const me = await profileOf(uid);
    await notify(post.uid, `like_${postId}_${uid}`, { type: 'like', fromUid: uid, fromName: me.username || 'someone', postId, text: 'liked your video' });
    if (milestone(post.likeCount || 0)) {
      await push([post.uid], { title: 'New like', body: `@${me.username || 'someone'} liked your video`, data: { type: 'like', postId } });
    }
  }
});
exports.onLikeDeleted = onDocumentDeleted('posts/{postId}/likes/{uid}', (e) =>
  db.doc(`posts/${e.params.postId}`).update({ likeCount: FieldValue.increment(-1) }).catch(ignore));

exports.onCommentCreated = onDocumentCreated('posts/{postId}/comments/{cid}', async (e) => {
  const { postId } = e.params;
  const c = e.data.data();
  const ref = db.doc(`posts/${postId}`);
  await ref.update({ commentCount: FieldValue.increment(1) }).catch(ignore);
  const post = (await ref.get()).data();
  if (post && post.uid !== c.uid) {
    await notify(post.uid, `comment_${e.params.cid}`, { type: 'comment', fromUid: c.uid, fromName: c.author, postId, text: String(c.text).slice(0, 80) });
    await push([post.uid], { title: `@${c.author} commented`, body: String(c.text).slice(0, 100), data: { type: 'comment', postId } });
  }
});
exports.onCommentDeleted = onDocumentDeleted('posts/{postId}/comments/{cid}', (e) =>
  db.doc(`posts/${e.params.postId}`).update({ commentCount: FieldValue.increment(-1) }).catch(ignore));

exports.onFollowCreated = onDocumentCreated('follows/{id}', async (e) => {
  const { follower, followee } = e.data.data();
  await db.doc(`profiles/${followee}`).update({ followerCount: FieldValue.increment(1) }).catch(ignore);
  await db.doc(`profiles/${follower}`).update({ followingCount: FieldValue.increment(1) }).catch(ignore);
  const me = await profileOf(follower);
  await notify(followee, `follow_${follower}`, { type: 'follow', fromUid: follower, fromName: me.username || 'someone', text: 'started following you' });
  await push([followee], { title: 'New follower', body: `@${me.username || 'someone'} started following you`, data: { type: 'follow', uid: follower } });
});
exports.onFollowDeleted = onDocumentDeleted('follows/{id}', async (e) => {
  const { follower, followee } = e.data.data();
  await db.doc(`profiles/${followee}`).update({ followerCount: FieldValue.increment(-1) }).catch(ignore);
  await db.doc(`profiles/${follower}`).update({ followingCount: FieldValue.increment(-1) }).catch(ignore);
});

// =====================================================================
// 3. MESSAGING (Telegram): last message, unread counters, push
// =====================================================================
exports.onMessageCreated = onDocumentCreated('chats/{chatId}/messages/{msgId}', async (e) => {
  const m = e.data.data();
  const chatRef = db.doc(`chats/${e.params.chatId}`);
  const chat = (await chatRef.get()).data();
  if (!chat) return;
  const others = chat.members.filter((u) => u !== m.from);
  const upd = { lastMessage: { text: String(m.text).slice(0, 80), from: m.from, at: m.createdAt || Timestamp.now() } };
  others.forEach((u) => { upd[`unread.${u}`] = FieldValue.increment(1); });
  await chatRef.update(upd);
  const isGroup = chat.type === 'group';
  const prefs = await Promise.all(others.map((u) => db.doc(`users/${u}/chatPrefs/${e.params.chatId}`).get()));
  const audible = others.filter((u, i) => !(prefs[i].data() || {}).muted); // muted chats still count unread, but stay silent
  await push(audible, {
    title: isGroup ? chat.title : `@${m.fromName}`,
    body: (isGroup ? `${m.fromName}: ` : '') + String(m.text).slice(0, 100),
    data: { type: 'message', chatId: e.params.chatId },
  });
});

// Channels: notify members when the owner posts (first 1000 members; see BACKEND.md for scale-up).
exports.onChannelPostCreated = onDocumentCreated('channels/{channelId}/posts/{pid}', async (e) => {
  const ch = (await db.doc(`channels/${e.params.channelId}`).get()).data();
  if (!ch) return;
  const p = e.data.data();
  const targets = (ch.members || []).filter((u) => u !== ch.ownerUid).slice(0, 1000);
  await push(targets, { title: `📣 ${ch.name}`, body: String(p.text).slice(0, 100), data: { type: 'channel', channelId: e.params.channelId } });
});

// =====================================================================
// 4. FEED RANKING + TRENDING (TikTok "For You")
// score = engagement / (age + 2)^1.5, with a boost so new videos get seen.
// Clients read: posts where status == "ready" order by score desc.
// =====================================================================
async function rankAll() {
  const since = Timestamp.fromMillis(Date.now() - 30 * 864e5);
  const snap = await db.collection('posts').where('status', '==', 'ready').where('createdAt', '>=', since)
    .orderBy('createdAt', 'desc').limit(2000).get();
  const now = Date.now();
  const tagScore = {};
  let batch = db.batch();
  let n = 0;
  for (const d of snap.docs) {
    const p = d.data();
    const ageH = Math.max(0, (now - (p.createdAt ? p.createdAt.toMillis() : now)) / 36e5);
    batch.update(d.ref, { score: rankScore(p, now) });
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    if (ageH <= 24) (p.hashtags || []).forEach((t) => { tagScore[t] = (tagScore[t] || 0) + 1 + 0.1 * (p.likeCount || 0); });
  }
  await batch.commit();
  const tags = Object.entries(tagScore).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([tag, score]) => ({ tag, score }));
  await db.doc('meta/trending').set({ tags, updatedAt: FieldValue.serverTimestamp() });
}
exports.rankFeed = onSchedule({ schedule: 'every 15 minutes', memory: '512MiB', timeoutSeconds: 300 }, rankAll);

// Scheduled functions do not fire on the local emulator, so this lets you run the ranking by hand:
// open http://localhost:5001/bubbly-bfef3/us-central1/rankFeedNow in a browser. Refuses to run in production.
exports.rankFeedNow = onRequest(async (req, res) => {
  if (process.env.FUNCTIONS_EMULATOR !== 'true') return res.status(403).send('Emulator only');
  await rankAll();
  res.send('Feed ranked');
});

// One count per user per video; "completed" upgrades an existing view.
exports.recordView = callable('recordView', async (req) => {
  const uid = needAuth(req);
  const { postId, completed } = req.data || {};
  if (typeof postId !== 'string' || !postId) throw new HttpsError('invalid-argument', 'postId required');
  const seen = db.doc(`users/${uid}/seen/${postId}`);
  const result = await db.runTransaction(async (tx) => {
    const s = await tx.get(seen);
    if (!s.exists) { tx.set(seen, { at: FieldValue.serverTimestamp(), completed: !!completed }); return 'first'; }
    if (completed && !s.data().completed) { tx.update(seen, { completed: true }); return 'completed'; }
    return null;
  });
  const inc = {};
  if (result === 'first') inc.viewCount = FieldValue.increment(1);
  if (result && completed) inc.completeCount = FieldValue.increment(1);
  if (Object.keys(inc).length) await db.doc(`posts/${postId}`).update(inc).catch(ignore);
  return { ok: true };
});

// =====================================================================
// 5. DISCOVERY: user search by username prefix
// =====================================================================
exports.searchUsers = callable('searchUsers', async (req) => {
  needAuth(req);
  const q = String((req.data || {}).q || '').trim().toLowerCase().replace(/^@/, '');
  if (q.length < 2 || q.length > 20) return { users: [] };
  const s = await db.collection('usernames').orderBy(FieldPath.documentId()).startAt(q).endAt(`${q}\uf8ff`).limit(15).get();
  return { users: s.docs.map((d) => ({ username: d.id, uid: d.data().uid })) };
});

// =====================================================================
// 6. PUSH TOKENS
// =====================================================================
exports.registerPushToken = callable('registerPushToken', async (req) => {
  const uid = needAuth(req);
  const { token, remove } = req.data || {};
  if (typeof token !== 'string' || !/^Expo(nent)?PushToken\[.+\]$/.test(token)) throw new HttpsError('invalid-argument', 'Bad push token');
  await rateLimit(uid, 'pushtoken', 20, 86400);
  await db.doc(`pushTokens/${uid}`).set({ tokens: remove ? FieldValue.arrayRemove(token) : FieldValue.arrayUnion(token) }, { merge: true });
  return { ok: true };
});

// =====================================================================
// 7. MODERATION: reports hide content automatically at 5 distinct reports
// (a human review queue/admin dashboard is a later stage)
// =====================================================================
exports.reportContent = callable('reportContent', async (req) => {
  const uid = needAuth(req);
  const { type, id, reason } = req.data || {};
  if (!['post', 'comment', 'user', 'message', 'channel'].includes(type) || typeof id !== 'string' || !id) throw new HttpsError('invalid-argument', 'Bad report');
  await rateLimit(uid, 'report', 10, 3600);
  try {
    await db.doc(`reports/${type}_${id}_${uid}`).create({ type, id, reason: String(reason || '').slice(0, 200), reporter: uid, createdAt: FieldValue.serverTimestamp() });
  } catch (e) {
    if (e.code !== 6) throw e; // 6 = already reported by this user
  }
  return { ok: true };
});
exports.onReportCreated = onDocumentCreated('reports/{rid}', async (e) => {
  const r = e.data.data();
  if (r.type !== 'post') return;
  const c = await db.collection('reports').where('type', '==', 'post').where('id', '==', r.id).count().get();
  if (c.data().count >= 5) await db.doc(`posts/${r.id}`).update({ status: 'removed', removedReason: 'reports' }).catch(ignore);
});

// =====================================================================
// 7b. SHARES, GROUP MANAGEMENT, MAINTENANCE
// =====================================================================

// One share counted per user per video.
exports.recordShare = callable('recordShare', async (req) => {
  const uid = needAuth(req);
  const { postId } = req.data || {};
  if (typeof postId !== 'string' || !postId) throw new HttpsError('invalid-argument', 'postId required');
  const mark = db.doc(`users/${uid}/shared/${postId}`);
  const first = await db.runTransaction(async (tx) => {
    if ((await tx.get(mark)).exists) return false;
    tx.set(mark, { at: FieldValue.serverTimestamp() });
    return true;
  });
  if (first) await db.doc(`posts/${postId}`).update({ shareCount: FieldValue.increment(1) }).catch(ignore);
  return { ok: true };
});

// Group admin actions run on the server because clients may not change a chat's member list.
async function loadGroup(chatId, uid) {
  if (typeof chatId !== 'string' || !chatId) throw new HttpsError('invalid-argument', 'chatId required');
  const ref = db.doc(`chats/${chatId}`);
  const chat = (await ref.get()).data();
  if (!chat || chat.type !== 'group') throw new HttpsError('not-found', 'Group not found.');
  if (!chat.members.includes(uid)) throw new HttpsError('permission-denied', 'You are not in this group.');
  return { ref, chat };
}

exports.addGroupMembers = callable('addGroupMembers', async (req) => {
  const uid = needAuth(req);
  const { chatId, usernames } = req.data || {};
  const { ref, chat } = await loadGroup(chatId, uid);
  if (chat.ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the group owner can add people.');
  const list = [...new Set((Array.isArray(usernames) ? usernames : []).map((n) => String(n).trim().toLowerCase()))]
    .filter((n) => /^[a-z0-9_]{3,20}$/.test(n)).slice(0, 20);
  if (!list.length) throw new HttpsError('invalid-argument', 'Enter at least one username.');
  const add = {};
  for (const n of list) {
    const s = await db.doc(`usernames/${n}`).get();
    if (!s.exists) throw new HttpsError('not-found', `No user called @${n}`);
    if (!chat.members.includes(s.data().uid)) add[s.data().uid] = n;
  }
  if (chat.members.length + Object.keys(add).length > 50) throw new HttpsError('failed-precondition', 'A group can have at most 50 members.');
  const upd = { members: FieldValue.arrayUnion(...Object.keys(add)) };
  Object.entries(add).forEach(([u, n]) => { upd[`names.${u}`] = n; });
  if (Object.keys(add).length) await ref.update(upd);
  return { added: Object.values(add) };
});

exports.leaveGroup = callable('leaveGroup', async (req) => {
  const uid = needAuth(req);
  const { ref, chat } = await loadGroup((req.data || {}).chatId, uid);
  const rest = chat.members.filter((m) => m !== uid);
  if (!rest.length) { await db.recursiveDelete(ref); return { deleted: true }; }
  const upd = {
    members: FieldValue.arrayRemove(uid),
    [`names.${uid}`]: FieldValue.delete(),
    [`unread.${uid}`]: FieldValue.delete(),
    [`lastRead.${uid}`]: FieldValue.delete(),
  };
  if (chat.ownerUid === uid) upd.ownerUid = rest[0]; // hand the group to the next member
  await ref.update(upd);
  return { left: true };
});

// Daily housekeeping: time out stuck uploads, delete old failed posts, clear old rate-limit records.
async function cleanupAll() {
  const hourAgo = Timestamp.fromMillis(Date.now() - 36e5);
  const dayAgo = Timestamp.fromMillis(Date.now() - 864e5);
  const stuck = await db.collection('posts').where('status', '==', 'processing').where('createdAt', '<', hourAgo).limit(200).get();
  await Promise.all(stuck.docs.map((d) => d.ref.update({ status: 'failed', error: 'Processing timed out.' })));
  const failed = await db.collection('posts').where('status', '==', 'failed').where('createdAt', '<', dayAgo).limit(200).get();
  for (const d of failed.docs) await db.recursiveDelete(d.ref);
  const old = await db.collection('ratelimits').where('start', '<', Date.now() - 2 * 864e5).limit(400).get();
  const b = db.batch();
  old.docs.forEach((d) => b.delete(d.ref));
  await b.commit();
}
exports.cleanupStale = onSchedule({ schedule: 'every 24 hours', timeoutSeconds: 300 }, cleanupAll);
exports.cleanupNow = onRequest(async (req, res) => { // emulator only, like rankFeedNow
  if (process.env.FUNCTIONS_EMULATOR !== 'true') return res.status(403).send('Emulator only');
  await cleanupAll();
  res.send('Cleanup done');
});

// =====================================================================
// 8. ACCOUNT DELETION (required by Google Play and the App Store)
// =====================================================================
exports.deleteMyAccount = callable('deleteMyAccount', { timeoutSeconds: 300, memory: '512MiB' }, async (req) => {
  const uid = needAuth(req);
  const prof = (await db.doc(`profiles/${uid}`).get()).data();
  const bucket = getStorage().bucket();

  // 1. end any live they are hosting
  const lives = await db.collection('lives').where('hostUid', '==', uid).where('status', '==', 'live').get();
  await Promise.all(lives.docs.map((d) => d.ref.update({ status: 'ended', endedAt: FieldValue.serverTimestamp() })));

  // 2. their videos (with the likes and comments under them) and the files
  const posts = await db.collection('posts').where('uid', '==', uid).get();
  for (const d of posts.docs) await db.recursiveDelete(d.ref);
  await bucket.deleteFiles({ prefix: `videos/${uid}/` }).catch(ignore);
  await bucket.deleteFiles({ prefix: `thumbs/${uid}/` }).catch(ignore);

  // 3. their comments on other people's videos (onCommentDeleted keeps those counters right)
  const comments = await db.collectionGroup('comments').where('uid', '==', uid).get();
  await Promise.all(comments.docs.map((d) => d.ref.delete().catch(ignore)));

  // 4. follows in both directions
  for (const field of ['follower', 'followee']) {
    const f = await db.collection('follows').where(field, '==', uid).get();
    await Promise.all(f.docs.map((x) => x.ref.delete()));
  }

  // 5. groups: leave each one (ownership passes on, empty groups are deleted). Direct chats stay for the other person.
  const chats = await db.collection('chats').where('members', 'array-contains', uid).get();
  for (const d of chats.docs) {
    const c = d.data();
    if (c.type !== 'group') continue;
    const rest = c.members.filter((m) => m !== uid);
    if (!rest.length) { await db.recursiveDelete(d.ref); continue; }
    const upd = {
      members: FieldValue.arrayRemove(uid), [`names.${uid}`]: FieldValue.delete(),
      [`unread.${uid}`]: FieldValue.delete(), [`lastRead.${uid}`]: FieldValue.delete(),
    };
    if (c.ownerUid === uid) upd.ownerUid = rest[0];
    await d.ref.update(upd);
  }

  // 6. channels: delete the ones they own, leave the ones they joined
  const owned = await db.collection('channels').where('ownerUid', '==', uid).get();
  for (const d of owned.docs) await db.recursiveDelete(d.ref);
  const joined = await db.collection('channels').where('members', 'array-contains', uid).get();
  await Promise.all(joined.docs.map((d) => d.ref.update({ members: FieldValue.arrayRemove(uid) }).catch(ignore)));

  // 7. private data, profile, username, and finally the login itself
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await db.recursiveDelete(db.doc(`notifications/${uid}`));
  await db.recursiveDelete(db.doc(`blocks/${uid}`));
  await db.doc(`pushTokens/${uid}`).delete();
  await db.doc(`profiles/${uid}`).delete();
  if (prof && prof.username) await db.doc(`usernames/${prof.username}`).delete();
  await getAuth().deleteUser(uid);
  logger.info('account deleted', { uid });
  return { ok: true };
});
