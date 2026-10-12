# Contributing to Zeva

## Setup
```
git clone https://github.com/Bennyaks/Zeva.git
cd Zeva
npm install
npm run backend:install
npm run emulators:fresh      # first run; afterwards: npm run emulators
npx expo start -c
```
Requirements: Node 20+, Java 21+ (emulators), `npm install -g firebase-tools`. See `docs/EMULATOR.md`, and read `docs/BACKEND.md` before changing anything in `functions/` or the rules.

## Workflow
1. Never push to `main`. Branch from it: `git checkout -b feature/short-description` (or `fix/...`, `docs/...`).
2. Keep each branch to one change. Commit with a clear message ("Fix unread count when a chat is muted").
3. Run the checks below, then `git push -u origin <branch>` and open a Pull Request.
4. Describe what changed and how you tested it. Someone else reviews and merges.
5. Pull before you start new work: `git checkout main && git pull`.

## Checks before opening a Pull Request
| You changed | Run |
|---|---|
| anything | `npm test` (33 tests, no emulator needed) |
| `firestore.rules` or `storage.rules` | `npm run test:rules` (stop your running emulators first) and add a test in `tests/rules.test.js` |
| a Cloud Function | `npm test`, then try it on the emulator and run `npm run smoke` (see `docs/TESTING.md`) |
| a query with `where` plus `orderBy` | add the index to `firestore.indexes.json` |
| app code | `npx expo lint` |

## Project rules
- Screens and components never import `firebase/*`. Add a function in `src/services/` instead.
- Clients never write counters, scores, statuses or `lastMessage`. Do that in a Cloud Function.
- New callable function: wrap it with `callable()`, call `needAuth`, add a rate limit if it can be abused, and add a wrapper in `src/services/`.
- Values that exist in more than one place (reserved usernames, the direct-chat id, the function region) must be changed everywhere; the tests catch most drift. List in `docs/BACKEND.md` section 7.
- Add packages with `npx expo install <package>`, not `npm install`.
- Do not commit secrets (`.env`, service account keys), `node_modules` or `emulator-data`. The Firebase web config in `firebase.js` is public and fine.
- The Firebase project ID `bubbly-bfef3` is a legacy name and must not be renamed in config.
- Update the matching file in `docs/` when you change behaviour, and keep docs short and maintenance-focused.

## Deploying
Only maintainers deploy. Follow the release order in `docs/DEPLOYMENT.md` (tests, dev, smoke test, prod).
