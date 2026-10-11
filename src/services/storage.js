import { File, UploadType } from 'expo-file-system';
import { STORAGE_BASE, STORAGE_BUCKET } from '../../firebase';
import { idToken } from './auth';

const MAX_BYTES = 100 * 1024 * 1024;

// Streams the video file from the phone straight to Firebase Storage over HTTP (no JavaScript Blob is built,
// which avoids the 14-byte upload problem seen on this Expo version). Returns the number of bytes sent.
export async function uploadVideo(uri, postId, uid, expectedBytes) {
  const f = new File(uri);
  const info = typeof f.info === 'function' ? f.info() : {};
  const local = info.size || f.size || expectedBytes || 0;
  if (!local || local < 1024) throw new Error(`The phone could not read the video file (found ${local} bytes). Try a different video.`);
  if (local > MAX_BYTES) throw new Error('That video is over 100 MB. Please choose a shorter one.');
  const path = `videos/${uid}/${postId}.mp4`;
  const res = await f.upload(`${STORAGE_BASE}/v0/b/${STORAGE_BUCKET}/o?name=${encodeURIComponent(path)}`, {
    httpMethod: 'POST',
    uploadType: UploadType.BINARY_CONTENT,
    mimeType: 'video/mp4',
    headers: { Authorization: `Firebase ${await idToken()}`, 'Content-Type': 'video/mp4' },
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`Upload failed (${res.status}). Please try again.`);
  let stored = 0;
  try { stored = Number(JSON.parse(res.body).size); } catch (e) { /* the body is only a bonus check */ }
  if (stored && Math.abs(stored - local) > 1024) throw new Error(`Only ${stored} of ${local} bytes were stored. The upload was cut short. Please try again.`);
  return local;
}
