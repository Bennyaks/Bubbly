# Notes for AI coding agents

Expo SDK 57 / React Native app (`App.js` entry, custom navigation, no Expo Router) with a Firebase backend in `functions/`. Read `README.md` and `docs/BACKEND.md` first.

- Expo APIs change between SDKs. Before touching Expo/React Native APIs, read the `expo` version in `package.json` and check https://docs.expo.dev/llms.txt and the matching versioned docs instead of relying on memory.
- Install packages with `npx expo install <package>`. Native-code libraries need a development build, not Expo Go.
- Never edit `ios/` or `android/`; configure native settings in `app.json`.
- Screens and components must not import `firebase/*`; add a function to `src/services/` instead. Show errors through `src/errors.js`.
- Clients must never write counters, scores, statuses or `lastMessage`; do that in a Cloud Function. Any rule change needs a test in `tests/rules.test.js`.
- The Firebase project ID `bubbly-bfef3` is a legacy name and must not be renamed in config.
- Before finishing: `npm test`, and `npm run test:rules` if rules changed; `npx expo lint` for app code.
