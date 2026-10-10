// LIVE backend. Anyone can go live: there is deliberately NO follower requirement.
//
// Two layers:
//  1. Live rooms (always on): the room document, live chat, viewer counting, heartbeat, stale cleanup,
//     follower notifications. This works in Expo Go and on the emulator with no extra service.
//  2. Video transport (optional): LiveKit. Until it is configured, startLive/joinLive return token = null
//     and the app shows the room without video. See docs/LIVE.md to switch video on.
//
// LiveKit settings are read from environment variables (functions/.env for deploys, functions/.env.local
// for the emulator):  LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
// Before launching publicly, move the key and secret into Secret Manager (firebase functions:secrets:set).
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { db, profileOf, needAuth, push, notify, rateLimit } = require('./lib');

const lk = () => ({ url: process.env.LIVEKIT_URL, key: process.env.LIVEKIT_API_KEY, secret: process.env.LIVEKIT_API_SECRET });
const lkReady = () => { const c = lk(); return !!(c.url && c.key && c.secret); };

async function makeToken(identity, room, host) {
  if (!lkReady()) return null;
  const { AccessToken } = require('livekit-server-sdk');
  const c = lk();
  const at = new AccessToken(c.key, c.secret, { identity, ttl: '2h' });
  at.addGrant({ room, roomJoin: true, canPublish: host, canPublishData: true, canSubscribe: true });
  return at.toJwt();
}

exports.startLive = onCall(async (req) => {
  const uid = needAuth(req);
  const title = String((req.data || {}).title || '').trim().slice(0, 80);
  if (!title) throw new HttpsError('invalid-argument', 'Give your live a title.');
  await rateLimit(uid, 'startlive', 10, 3600);
  const open = await db.collection('lives').where('hostUid', '==', uid).where('status', '==', 'live').limit(1).get();
  if (!open.empty) throw new HttpsError('failed-precondition', 'You are already live. End that live first.');
  const prof = await profileOf(uid);
  const ref = db.collection('lives').doc();
  await ref.set({
    hostUid: uid, hostName: prof.username || 'user', title, status: 'live', viewerCount: 0,
    video: lkReady() ? 'livekit' : 'none',
    startedAt: FieldValue.serverTimestamp(), lastBeat: FieldValue.serverTimestamp(),
  });
  return { liveId: ref.id, url: lk().url || null, token: await makeToken(uid, ref.id, true) };
});

exports.joinLive = onCall(async (req) => {
  const uid = needAuth(req);
  const { liveId } = req.data || {};
  const live = typeof liveId === 'string' ? (await db.doc(`lives/${liveId}`).get()).data() : null;
  if (!live || live.status !== 'live') throw new HttpsError('not-found', 'This live has ended.');
  return { url: lk().url || null, token: await makeToken(uid, liveId, false) };
});

// The host app calls this every 30 seconds. A live with no heartbeat is closed automatically.
exports.liveHeartbeat = onCall(async (req) => {
  const uid = needAuth(req);
  const { liveId } = req.data || {};
  const ref = db.doc(`lives/${liveId}`);
  const live = (await ref.get()).data();
  if (!live || live.hostUid !== uid || live.status !== 'live') throw new HttpsError('failed-precondition', 'This live is not running.');
  await ref.update({ lastBeat: FieldValue.serverTimestamp() });
  return { ok: true };
});

async function closeLive(liveId) {
  await db.doc(`lives/${liveId}`).update({ status: 'ended', endedAt: FieldValue.serverTimestamp() }).catch(() => {});
  if (lkReady()) {
    try {
      const { RoomServiceClient } = require('livekit-server-sdk');
      const c = lk();
      await new RoomServiceClient(c.url, c.key, c.secret).deleteRoom(liveId);
    } catch (e) { console.warn('deleteRoom', e.message); }
  }
}

exports.endLive = onCall(async (req) => {
  const uid = needAuth(req);
  const { liveId } = req.data || {};
  const live = (await db.doc(`lives/${liveId}`).get()).data();
  if (!live || live.hostUid !== uid) throw new HttpsError('permission-denied', 'Only the host can end this live.');
  await closeLive(liveId);
  return { ok: true };
});

// Close lives whose host stopped sending heartbeats (app closed, phone died, no signal).
async function endStale() {
  const cutoff = Timestamp.fromMillis(Date.now() - 3 * 60 * 1000);
  const stale = await db.collection('lives').where('status', '==', 'live').where('lastBeat', '<', cutoff).limit(100).get();
  for (const d of stale.docs) await closeLive(d.id);
}
exports.endStaleLives = onSchedule('every 5 minutes', endStale);
exports.endStaleNow = onRequest(async (req, res) => { // emulator only
  if (process.env.FUNCTIONS_EMULATOR !== 'true') return res.status(403).send('Emulator only');
  await endStale();
  res.send('Stale lives closed');
});

// Viewer counting: the app creates lives/{id}/viewers/{uid} when someone enters and deletes it when they leave.
exports.onLiveViewerJoined = onDocumentCreated('lives/{id}/viewers/{uid}', (e) =>
  db.doc(`lives/${e.params.id}`).update({ viewerCount: FieldValue.increment(1) }).catch(() => {}));
exports.onLiveViewerLeft = onDocumentDeleted('lives/{id}/viewers/{uid}', (e) =>
  db.doc(`lives/${e.params.id}`).update({ viewerCount: FieldValue.increment(-1) }).catch(() => {}));

// Tell followers (first 500) when someone goes live: activity feed + push.
exports.onLiveCreated = onDocumentCreated('lives/{id}', async (e) => {
  const live = e.data.data();
  const f = await db.collection('follows').where('followee', '==', live.hostUid).limit(500).get();
  const followers = f.docs.map((d) => d.data().follower);
  await Promise.all(followers.map((u) => notify(u, `live_${e.params.id}`, {
    type: 'live', fromUid: live.hostUid, fromName: live.hostName, liveId: e.params.id, text: `is live: ${live.title}`,
  })));
  await push(followers, { title: `🔴 @${live.hostName} is live`, body: live.title, data: { type: 'live', liveId: e.params.id } });
});

// LiveKit calls this when rooms or people change. Set this function's URL as the webhook in the LiveKit dashboard.
exports.livekitWebhook = onRequest(async (req, res) => {
  if (!lkReady()) return res.status(503).send('LiveKit is not configured');
  try {
    const { WebhookReceiver } = require('livekit-server-sdk');
    const c = lk();
    const ev = await new WebhookReceiver(c.key, c.secret).receive(req.rawBody.toString(), req.get('Authorization'));
    const room = ev.room && ev.room.name;
    if (room && ev.event === 'room_finished') await db.doc(`lives/${room}`).update({ status: 'ended', endedAt: FieldValue.serverTimestamp() }).catch(() => {});
    res.status(200).send('ok');
  } catch (e) {
    res.status(400).send('bad webhook');
  }
});
