const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

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

// Wraps a callable so that every failure reaches the app as a clean, readable error.
// Expected problems (HttpsError) pass through unchanged. Anything unexpected is logged in full
// (visible in Cloud Logging) and the user only sees a friendly message, never internal details.
const safe = (name, fn) => async (req) => {
  try {
    return await fn(req);
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    logger.error(`callable ${name} failed`, { uid: req.auth && req.auth.uid, error: String(e && e.stack ? e.stack : e) });
    throw new HttpsError('internal', 'Something went wrong. Please try again.');
  }
};

// callable('name', handler) or callable('name', options, handler): onCall + safe() in one step.
const callable = (name, a, b) => {
  const { onCall } = require('firebase-functions/v2/https');
  return b ? onCall(a, safe(name, b)) : onCall(safe(name, a));
};

// In-app activity feed: notifications/{uid}/items/{id}. A fixed id means repeats (like, unlike, like) never duplicate.
async function notify(uid, id, data) {
  try {
    await db.doc(`notifications/${uid}/items/${id}`).set({ ...data, read: false, createdAt: FieldValue.serverTimestamp() });
  } catch (e) {
    logger.error('notify failed', { error: String(e) });
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
    logger.error('push failed', { error: String(e) }); // a failed notification must never break the main job
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

module.exports = { db, REGION, profileOf, needAuth, push, rateLimit, notify, safe, callable, logger };
