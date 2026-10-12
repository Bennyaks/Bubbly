# Deployment and operations

## Environments
| | Development | Production |
|---|---|---|
| Purpose | building, testing | real users |
| Backend | emulators (or the `dev` Firebase project) | separate Firebase project |
| Alias in `.firebaserc` | `dev` (`bubbly-bfef3`, legacy ID) | `prod` (placeholder until created) |
| App selects it with | default | `EXPO_PUBLIC_APP_ENV=prod` |
| Config in `firebase.js` | `DEV_CONFIG` | `PROD_CONFIG` (the app refuses to start while it says `REPLACE_ME`) |

Never use one project for both. Switch the app to the real dev project instead of the emulators with `EXPO_PUBLIC_USE_EMULATOR=false npx expo start -c`.

## Services every project needs
1. Authentication > Sign-in method > Email/Password enabled.
2. Firestore database. The location is permanent: pick the region closest to users and set the same value in `REGION` (`functions/lib.js`) and `getFunctions(app, '...')` (`firebase.js`).
3. Storage in the same location.
4. Blaze (pay-as-you-go) plan, required for Functions. Set budget alerts first (below).

## Creating the production project (once)
1. Firebase console > Add project (for example `zeva-prod`).
2. Enable the services above.
3. Project settings > Your apps > Web app: copy the config into `PROD_CONFIG` in `firebase.js`.
4. Put the project ID in `.firebaserc` under `prod`; check with `firebase use prod`, then `firebase use dev`.

## Moving to a different Firebase project (for example a new `zeva-*` ID)
Project IDs cannot be renamed, so create a new project and update: `.firebaserc`, `DEV_CONFIG` or `PROD_CONFIG` in `firebase.js`, the default in `scripts/smoke.js`, and the example URLs in docs. Data does not move automatically.

## Release steps (in this order)
1. `npm test` and `npm run test:rules` pass.
2. Commit and tag (`git tag v1.0.0`); the tag is your rollback point.
3. `npm run deploy:dev`, then smoke test against dev (TESTING.md section 5). Fix before continuing.
4. `firebase deploy --project prod --only functions,firestore:indexes`; wait until indexes show Enabled.
5. `firebase deploy --project prod --only firestore:rules,storage`.
6. Smoke test production; check console: rules dates, indexes Enabled, all 32 functions listed without errors.
7. Build the app with `EXPO_PUBLIC_APP_ENV=prod` (EAS: `env` in the build profile).
Deploy functions and indexes before rules so the running app keeps working while indexes build.

## Rollback
| Situation | Action |
|---|---|
| Bad function release | check out last good tag, `firebase deploy --project prod --only functions` |
| Bad rules | check out last good tag, `firebase deploy --project prod --only firestore:rules,storage` (seconds) |
| Data deleted or corrupted | restore from point-in-time recovery or latest backup into a NEW database, verify, copy back |
| Videos deleted | restore from Storage soft delete or versions; post records remain |
| Abusive content or account | set post `status: "removed"` in the console; disable the account in Authentication |
| Costs spiking | check Usage and billing, then Functions logs for loops; lower `maxInstances` or disable the function |

## Monitoring and cost control (do before enabling Blaze)
- Budget: Google Cloud > Billing > Budgets & alerts, e.g. 10 USD/month with alerts at 50/90/100%. Alerts warn, they do not stop spending.
- Already in code: `maxInstances: 20`, capped feed pages, 100 MB upload cap, rate-limited callables.
- Errors: Firebase console > Functions > Logs, filter severity Error. Alert policy: logs-based, `severity>=ERROR AND resource.type="cloud_function"`, notify when > 10 in 10 minutes.
- Costly areas: video storage/egress (add transcoding + CDN before real traffic) and Firestore reads.
- Before public launch: enable App Check (monitor first, then enforce), Crashlytics (needs a development build).

## Backups (production, enable once)
- Point-in-time recovery: `gcloud firestore databases update --database='(default)' --enable-pitr`
- Daily backups kept 14 days: `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14d`
- Storage: keep soft delete on; consider Object Versioning.
- Accounts: `firebase auth:export users.json --project prod` monthly, stored privately.
Commands change: confirm in current Google Cloud docs and do one test restore into a scratch project.

## Store requirements
`deleteMyAccount` covers in-app deletion (BACKEND.md). Google Play also needs a public web page for deletion requests, a privacy policy and terms.

## Secrets
LiveKit key/secret go in Secret Manager (`firebase functions:secrets:set LIVEKIT_API_SECRET`), not `.env`, before public launch. Firebase web config is not secret.
