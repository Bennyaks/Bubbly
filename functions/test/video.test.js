// Tests the real video reader against real files made with ffmpeg. Skipped if ffmpeg is not installed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { videoDuration } = require('../video');

let ffmpeg = null;
try { ffmpeg = require('ffmpeg-static'); if (!ffmpeg || !fs.existsSync(ffmpeg)) ffmpeg = null; } catch (e) { ffmpeg = null; }
const opts = { skip: ffmpeg ? false : 'ffmpeg-static is not installed' };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeva-video-'));
const file = (n) => path.join(dir, n);
function makeVideo(name, extra = []) {
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=5:size=320x240:rate=15',
    '-f', 'lavfi', '-i', 'sine=duration=5', '-shortest', '-pix_fmt', 'yuv420p', ...extra, file(name)]);
}

test('reads the length of a normal mp4', opts, async () => {
  makeVideo('normal.mp4');
  const r = await videoDuration(ffmpeg, file('normal.mp4'));
  assert.ok(Math.abs(r.dur - 5) < 0.3, `got ${r.dur}`);
});

test('reads a fragmented mp4 (no length in the header)', opts, async () => {
  makeVideo('frag.mp4', ['-movflags', 'frag_keyframe+empty_moov']);
  const r = await videoDuration(ffmpeg, file('frag.mp4'));
  assert.ok(Math.abs(r.dur - 5) < 0.3, `got ${r.dur}`);
});

test('a truncated video is reported as unreadable with a reason', opts, async () => {
  makeVideo('whole.mp4');
  fs.writeFileSync(file('trunc.mp4'), fs.readFileSync(file('whole.mp4')).subarray(0, 3000));
  const r = await videoDuration(ffmpeg, file('trunc.mp4'));
  assert.equal(r.dur, 0);
  assert.ok(r.detail.length > 0);
});

test('an empty file and a missing file are unreadable, not a crash', opts, async () => {
  fs.writeFileSync(file('empty.mp4'), '');
  assert.equal((await videoDuration(ffmpeg, file('empty.mp4'))).dur, 0);
  assert.equal((await videoDuration(ffmpeg, file('nope.mp4'))).dur, 0);
});

test('the 14-byte upload from the earlier bug is unreadable', opts, async () => {
  fs.writeFileSync(file('tiny.mp4'), 'not a video!!!');
  assert.equal((await videoDuration(ffmpeg, file('tiny.mp4'))).dur, 0);
});

test('a missing ffmpeg program does not crash', async () => {
  const r = await videoDuration('/definitely/not/ffmpeg', file('whatever.mp4'));
  assert.equal(r.dur, 0);
});
