// Guards the structure of the app so it stays easy to change.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const list = (dir) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`);
const uiFiles = ['App.js', ...list('src/screens'), ...list('src/components')];

test('screens and components never import Firebase directly (they use src/services)', () => {
  for (const f of uiFiles) {
    const bad = [...read(f).matchAll(/from\s+'(firebase\/[^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(bad, [], `${f} imports ${bad.join(', ')}. Move that call into a service module.`);
  }
});

test('screens show friendly errors, never raw e.message', () => {
  for (const f of uiFiles) {
    const lines = read(f).split('\n').filter((l) => /Alert\.alert\(.*\be\.message\b/.test(l));
    assert.deepEqual(lines, [], `${f} shows a raw error message: ${lines[0]}`);
  }
});

test('every Cloud Function the app calls exists in the backend', () => {
  const backend = read('functions/index.js') + read('functions/live.js');
  const defined = new Set([...backend.matchAll(/callable\('(\w+)'/g)].map((m) => m[1]));
  for (const f of list('src/services')) {
    for (const m of read(f).matchAll(/call\('(\w+)'/g)) assert.ok(defined.has(m[1]), `${f} calls "${m[1]}" which the backend does not define`);
  }
});

test('the direct-chat id in the app matches the rule in firestore.rules', () => {
  const rules = read('firestore.rules');
  assert.ok(rules.includes("function dmId(a, b) { return a < b ? a + '_' + b : b + '_' + a; }"));
  const app = (a, b) => [a, b].sort().join('_');
  const rule = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (const [a, b] of [['alice', 'bob'], ['Zed', 'abc'], ['u1', 'u10'], ['aX9', 'aX10']]) assert.equal(app(a, b), rule(a, b));
});

test('every collection the app queries has a matching rule', () => {
  const rules = read('firestore.rules');
  const used = new Set();
  for (const f of list('src/services')) for (const m of read(f).matchAll(/(?:collection|doc)\(db, '(\w+)'/g)) used.add(m[1]);
  for (const c of used) assert.ok(new RegExp(`match /${c}/`).test(rules), `no rule for collection "${c}"`);
});

test('production settings are guarded', () => {
  const fb = read('firebase.js');
  assert.ok(fb.includes('EXPO_PUBLIC_APP_ENV'));
  assert.ok(fb.includes("PROD_CONFIG.apiKey === 'REPLACE_ME'"));
});
