// Pure functions (no Firebase, no network) so they can be unit tested. See test/logic.test.js
const MAX_VIDEO_SECONDS = 600;

// Push a notification for the 1st, 10th, 50th and every power of ten from 100 upward.
const milestone = (n) => n === 1 || n === 10 || n === 50 || /^[1-9]0{2,}$/.test(String(n));

// "#Dance #dance #AfroBeats!" -> ["dance", "afrobeats"]  (lowercase, unique, max 10)
function extractHashtags(caption) {
  const found = String(caption || '').toLowerCase().match(/#[\p{L}\p{N}_]+/gu) || [];
  return [...new Set(found)].map((x) => x.slice(1)).slice(0, 10);
}

// The For You score: engagement divided by (age in hours + 2)^1.5, with a boost so new videos get a first audience.
function rankScore(post, nowMs) {
  const created = post.createdAt && post.createdAt.toMillis ? post.createdAt.toMillis() : nowMs;
  const ageH = Math.max(0, (nowMs - created) / 36e5);
  const views = post.viewCount || 0;
  const completion = views ? (post.completeCount || 0) / views : 0;
  const engagement = (post.likeCount || 0) + 3 * (post.commentCount || 0) + 5 * (post.shareCount || 0) + 0.1 * views + 20 * completion;
  const boost = views < 200 && ageH < 24 ? 10 : 0;
  return Math.round(((engagement + boost + 1) / Math.pow(ageH + 2, 1.5)) * 1e4) / 1e4;
}

// ffmpeg prints "Duration: 00:01:05.20" or "time=00:00:04.86". Returns seconds, or 0 if none found.
const toSecs = (m) => Number(m[1]) * 3600 + Number(m[2]) * 60 + parseFloat(m[3]);
function durationFromHeader(text) {
  const m = /Duration: (\d+):(\d+):(\d+\.?\d*)/.exec(text || '');
  return m ? toSecs(m) : 0;
}
function durationFromProgress(text) {
  const all = [...String(text || '').replace(/\r/g, '\n').matchAll(/time=(\d+):(\d+):(\d+\.?\d*)/g)];
  return all.length ? toSecs(all[all.length - 1]) : 0;
}

// Wording for a video that is not acceptable, or '' when it is fine.
function videoProblem(bytes, seconds) {
  if (bytes < 1024) return `The upload arrived incomplete (${bytes} bytes).`;
  if (!seconds) return 'The video could not be read.';
  if (seconds > MAX_VIDEO_SECONDS) return 'Video is longer than 10 minutes.';
  return '';
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const RESERVED = ['admin', 'administrator', 'support', 'help', 'bubbly', 'moderator', 'staff', 'official', 'system', 'root', 'security', 'team'];
const validUsername = (n) => USERNAME_RE.test(n) && !RESERVED.includes(n);

module.exports = { USERNAME_RE, MAX_VIDEO_SECONDS, milestone, extractHashtags, rankScore, durationFromHeader, durationFromProgress, videoProblem, validUsername, RESERVED };
