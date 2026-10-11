# Backend checklist: where everything stands

Legend: ✅ done and in the code · 🔧 done, but you must run or confirm it · 👤 only you can do it (needs your accounts)

## Phase 1 — Foundation
| Item | Status | Where |
|---|---|---|
| Confirm Firebase project configuration | ✅ 🔧 | `firebase.js`, `.firebaserc`. A test guards the production settings. Confirm in ENVIRONMENTS.md step 1 |
| Set up Auth, Firestore and Storage | ✅ (dev) 👤 (prod) | ENVIRONMENTS.md step 2 |
| Create development and production environments | ✅ code · 👤 create the prod project | `APP_ENV` in `firebase.js`, project aliases `dev` / `prod` in `.firebaserc`, ENVIRONMENTS.md |
| Configure Firebase emulators | ✅ | `firebase.json`, `npm run emulators`, EMULATOR.md |

## Phase 2 — Security
| Item | Status | Where |
|---|---|---|
| Design collections and document ownership | ✅ | DATA_MODEL.md (ownership table) |
| Write restrictive Firestore rules | ✅ | `firestore.rules` (tightened this update: usernames, direct chats, channels, follows, settings) |
| Write restrictive Storage rules | ✅ | `storage.rules` (owner only, 1 KB to 100 MB, video type, no overwrite) |
| Test unauthorized access | ✅ written · 🔧 run it | `tests/rules.test.js`, 50 test cases: `npm run test:rules` |

## Phase 3 — Core backend
| Item | Status | Where |
|---|---|---|
| Registration, login, **password reset** | ✅ | `src/services/auth.js`, login screen ("Forgot password?"), verification email on sign-up, resend in Settings |
| User profiles | ✅ | `profiles` + unique `usernames`, edit profile, public profile screen |
| Reusable database service modules | ✅ | `src/services/` (11 modules). A test makes sure screens never call Firebase directly |
| Media upload | ✅ | `src/services/storage.js`, server pipeline in `functions/index.js` |

## Phase 4 — Quality
| Item | Status | Where |
|---|---|---|
| Consistent error handling | ✅ | app: `src/errors.js` (one friendly sentence per failure). Backend: every callable wrapped by `safe()`, structured logs |
| Automated tests | ✅ 33 pass here · 🔧 rules tests on your laptop | `npm test`, `npm run test:rules`, `npm run smoke` |
| Indexes and pagination | ✅ | `firestore.indexes.json`; feeds, comments, chat, activity and profile grid all load in pages (DATA_MODEL.md) |
| Offline and network failure scenarios | ✅ code · 🔧 manual test | offline banner, 20 s timeouts, queued writes; TESTING.md has the exact scenarios to try |

## Phase 5 — Production readiness
| Item | Status | Where |
|---|---|---|
| Monitoring and billing alerts | 👤 | PRODUCTION.md sections 1 and 2 (click-by-click), structured logging already in the code |
| Backups and account deletion | ✅ deletion · 👤 backups | `deleteMyAccount` now removes videos, comments, follows, groups, channels, notifications; PRODUCTION.md section 3 for backups |
| Deployment and recovery documentation | ✅ | PRODUCTION.md sections 4 and 5 |
| Deploy and verify production | 👤 | PRODUCTION.md section 6 + `npm run smoke` |
