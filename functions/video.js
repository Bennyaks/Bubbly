// Video inspection with ffmpeg. Kept separate from index.js so it can be tested with a real sample file.
const { spawn } = require('child_process');
const { durationFromHeader, durationFromProgress } = require('./logic');

function run(ffmpegPath, args) {
  return new Promise((resolve) => {
    let err = '';
    let p;
    try { p = spawn(ffmpegPath, args); } catch (e) { return resolve({ code: -1, err: String(e) }); }
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => resolve({ code: -1, err: String(e) })); // e.g. the ffmpeg program is missing
    p.on('close', (code) => resolve({ code, err }));
  });
}

// Length in seconds. Reads the header first; if there is none, scans the file. detail explains a failure.
async function videoDuration(ffmpegPath, file) {
  const probe = await run(ffmpegPath, ['-i', file]); // exits non-zero by design; info is on stderr
  const head = durationFromHeader(probe.err);
  if (head > 0) return { dur: head, detail: '' };
  const scan = await run(ffmpegPath, ['-i', file, '-c', 'copy', '-f', 'null', '-']);
  const prog = durationFromProgress(scan.err);
  if (prog > 0) return { dur: prog, detail: '' };
  const lines = (scan.err || probe.err).split('\n').map((x) => x.trim()).filter(Boolean);
  return { dur: 0, detail: lines.slice(-2).join(' | ') };
}

module.exports = { run, videoDuration };
