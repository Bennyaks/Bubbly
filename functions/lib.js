const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { HttpsError } = require('firebase-functions/v2/https');

if (!getApps().length) initializeApp();
const db = getFirestore();

// IMPORTANT: set this to the region of your Firestore database
// (Firebase console > Firestore > Data shows the location).
const REGION = 'us-central1';

const profileOf = async (uid) => (await db.doc(`profiles/${uid}`).get()).data() || {};

function needAuth(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please sign in first.');
  return req.auth.uid;
}

// In-app activity feed: notifications/{uid}/items/{id}. A fixed id means repeats (like, unlike, like) never duplicate.
async function notify(uid, id, data) {
  try {
    await db.doc(`notifications/${uid}/items/${id}`).set({ ...data, read: false, createdAt: FieldValue.serverTimestamp() });
  } catch (e) {
    console.error('notify failed', e);
  }
}

// Push notifications through the Expo push service (tokens saved by registerPushToken).
async function push(uids, { title, body, data }) {
  try {
    const snaps = await Promise.all(uids.map((u) => db.doc(`pushTokens/${u}`).get()));
    const messages = [];
    snaps.forEach((s) => ((s.data() || {}).tokens || []).forEach((to) => messages.push({ to, title, body, data, sound: 'default' })));
    for (let i = 0; i < messages.length; i += 100) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    }
  } catch (e) {
    console.error('push failed', e); // a failed notification must never break the main job
  }
}

// Simple per-user rate limit stored in Firestore.
async function rateLimit(uid, key, max, windowSec) {
  const ref = db.doc(`ratelimits/${uid}_${key}`);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const now = Date.now();
    const d = s.data();
    if (!d || now - d.start > windowSec * 1000) return tx.set(ref, { start: now, count: 1 });
    if (d.count >= max) throw new HttpsError('resource-exhausted', 'Too many requests. Please try again later.');
    tx.update(ref, { count: d.count + 1 });
  });
}

module.exports = { db, REGION, profileOf, needAuth, push, rateLimit, notify };
