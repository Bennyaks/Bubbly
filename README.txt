Connection fix. Replace 2 files in your project folder (next to package.json):

  firebase.js
  App.js

Then:
1. Make sure the emulator is running:   npm run emulators
2. Restart the app with a cleared cache:   npx expo start -c
3. Reload the app on the phone.

What this does
- The laptop's address is now read from the Metro bundle address (the most reliable source) with several fallbacks.
- The Expo log prints a line:  Bubbly backend host: <address>   (check that it is your laptop's Wi-Fi address)
- At startup the app tests the backend. If it cannot reach it, an alert shows the address it tried and a checklist.

Quick network test (30 seconds)
On the phone's browser open  http://<that address>:4000
- Panel loads  -> network is fine.
- Does not load -> it is the network or firewall, not the app.

Windows firewall (run Command Prompt as Administrator, once):
netsh advfirewall firewall add rule name="Bubbly emulators" dir=in action=allow protocol=TCP localport=4000,5001,8080,9099,9199

Also check that Windows calls your Wi-Fi a "Private" network (Settings > Network > Wi-Fi > your network > Private),
or connect both laptop and phone to your phone's hotspot. Public Wi-Fi and many university networks block this traffic.
