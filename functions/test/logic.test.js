// Run with:  npm test   (from the project folder)   or   node --test functions/test
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  milestone, extractHashtags, rankScore, durationFromHeader, durationFromProgress, videoProblem, validUsername,
} = require('../logic');

const ts = (ms) => ({ toMillis: () => ms });
const NOW = 1_800_000_000_000;
const HOUR = 36e5;

test('milestone: notify at 1, 10, 50 and every power of ten from 100', () => {
  for (const n of [1, 10, 50, 100, 1000, 10000, 100000]) assert.equal(milestone(n), true, `${n}`);
  for (const n of [0, 2, 9, 11, 49, 51, 99, 101, 150, 999, 1001]) assert.equal(milestone(n), false, `${n}`);
});

test('extractHashtags: lowercase, unique, no punctuation, max 10', () => {
  assert.deepEqual(extractHashtags('Fun #Dance #dance #AfroBeats!'), ['dance', 'afrobeats']);
  assert.deepEqual(extractHashtags('no tags here'), []);
  assert.deepEqual(extractHashtags(''), []);
  assert.deepEqual(extractHashtags(undefined), []);
  assert.deepEqual(extractHashtags('#nairobi #Kenya_2026 #café'), ['nairobi', 'kenya_2026', 'café']);
  const many = Array.from({ length: 15 }, (_, i) => `#t${i}`).join(' ');
  assert.equal(extractHashtags(many).length, 10);
});

test('rankScore: more engagement ranks higher', () => {
  const base = { createdAt: ts(NOW - 5 * HOUR), viewCount: 500 };
  const low = rankScore({ ...base, likeCount: 1 }, NOW);
  const high = rankScore({ ...base, likeCount: 100, commentCount: 10, shareCount: 5 }, NOW);
  assert.ok(high > low);
});

test('rankScore: older videos decay', () => {
  const p = { likeCount: 50, viewCount: 500 };
  const fresh = rankScore({ ...p, createdAt: ts(NOW - 2 * HOUR) }, NOW);
  const old = rankScore({ ...p, createdAt: ts(NOW - 72 * HOUR) }, NOW);
  assert.ok(fresh > old);
});

test('rankScore: a brand new video with no views still gets a first audience', () => {
  const brandNew = rankScore({ createdAt: ts(NOW - 0.5 * HOUR), likeCount: 0, viewCount: 0 }, NOW);
  const stale = rankScore({ createdAt: ts(NOW - 48 * HOUR), likeCount: 0, viewCount: 0 }, NOW);
  assert.ok(brandNew > stale);
  assert.ok(brandNew > 1);
});

test('rankScore: watching to the end helps; missing fields do not break it', () => {
  const a = { createdAt: ts(NOW - 10 * HOUR), viewCount: 1000, completeCount: 800 };
  const b = { createdAt: ts(NOW - 10 * HOUR), viewCount: 1000, completeCount: 100 };
  assert.ok(rankScore(a, NOW) > rankScore(b, NOW));
  assert.ok(Number.isFinite(rankScore({}, NOW)));
});

test('duration parsing: header, progress, and nothing', () => {
  assert.equal(durationFromHeader('  Duration: 00:01:05.20, start: 0.0, bitrate: 108 kb/s'), 65.2);
  assert.equal(durationFromHeader('Duration: N/A, start: 0.000000'), 0);
  assert.equal(durationFromHeader(''), 0);
  assert.equal(durationFromProgress('frame=1 time=00:00:01.00 x\rframe=9 time=00:00:04.86 y'), 4.86);
  assert.equal(durationFromProgress('Error opening input file'), 0);
});

test('videoProblem: tiny, unreadable, too long, fine', () => {
  assert.match(videoProblem(14, 0), /incomplete \(14 bytes\)/);
  assert.match(videoProblem(5000, 0), /could not be read/);
  assert.match(videoProblem(5000, 601), /longer than 10 minutes/);
  assert.equal(videoProblem(5000, 600), '');
  assert.equal(videoProblem(1024, 5), '');
});

test('usernames: format and reserved words', () => {
  for (const ok of ['abc', 'mandera_b', 'user123', 'a_b_c', 'x'.repeat(20)]) assert.equal(validUsername(ok), true, ok);
  for (const bad of ['ab', 'x'.repeat(21), 'Upper', 'has space', 'dash-name', 'dot.name', '', 'admin', 'bubbly', 'support']) assert.equal(validUsername(bad), false, bad);
});
