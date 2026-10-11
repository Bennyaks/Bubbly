// Input rules shared by the screens. They mirror functions/logic.js and firestore.rules (a test checks this).
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const RESERVED_USERNAMES = ['admin', 'administrator', 'support', 'help', 'bubbly', 'moderator', 'staff', 'official', 'system', 'root', 'security', 'team'];

function usernameProblem(raw) {
  const n = String(raw || '').trim().toLowerCase().replace(/^@/, '');
  if (!USERNAME_RE.test(n)) return 'Use 3 to 20 letters, numbers or underscores.';
  if (RESERVED_USERNAMES.includes(n)) return 'That username is reserved. Please choose another.';
  return '';
}
const cleanUsername = (raw) => String(raw || '').trim().toLowerCase().replace(/^@/, '');
const emailProblem = (raw) => (/^\S+@\S+\.\S+$/.test(String(raw || '').trim()) ? '' : 'Please enter a valid email address.');

module.exports = { USERNAME_RE, RESERVED_USERNAMES, usernameProblem, cleanUsername, emailProblem };
