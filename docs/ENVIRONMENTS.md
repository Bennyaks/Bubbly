# Environments: development and production

| | Development | Production |
|---|---|---|
| Purpose | building and testing | real users |
| Backend | emulators on your laptop (free) | a separate Firebase project |
| Data | throwaway | real, backed up |
| Selected by | default | `EXPO_PUBLIC_APP_ENV=prod` |
| Firebase project alias | `dev` (`bubbly-bfef3`) | `prod` (you create it) |

Never use one project for both. A bug while testing must never be able to touch real people's data.

## 1. Confirm the configuration (do once)
1. `.firebaserc` lists the projects. `default` and `dev` are your current project. `prod` is a placeholder.
2. `firebase.js` has `DEV_CONFIG` (your current settings) and `PROD_CONFIG` (placeholders). In production mode the app
   refuses to start while `PROD_CONFIG` still says `REPLACE_ME`, so you cannot ship by accident with the wrong settings.
3. Check: Firebase console > Project settings > General shows the same Project ID as `.firebaserc`.

## 2. Services each project needs
In the Firebase console of EACH project:
1. **Authentication** > Sign-in method > Email/Password: enable. (Later: Google and phone.)
2. **Firestore Database** > Create database. Pick the location carefully: it can never be changed. Choose the region closest
   to your users and use the same region in `functions/lib.js` (`REGION`) and `firebase.js` (`getFunctions(app, '...')`).
3. **Storage** > Get started, same location.
4. **Functions** needs the Blaze (pay-as-you-go) plan. Add the budget alerts from PRODUCTION.md first.

## 3. Create the production project
1. Firebase console > Add project, for example `bubbly-prod`. Turn on Google Analytics only if you want it.
2. Do step 2 above for it.
3. Project settings > Your apps > add a Web app > copy the config into `PROD_CONFIG` in `firebase.js`.
4. Put the project id into `.firebaserc` (replace `REPLACE-WITH-YOUR-PRODUCTION-PROJECT-ID`).
5. Check: `firebase use prod` works, then `firebase use dev` to switch back.

## 4. Choosing the environment
- Everyday work: nothing to do (development and emulators).
- Development app but real dev project instead of emulators: `EXPO_PUBLIC_USE_EMULATOR=false npx expo start -c`
- Production build: `EXPO_PUBLIC_APP_ENV=prod` (set it in the EAS build profile; see PRODUCTION.md section 4).

## 5. Deploying to each
```
npm run deploy:dev      # firebase deploy --project dev
npm run deploy:prod     # firebase deploy --project prod
```
Deploy to dev first, run `npm run smoke` against it, and only then deploy to prod.

## 6. Emulators
`npm run emulators`. They run with your project id, so nothing leaves your laptop. The security tests use a fake project
(`demo-bubbly`) so they can never touch a real one. See EMULATOR.md.
