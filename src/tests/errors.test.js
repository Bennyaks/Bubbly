const test = require('node:test');
const assert = require('node:assert/strict');
const { friendlyError, isNetworkError, MESSAGES } = require('../errors');

test('login mistakes read clearly and do not reveal whether the email exists', () => {
  assert.equal(friendlyError({ code: 'auth/wrong-password' }), 'Wrong email or password.');
  assert.equal(friendlyError({ code: 'auth/invalid-credential' }), 'Wrong email or password.');
  assert.equal(friendlyError({ code: 'auth/user-not-found' }), 'Wrong email or password.');
});

test('sign-up problems', () => {
  assert.match(friendlyError({ code: 'auth/email-already-in-use' }), /already exists/);
  assert.match(friendlyError({ code: 'auth/weak-password' }), /6 characters/);
  assert.match(friendlyError({ code: 'auth/invalid-email' }), /email/);
});

test('network failures say to check the connection', () => {
  assert.match(friendlyError({ code: 'auth/network-request-failed' }), /internet connection/);
  assert.match(friendlyError({ code: 'unavailable' }), /connection/);
  assert.match(friendlyError({ code: 'functions/unavailable' }), /connection/);
  assert.match(friendlyError({ code: 'functions/deadline-exceeded' }), /too long/);
  assert.match(friendlyError(new Error('Network request failed')), /connection/);
});

test('callable errors: server-written messages are shown, internal ones are hidden', () => {
  assert.equal(friendlyError({ code: 'functions/permission-denied', message: 'Only the group owner can add people.' }), 'Only the group owner can add people.');
  assert.equal(friendlyError({ code: 'functions/resource-exhausted', message: 'Too many requests. Please try again later.' }), 'Too many requests. Please try again later.');
  assert.equal(friendlyError({ code: 'functions/internal', message: 'INTERNAL: stack trace with secrets' }), MESSAGES.internal);
});

test('permission and not-found from Firestore', () => {
  assert.match(friendlyError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' }), /permission/);
  assert.match(friendlyError({ code: 'firestore/not-found' }), /could not find/);
});

test('our own errors keep their message; Firebase internals never leak', () => {
  assert.equal(friendlyError(new Error('That username is already taken.')), 'That username is already taken.');
  assert.equal(friendlyError(new Error('FIRESTORE (9.14.0) INTERNAL ASSERTION FAILED: Unexpected state')), MESSAGES.unknown);
  assert.equal(friendlyError(new Error('x'.repeat(500))), MESSAGES.unknown);
  assert.equal(friendlyError(null), MESSAGES.unknown);
  assert.equal(friendlyError(undefined), MESSAGES.unknown);
});

test('storage errors', () => {
  assert.match(friendlyError({ code: 'storage/unauthorized' }), /not allowed/);
  assert.match(friendlyError({ code: 'storage/retry-limit-exceeded' }), /connection/);
});

test('isNetworkError', () => {
  assert.equal(isNetworkError({ code: 'unavailable' }), true);
  assert.equal(isNetworkError({ code: 'functions/deadline-exceeded' }), true);
  assert.equal(isNetworkError({ code: 'auth/network-request-failed' }), true);
  assert.equal(isNetworkError(new Error('Network request failed')), true);
  assert.equal(isNetworkError({ code: 'permission-denied' }), false);
  assert.equal(isNetworkError(null), false);
});
