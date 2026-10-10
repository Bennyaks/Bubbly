import { Platform, NativeModules } from 'react-native';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  connectAuthEmulator,
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const firebaseConfig = {
  apiKey: 'AIzaSyCincUjqkLmre1ba_79qWAc18WLFcOkVFU',
  authDomain: 'bubbly-bfef3.firebaseapp.com',
  projectId: 'bubbly-bfef3',
  storageBucket: 'bubbly-bfef3.firebasestorage.app',
  messagingSenderId: '1037342288280',
  appId: '1:1037342288280:web:cc90128bb8a6eb72b2e3ed',
  measurementId: 'G-J40V8493BH',
};

const app = initializeApp(firebaseConfig);

export const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

export const db = getFirestore(app);

export const storage = getStorage(app);

export default app;
export const functions = getFunctions(app, 'us-central1'); // use the same REGION as functions/lib.js

// ---- Local development with the Firebase Emulator Suite (free, runs on your laptop) ----
export const USE_EMULATOR = true;   // set to false to use the real Firebase project
const EMULATOR_HOST_OVERRIDE = '';  // leave empty: the laptop's address is detected automatically.
                                    // Only fill this in (e.g. '192.168.1.23') if detection fails, e.g. in tunnel mode.

// Pulls "192.168.1.23" out of things like "exp://192.168.1.23:8081" or "http://192.168.1.23:8081/index.bundle".
const hostOf = (url) => {
  const m = /^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/:?#]+)/i.exec(String(url || ''));
  return m ? m[1] : '';
};

function detectHost() {
  if (EMULATOR_HOST_OVERRIDE) return EMULATOR_HOST_OVERRIDE;
  if (Platform.OS === 'web') return typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  // The phone knows the address of the laptop that served the app. Try every place that may hold it.
  const c = Constants || {};
  const candidates = [
    NativeModules.SourceCode && NativeModules.SourceCode.scriptURL, // the Metro bundle address (most reliable)
    c.expoConfig && c.expoConfig.hostUri,
    c.expoGoConfig && c.expoGoConfig.debuggerHost,
    c.manifest2 && c.manifest2.extra && c.manifest2.extra.expoGo && c.manifest2.extra.expoGo.debuggerHost,
    c.linkingUri,
  ];
  for (const u of candidates) {
    const h = hostOf(u);
    if (h && h !== 'localhost' && h !== '127.0.0.1') return h;
  }
  return 'localhost';
}
export const EMULATOR_HOST = detectHost();
if (USE_EMULATOR) console.log('Bubbly backend host:', EMULATOR_HOST);

if (USE_EMULATOR && !globalThis.__bubblyEmulators) {
  globalThis.__bubblyEmulators = true;   // guard so fast refresh does not connect twice
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
}

// ---- Storage helpers used by the app ----
export const STORAGE_BUCKET = firebaseConfig.storageBucket;
export const STORAGE_BASE = USE_EMULATOR ? `http://${EMULATOR_HOST}:9199` : 'https://firebasestorage.googleapis.com';
export const mediaUrl = (path, token) =>
  `${STORAGE_BASE}/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media${token ? `&token=${token}` : ''}`;
// Posts store a path + token; older posts stored a full URL.
export const videoSrc = (post) => (post.videoPath ? mediaUrl(post.videoPath, post.videoToken) : post.videoUrl);
export const thumbSrc = (post) => (post.thumbPath ? mediaUrl(post.thumbPath, post.thumbToken) : post.thumbUrl);

// Quick reachability test for the Auth emulator. The app calls this at startup and explains any problem.
export async function checkBackend() {
  if (!USE_EMULATOR) return { ok: true, host: EMULATOR_HOST };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 5000);
  try {
    await fetch(`http://${EMULATOR_HOST}:9099/`, { signal: ctl.signal });
    return { ok: true, host: EMULATOR_HOST };
  } catch (e) {
    return { ok: false, host: EMULATOR_HOST };
  } finally {
    clearTimeout(t);
  }
}
