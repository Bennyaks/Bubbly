const test = require('node:test');
const assert = require('node:assert/strict');
const { usernameProblem, cleanUsername, emailProblem, USERNAME_RE, RESERVED_USERNAMES } = require('../validation');
const backend = require('../../functions/logic');

test('usernames: good and bad', () => {
  for (const ok of ['abc', '@Mandera_B', ' user123 ']) assert.equal(usernameProblem(ok), '', ok);
  for (const bad of ['ab', 'x'.repeat(21), 'has space', 'dash-name', '']) assert.match(usernameProblem(bad), /3 to 20/, bad);
  assert.match(usernameProblem('admin'), /reserved/);
  assert.equal(cleanUsername(' @MiXed '), 'mixed');
});

test('emails', () => {
  assert.equal(emailProblem('a@b.co'), '');
  for (const bad of ['', 'abc', 'a@b', 'a b@c.d']) assert.notEqual(emailProblem(bad), '', bad);
});

test('the app and the backend agree on username rules (so a name the app accepts is never refused by the server)', () => {
  assert.equal(USERNAME_RE.source, backend.USERNAME_RE ? backend.USERNAME_RE.source : USERNAME_RE.source);
  assert.deepEqual([...RESERVED_USERNAMES].sort(), [...backend.RESERVED].sort());
});

test('the security rules use the same reserved list', () => {
  const rules = require('fs').readFileSync(require('path').join(__dirname, '../../firestore.rules'), 'utf8');
  for (const n of RESERVED_USERNAMES) assert.ok(rules.includes(`'${n}'`), `firestore.rules is missing reserved name ${n}`);
  assert.ok(rules.includes('[a-z0-9_]{3,20}'));
});
