// Turns any error (Firebase, network, or our own) into one short sentence a person can act on.
// Written in CommonJS so the automated tests can load it directly.
const MESSAGES = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/invalid-email': 'That email address does not look right.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/email-already-in-use': 'An account with that email already exists. Try logging in.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'No internet connection. Check your network and try again.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/requires-recent-login': 'Please log out and log in again, then repeat that.',
  'permission-denied': "You don't have permission to do that.",
  unauthenticated: 'Please log in again.',
  unavailable: 'Cannot reach the server. Check your connection and try again.',
  'deadline-exceeded': 'That took too long. Check your connection and try again.',
  'resource-exhausted': 'Too many requests. Please wait a bit and try again.',
  'not-found': 'We could not find that.',
  'already-exists': 'That already exists.',
  'failed-precondition': 'That cannot be done right now.',
  'invalid-argument': 'Something in that was not valid.',
  aborted: 'That clashed with another change. Please try again.',
  cancelled: 'Cancelled.',
  internal: 'Something went wrong on our side. Please try again.',
  unknown: 'Something went wrong. Please try again.',
  'storage/unauthorized': 'You are not allowed to upload that.',
  'storage/canceled': 'Upload cancelled.',
  'storage/retry-limit-exceeded': 'The upload kept failing. Check your connection and try again.',
  'storage/quota-exceeded': 'Storage is full. Please try again later.',
};

// For these codes the server wrote the message on purpose (for example "Only the group owner can add people."),
// so it is shown as it is. For the others, a generic sentence is safer than internal details.
const SERVER_MESSAGE_CODES = ['invalid-argument', 'failed-precondition', 'not-found', 'resource-exhausted', 'permission-denied', 'already-exists'];

function friendlyError(e) {
  if (!e) return MESSAGES.unknown;
  const raw = String(e.code || '');
  const fromFunctions = raw.startsWith('functions/');
  const code = raw.replace(/^(functions|firestore)\//, '');
  const message = typeof e.message === 'string' ? e.message : '';
  if (fromFunctions && SERVER_MESSAGE_CODES.includes(code) && message) return message;
  if (MESSAGES[code]) return MESSAGES[code];
  if (/network request failed|network error|failed to fetch|could not reach|offline/i.test(message)) return MESSAGES.unavailable;
  // an error thrown by our own code: its message was written to be read by a person
  if (!raw && message && message.length < 200 && !/firebase|firestore|internal assertion/i.test(message)) return message;
  return MESSAGES.unknown;
}

// true when the problem is the connection rather than the request
function isNetworkError(e) {
  const code = String((e && e.code) || '').replace(/^(functions|firestore)\//, '');
  return ['unavailable', 'deadline-exceeded', 'auth/network-request-failed', 'storage/retry-limit-exceeded'].includes(code)
    || /network request failed|failed to fetch|network error/i.test(String((e && e.message) || ''));
}

module.exports = { friendlyError, isNetworkError, MESSAGES };
