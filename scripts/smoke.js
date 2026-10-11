// Post-deployment smoke test. It signs up a throwaway user and checks that the important things work and that
// the important things are refused. Run it against the emulator, or against production after a deploy:
//
//   emulator:   npm run smoke
//   production: SMOKE_ENV=prod FIREBASE_API_KEY=... FIREBASE_PROJECT_ID=... FIREBASE_STORAGE_BUCKET=... npm run smoke
//
// It cleans up after itself (the test account deletes itself at the end).
const { initializeApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp } = require('firebase/firestore');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');

const prod = process.env.SMOKE_ENV === 'prod';
const HOST = process.env.EMULATOR_HOST || 'localhost';
const region = process.env.FUNCTIONS_REGION || 'us-central1';
const app = initializeApp(prod
  ? { apiKey: process.env.FIREBASE_API_KEY, projectId: process.env.FIREBASE_PROJECT_ID, storageBucket: process.env.FIREBASE_STORAGE_BUCKET }
  : { apiKey: 'fake-key', projectId: process.env.FIREBASE_PROJECT_ID || 'bubbly-bfef3' });
const auth = getAuth(app);
const db = getFirestore(app);
const fns = getFunctions(app, region);
if (!prod) {
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, HOST, 8080);
  connectFunctionsEmulator(fns, HOST, 5001);
}

const results = [];
async function check(name, fn) {
  try { await fn(); results.push([true, name]); console.log(`PASS  ${name}`); }
  catch (e) { results.push([false, name]); console.log(`FAIL  ${name}\n      ${e.code || ''} ${e.message}`); }
}
const mustFail = async (promise) => {
  try { await promise; } catch (e) { return; }
  throw new Error('this should have been refused, but it was allowed');
};

(async () => {
  console.log(`Smoke test against ${prod ? 'PRODUCTION' : `the emulator at ${HOST}`}\n`);
  const stamp = Date.now().toString(36);
  const email = `smoke_${stamp}@example.com`;
  const username = `smoke_${stamp}`.slice(0, 20);
  let uid;

  await check('sign up a new account', async () => { uid = (await createUserWithEmailAndPassword(auth, email, 'Smoke-test-123')).user.uid; });
  await check('claim a username and create the profile', async () => {
    const b = writeBatch(db);
    b.set(doc(db, 'usernames', username), { uid });
    b.set(doc(db, 'profiles', uid), { username, createdAt: serverTimestamp() });
    await b.commit();
  });
  await check('read my own profile', async () => { if (!(await getDoc(doc(db, 'profiles', uid))).exists()) throw new Error('profile missing'); });
  await check('update my bio', async () => { await updateDoc(doc(db, 'profiles', uid), { bio: 'smoke test' }); });
  await check('the user search function answers', async () => { await httpsCallable(fns, 'searchUsers')({ q: username.slice(0, 5) }); });
  await check('create a post draft', async () => {
    await setDoc(doc(db, 'posts', `smoke${stamp}`), {
      uid, author: username, caption: 'smoke', status: 'processing', likeCount: 0, commentCount: 0, shareCount: 0,
      viewCount: 0, completeCount: 0, score: 0, createdAt: serverTimestamp(),
    });
  });

  // things that MUST be refused
  await check('REFUSED: faking my own like count', () => mustFail(updateDoc(doc(db, 'posts', `smoke${stamp}`), { likeCount: 1000000 })));
  await check('REFUSED: changing my username', () => mustFail(updateDoc(doc(db, 'profiles', uid), { username: 'someone_else' })));
  await check('REFUSED: reading server-only push tokens', () => mustFail(getDoc(doc(db, 'pushTokens', uid))));
  await check('REFUSED: writing the trending list', () => mustFail(setDoc(doc(db, 'meta', 'trending'), { tags: [] })));
  await check('REFUSED: a reserved username', async () => {
    const b = writeBatch(db);
    b.set(doc(db, 'usernames', 'admin'), { uid });
    await mustFail(b.commit());
  });

  await check('delete the test account (also tests account deletion)', async () => { await httpsCallable(fns, 'deleteMyAccount')({}); });
  await signOut(auth).catch(() => {});

  const failed = results.filter((r) => !r[0]).length;
  console.log(`\n${results.length - failed} of ${results.length} checks passed.`);
  process.exit(failed ? 1 : 0);
})();
