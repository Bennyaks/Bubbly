# Production: monitoring, billing, backups, deployment, recovery

Everything marked 👤 needs your Google or Firebase account, so I cannot do it for you. Follow each section in order.

## 1. Billing alerts and cost control 👤 (do this BEFORE switching on Blaze)
1. Google Cloud console (console.cloud.google.com), choose the production project > **Billing > Budgets & alerts > Create budget**.
2. Amount: start small, for example 10 USD per month. Alerts at 50%, 90% and 100% of the budget, sent to your email.
3. Know the limit of alerts: **a budget alert only warns you, it does not stop spending.** Check email on the day you get one.
4. Already built into the code: functions are limited to 20 instances at once (`maxInstances` in `functions/index.js`), feeds have hard page caps
   (DATA_MODEL.md), uploads are capped at 100 MB, callables are rate limited. These keep a bug or an attack from running up a large bill.
5. The expensive things to watch: video storage and downloads (add transcoding and a CDN before real traffic), and Firestore reads.

## 2. Monitoring and alerts 👤
1. **See problems:** Firebase console > Functions > Logs. Filter by severity Error. Every failure is logged with a clear message
   (`callable x failed`, `video y failed`), thanks to the structured logging in the backend.
2. **Get alerted:** Google Cloud console > **Monitoring > Alerting > Create policy**.
   - Policy 1: logs-based, filter `severity>=ERROR AND resource.type="cloud_function"`, notify your email when it happens more than 10 times in 10 minutes.
   - Policy 2: metric `Cloud Functions > Function > Execution count` filtered to status not ok.
3. **App crashes:** Crashlytics needs native code, so it arrives with the development build (the same step as live video).
4. **Abuse protection:** Firebase console > **App Check**. Turn it on in monitoring mode first, then enforce, once the app is built with
   Play Integrity (needs the development build). Until then, the security rules and rate limits are your protection.
5. **Usage:** Firebase console > Usage and billing. Check weekly for the first month.

## 3. Backups, deletion and data protection
**Backups 👤.** Turn these on in the production project:
- *Firestore point-in-time recovery* (restore the database to any minute in the last 7 days):
  `gcloud firestore databases update --database='(default)' --enable-pitr`
- *Scheduled backups* (daily snapshot kept 14 days):
  `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14d`
- *Storage (videos):* Google Cloud console > Cloud Storage > your bucket > Protection. Keep soft delete on, and consider Object Versioning.
- *Accounts:* `firebase auth:export users.json --project prod` monthly, stored somewhere private.
Commands and features change, so confirm them in the current Google Cloud documentation. Then do one test restore into a scratch project.

**Account deletion ✅** (required by Google Play and the App Store). Settings > Delete my account calls `deleteMyAccount`, which removes:
their live, videos and the files, likes and comments under those videos, their comments on other videos, follows both ways, their place in
group chats (ownership passes on; empty groups are deleted), channels they own, notifications, settings, push tokens, profile, username
and the login. Left behind on purpose: messages already sent in direct chats (the other person keeps their history) and likes they gave
(the counts stay).
**Before launch:** Google Play also asks for a web page where people can request deletion without the app. Publish a simple page and
link it in the Play Console. You also need a privacy policy and terms of service pages.

## 4. Deployment 👤
One-time: create the production project (ENVIRONMENTS.md), fill `PROD_CONFIG` in `firebase.js`, set `REGION`, upgrade to Blaze.
Every release, in this order:
1. `npm test` and `npm run test:rules` must pass.
2. Commit to git and tag the release (`git tag v1.0.0`). The tag is how you roll back.
3. `npm run deploy:dev`, then `npm run smoke` against dev. Fix anything before going on.
4. `firebase deploy --project prod --only functions,firestore:indexes` and wait until the indexes show Enabled in the console.
5. `firebase deploy --project prod --only firestore:rules,storage`
6. Run the production smoke test (section 6).
7. Build the app with `EXPO_PUBLIC_APP_ENV=prod` (EAS: put it under `env` in the build profile in `eas.json`).
Secrets: when live video is switched on, store the LiveKit key and secret with `firebase functions:secrets:set`, not in `.env`.

## 5. Recovery runbook
| Situation | What to do |
|---|---|
| A bad function release | `git checkout` the last good tag, then `firebase deploy --project prod --only functions` |
| Bad security rules deployed | check out the last good tag, `firebase deploy --project prod --only firestore:rules,storage` (takes seconds) |
| Data deleted or corrupted | Firestore: restore from point-in-time recovery or the latest backup into a NEW database, check it, then copy back. Do not restore over live data until you have looked |
| Videos deleted | restore from Storage soft delete / versions; the post records survive in Firestore |
| A user is abusing the app | set the video's `status` to `removed` in the console; for an account, disable it in Authentication |
| Costs spiking | check Usage and billing, then Functions logs for loops. Lower `maxInstances`, or disable the function in the console while you fix it |
| Lost the Firebase config | Project settings > Your apps shows it again; the web config is not secret |
Keep a list of who owns the Google account, the Firebase project and the domain, and who can recover each.

## 6. Verify production after every deploy
1. `SMOKE_ENV=prod FIREBASE_API_KEY=... FIREBASE_PROJECT_ID=... FIREBASE_STORAGE_BUCKET=... npm run smoke`: all checks must pass.
2. Console > Firestore > Rules: the published rules match `firestore.rules` (check the date).
3. Console > Firestore > Indexes: every index is Enabled (none Building).
4. Console > Functions: all 32 functions are listed, none show errors.
5. On a real phone with the production build: sign up, claim a name, upload a 10 second video, wait until it is live, like and comment,
   message a second account, delete a test account.
6. Console > Authentication shows no strange accounts; Usage and billing is flat.
7. Confirm the budget alert and the error-alert emails actually arrive (send a test).
