# Morning steps for the team

The night built phases A to E. Each plan task is done, except Plan 2 Task 4 and Plan 4 Task 8. `STATUS.md` has the table.

Three facts before you start:

- Nobody has run the app with the real glasses. Each device test used mock glasses (MockDeviceKit) on the phone P11262000912.
- Nobody has heard the voice. The media volume of the phone stayed at 0, and the night made no ElevenLabs clip.
- The vendor ledger in `docs/overnight/VENDOR.md` holds 2 of 20 Gemini calls and 0 of 5 ElevenLabs calls.

Order of this file: phone and machine, probe, keys, deployment, catalog, manual checks, checks on the glasses, end-to-end test and late content, Italian review, decisions, checks that did not run, documents.

Before each command in Git Bash: `source "$USERPROFILE/.glance-tools/env.sh"` and `export ANDROID_SERIAL=P11262000912`. In PowerShell: `. "$env:USERPROFILE\.glance-tools\env.ps1"` and `$env:ANDROID_SERIAL='P11262000912'`. Pass `-s P11262000912` to each `adb` command, because a second phone is attached.

## 1. Phone state and this machine

### Phone

1. Restore the two settings that the team changed on 2026-11-14 to keep the phone awake:

   ```text
   adb -s P11262000912 shell settings put global stay_on_while_plugged_in 2
   adb -s P11262000912 shell settings put system screen_off_timeout 30000
   ```

   Old values: `stay_on_while_plugged_in` was 2, `screen_off_timeout` was 30000.
2. Connect the phone to Wi-Fi. `dumpsys connectivity` says `Active default network: none`. The tests worked through `adb reverse`, but the phone cannot reach a real server, and the page shows `network: offline`.
3. Set the media volume above 0 for each check with sound. It was 0 of 16 before the first device test (read at about 04:10), and the night did not change it. At volume 0 the app plays no line and reports each prompt at once.

State that the night left on the phone:

- `com.metaglance.android` is installed as a debug build with `glance.serverUrl=http://127.0.0.1:8080`. Install a build with the real server address before the tests with the glasses.
- `com.metaglance.android.test` is installed. Remove it if you want: `adb -s P11262000912 uninstall com.metaglance.android.test`.
- The app holds no Bluetooth permission. The first start of "Glance" shows the Bluetooth prompt of Android. Allow it, then register from the page.
- The probe tests wrote files to `/sdcard/Android/data/com.metaglance.android/files/probe` (logs, `frames/colors-NN.jpg`). An uninstall removes them.
- After a registration from the probe, Meta AI returns to "Glance", not to "Glance Probe". The `glance` scheme filter is on MainActivity.

### This machine

- Docker Desktop is running. The night started it with `docker desktop start`. Stop it with `docker desktop stop`.
- The Docker cache holds the base images `node:22-slim` and `caddy:2`. Remove them with `docker rmi node:22-slim caddy:2` if you need the space.
- The build tools are in `%USERPROFILE%\.glance-tools` (about 2.4 GB, no change of the system PATH): `android-sdk`, `ffmpeg`, `gradle`, `jdk`, `secrets`. Load them with `env.sh` or `env.ps1` in that folder.
- A Gradle daemon of the tests stays up until its idle time ends (default 3 hours). End it with `./gradlew --stop` in `apps/mobile/android`.
- At 08:41 two headless Chrome processes (debug port 9222, profile folder `chrome-profile` in a session scratchpad) and one Vite server on port 5175 were running. Check for them and stop them.
- Run `npm install --prefix scripts/integration` one time in each checkout before a script of `scripts/integration`. The folder is not a root workspace.
- The Vite dev proxy loses calls on this machine (Vite 8.3.8, Node 26.12.1, Windows): about one `/api` call in four ends with `ECONNRESET`. Only the test harness in `scripts/integration` works around it, with an agent of `node:http`. `apps/mobile/ui/vite.config.ts` and `apps/website/vite.config.ts` are unchanged. A manual check through a dev server with `?api=` or `/kiosk` can lose a call. See decision 22.
- AdGuard injects a script into each local page. It broke no check. If a page behaves oddly in a desktop browser, pause AdGuard for 127.0.0.1.
- Windows can show a firewall dialog for Node at the first start of a server on 0.0.0.0. `HOST=127.0.0.1` is enough for a phone on `adb reverse`.
- This machine has Python 3.14 at `C:\Users\marco\AppData\Local\Programs\Python\Python314\python.exe`. The brief said that it has none.

### Worktrees and branches of the lanes

After the review, remove the five lane worktrees in `C:\Users\marco\Desktop\glance-wt` (`android`, `hud`, `integ`, `server`, `web`) and the branches `overnight/android`, `overnight/hud`, `overnight/integ`, `overnight/server`, `overnight/web`:

```text
git worktree remove C:\Users\marco\Desktop\glance-wt\<lane>
git branch -d overnight/<lane>
```

`git branch -d` refuses a branch that is not merged. The keystore of the night exists only in the android worktree (section 3). It is a throwaway, so the removal loses nothing that the team needs.

## 2. Probe on the glasses (Plan 2 Task 4)

Not done in the night. The probe APK is built. Each later check on the glasses needs these results.

1. Install the debug build and open the probe. In PowerShell:

   ```text
   . "$env:USERPROFILE\.glance-tools\env.ps1"; $env:ANDROID_SERIAL='P11262000912'; cd C:\Users\marco\Desktop\glance\apps\mobile\android; .\gradlew.bat :app:installDebug
   adb -s P11262000912 shell am start -n com.metaglance.android/.probe.ProbeActivity
   adb -s P11262000912 logcat -d -s Glance
   ```

   Expected log line: `probe ready sdk=35 appId=0`.
2. Run each row of the probe table of Plan 2 Task 4, and write the results file `docs/research/2026-11-14-probe-results.md`. `Speak line` and `Endurance 10 min` play sound.
3. Pull one saved frame and look at it: `adb -s P11262000912 pull /sdcard/Android/data/com.metaglance.android/files/probe probe-out` (PowerShell). Natural colors prove that `VideoFrame.buffer` is I420. The docs say only YUV. With swapped or green colors, `I420.toNv21` and `DatLink.onFrame` must change.
4. Read the frame rate of the real stream. Expected: a rate near 7. The mock gives 30 frames each second from a video file, so the night could not check it.
5. Say the same command for two prompts in a row (Task 23 row 5). With MockDeviceKit, two equal final results with nothing between them arrive one time, because `Speech.transcriptions` is a `StateFlow`. If the glasses send no partial result between them, the second "add" is lost, and the app has no other API to read it. Write the result in the probe results file.
6. Set the measured values in `apps/mobile/android/app/src/main/kotlin/com/metaglance/android/dat/ProbeDecisions.kt`. It holds the plan defaults: `MOTION` true, `INPUTS` true, `SPEECH` false, `CAPTOUCH`, pitch axis X with down sign 1, yaw axis Y, `MOTION_NEEDS_STREAM` true, `AUDIO_ON_PHONE` false. Row 10 of the probe run decides the axes.
7. Set `SPEECH` to true only if the probe says so. While it is false, the real glasses attach no Speech, and the app asks for no microphone permission. Mock glasses always have Speech (`DatLink.usesSpeech`).
8. Replay the motion recordings (Task 8 Step 6). Put the 6 files in `apps/mobile/android/core/src/test/resources/motion` with names that end in `__nod<n>_shake<n>.csv`. Set `MIN_RECORDINGS` to 6 in `MotionReplayTest.kt` (it is 0 now). Build its config from the axes of `ProbeDecisions`. Run `./gradlew :core:test --tests "*HeadGestureDetectorTest" --tests "*MotionReplayTest"`. Tune only `minStrokeRad` and `minPeakRadS` of NORMAL, then `maxNodRad`. Commit with `test(android): replay the recorded motion files`. The detector passes only synthetic tests so far.
9. Do the walk test (Task 8 Step 7, Motion for 20 minutes). Open "Glance Probe", start a session, tap `Motion`, then `Gesture test`. Expected log line at the start: `gesture test start pitch=X down=1 yaw=Y`. Row 1: two people, 7.5 minutes each, no nod and no shake. The NOD count is false-yes, and the SHAKE count is false-no. Row 2: five people, 5 nods and 5 shakes each. Read the counts with `adb -s P11262000912 logcat -d -s Glance` (lines `gesture NOD nods=<n> shakes=<n>` and `gesture test end nods=<n> shakes=<n>`).

After the probe:

- Confirm the two limits for "the glasses cannot stream" in `apps/server/src/sessions/general.ts`: `CANNOT_STREAM_BATTERY` is 5 percent, `CANNOT_STREAM_THERMAL` is level 6. They are the plan defaults (Plan 1, "Assumptions to confirm", item 2).
- If the probe changes the main yes, change the voice lines of steps 2, 3, 4, and 6 in `docs/demo/run-sheet.md`.
- Give the four values under "Values for seat 4" to the website (section 8).
- Change the sentence "Nobody has run the app with real glasses yet" in the root `README.md`.

## 3. Keys and secrets

No key is in git. The secret files:

- `%USERPROFILE%\.glance-tools\secrets\server.env`: both keys, the voice ID, and the two fake switches.
- `%USERPROFILE%\.glance-tools\secrets\vendor-check.env`: both keys and the voice ID, for one deliberate vendor check.
- `apps/server/.env`: a copy of `server.env`.

### Settings to change

1. `apps/server/.env` holds `FAKE_RECOGNITION=1` and `FAKE_SPEECH=1`. Clear both for the real services.
2. Select the voices. `ELEVENLABS_VOICE_EN` is the default voice George (`JBFqnCBsd6RMkjVDRZzb`). `ELEVENLABS_VOICE_IT` is not set, so Italian lines get the English voice. A new voice ID gives each clip a new name, so the server makes each line again, one call for each line.
3. Set `DEMO_KEY` in `apps/server/.env` and on the deployed server to a long random value. The mirror page needs it for `GET /api/demo/latest?key=`. Without it that path answers 404. The key gives the token of the newest live session, so treat it as a secret.
4. Set `REQUIRE_BLUR=1` on the deployed server, and keep it set for the demo and the shoot. The face blur is on the phone now. Without the switch the server sends frames with `blurred: false` to Gemini and logs one warning for each session.
5. Keep `SAVE_FRAMES` not set for the demo and on the deployed server (spec section 11.1).
6. Set `SECOND_LOOK_WAIT_MS`. Its default is 0 (`apps/server/src/config.ts`), which means that the look-alike line plays at once. The Android app now sends a still after each `glance.ambiguous`, and the server waits for it when the value is above 0. The plan names 2500. Set `SECOND_LOOK_WAIT_MS=2500` in `apps/server/.env` and in `infra/.env` after the still check on the glasses passes (section 7). See decision 5 for the value.
7. With real speech, `PUBLIC_BASE_URL` must be an address that the phone can reach, because each clip address starts with it. With `adb reverse` on port 8080 the default `http://localhost:8080` works on the phone.
8. Make the team keystore with the steps of "The demo build" in `apps/mobile/android/README.md`. The keystore of the night is `C:\Users\marco\Desktop\glance-wt\android\apps\mobile\android\app\glance-demo.jks`. Its passwords are in `local.properties` of that worktree (keys `glance.demoStorePassword` and `glance.demoKeyPassword`). Both files are outside git. Do not ship an APK that this keystore signed.

### Money

- A real server (`npm run dev --workspace @glance/server` with both fake switches empty) makes one Gemini call for each frame, 2 each second while a phone streams. Do not leave it running with a phone attached.
- With real speech, each new line is one ElevenLabs call. Each answer to a question is one call with a new text of up to 200 characters.
- Write each vendor call in `docs/overnight/VENDOR.md`.

### Vendor checks to run

The Gemini model check of Plan 1 Task 13 Step 5 ran in the night (1349 ms). These did not:

1. ElevenLabs, Plan 1 Task 15 Step 5 (one call, 10 characters). Export `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_EN` from `vendor-check.env` in the shell, then:

   ```text
   curl -s -o camera-on.mp3 -w "%{http_code}\n" -X POST "https://api.elevenlabs.io/v1/text-to-speech/$ELEVENLABS_VOICE_EN/stream?output_format=mp3_44100_128" -H "xi-api-key: $ELEVENLABS_API_KEY" -H "content-type: application/json" -d '{"text":"Camera on.","model_id":"eleven_flash_v2_5"}'
   ```

   Expected: 200 and an MP3 that says "Camera on." Delete the file after the check. The same call passed one time on 2026-11-14 before the night.
2. One clip through the cache of the server. Start the server with the values of `vendor-check.env` plus `FAKE_RECOGNITION=1` and an empty `FAKE_SPEECH`. Open one browser client on the events stream. Stop the server after the first caption with a `url`. Each new line is one ElevenLabs call, and the default script speaks about 8 different lines in 60 seconds.
3. Gemini text, Plan 1 Task 26 (one call for each language). The script `check-ask.ts` never ran against the real service. In `apps/server`:

   ```text
   npx tsx --env-file=%USERPROFILE%\.glance-tools\secrets\vendor-check.env scripts/check-ask.ts oat-drink-1l "Does it contain nuts?"
   ```

   Expected: `answer:` with one or two sentences that name gluten and do not say that the product is safe, and `ms:` under 4000. Add the argument `it` for Italian.
4. If you change the recognition prompt, run the model check again with one product photo: in `apps/server`, `npx tsx --env-file="%USERPROFILE%\.glance-tools\secrets\vendor-check.env" scripts/check-model.ts <frame.jpg>`. Expected: `model: <name>`, a JSON result with `status`, and `ms:` under 4000. Without the JPEG path the command only reads the model and costs nothing. On 404 the model ID is wrong. On 400 `INVALID_ARGUMENT` the API rejects the schema: read https://aistudio.google.com/docs/structured-output.md?generate-content=true and change `recognitionResponseSchema` in `src/recognition/prompt.ts`.

### MongoDB

The server ran with the memory store only. `MongoStore` passes the typecheck against mongodb 7.9.0, and it has never run against a database.

1. Create the Atlas cluster (Plan 1 Task 8 Step 5).
2. Run `MONGODB_URI_TEST=<connection string> npm test --workspace @glance/server -- mongo`. Expected: 7 tests pass, none skipped. Each test makes a database named `glance-test-<random>` and drops it.
3. Set `MONGODB_URI`, then seed before the first start (section 5). With `MONGODB_URI` and no product in the database, the server stops with `products is empty. Run npm run catalog:seed.`

## 4. Deployment

Plan 1 Task 22 Steps 2, 5, and 6 need a person. The server lane reports that the image build and the Caddy path passed on this machine with a certificate for `localhost`.

1. Create the Vultr instance: Stockholm, `vc2-1c-1gb`, Marketplace app Docker on Ubuntu 24.04.
2. Create two DNS A records: `<domain>` and `hud.<domain>`.
3. Follow `infra/README.md`, part "Deploy". Set `DOMAIN`, `PUBLIC_BASE_URL`, `DEMO_KEY`, `REQUIRE_BLUR=1`, and the keys in `infra/.env` on the instance.
4. Run `npm run smoke --workspace @glance/server -- https://<domain>` on a laptop. Expected: seven `ok` lines and `smoke: OK`.
5. Run `curl -sS https://<domain>/healthz` before the demo. Expected: `"fakeRecognition":false,"fakeSpeech":false`, `"saveFrames":false`, and `"store":"mongo"` when `MONGODB_URI` is set.
6. Check the real Let's Encrypt certificate in a browser. The night checked only the certificate that Caddy signs for `localhost`.
7. To repeat the local Caddy check: `docker compose -p glance-check -f infra/compose.yaml -f override.yaml up -d --build`, then `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run smoke --workspace @glance/server -- https://localhost:18543` (from `infra/README.md`).

The demo APK (Plan 2 Task 20 Step 3 rows 3 and 4, and Step 4):

1. Set `glance.serverUrl` to the HTTPS address in `apps/mobile/android/local.properties`. The demo build allows no address without TLS. Until the HTTPS server exists, use the debug build, or type the address in "Glance Mock", "Server URL".
2. Run `npm run build --workspace @glance/phone-ui` at the root, then `./gradlew :core:test :app:assembleDemo` in `apps/mobile/android`, with the team keystore.
3. Compute the SHA-256: `Get-FileHash app\build\outputs\apk\demo\app-demo.apk -Algorithm SHA256`.
4. Install it. A phone with the debug build needs an uninstall first: `adb -s P11262000912 uninstall com.metaglance.android`, then `adb -s P11262000912 install app/build/outputs/apk/demo/app-demo.apk`. Check the launcher icons and one glance against the real server with the glasses.
5. Give `glance-demo.apk` and its SHA-256 to seat 4.

The debug APK has about 110 MB (bundled ML Kit models, DAT native libraries for 4 ABIs, no NDK strip). See decision 21.

## 5. Catalog

`apps/server/catalog/catalog.json` holds 12 entries with 63 `FILL_` marks, each price 0, and no Italian text.

1. Buy the 12 products and take the photos (Plan 4 Task 1 Steps 1 and 2).
2. Fill `apps/server/catalog/catalog.json`: each `FILL_` mark, each price from the receipt in cents, the allergens with a second reader (Step 4), vegan and vegetarian, and the `visual` text.
3. Fill the Italian texts (`name`, `spokenName`, `spokenPack`, `spokenPackDetailed`) of each product. A product with no Italian text is spoken in English inside an Italian sentence.
4. Run `npm run catalog:check --workspace @glance/server -- catalog/catalog.json`. Expected now: errors and a non-zero exit. Expected after the fill: `catalog: 12 products, 0 errors, 1 warnings` and exit 0. For Italian add `--lang it`. Fix each error before the seed.
5. If the count is not 12, change `CATALOG_SIZE` in `apps/website/src/content/landing.ts` and the pitch line in `docs/demo/run-sheet.md`.
6. After the team selected its voices, run the seed with clips one time: `npm run catalog:seed --workspace @glance/server -- catalog/catalog.json`. On the instance: `docker compose -f infra/compose.yaml run --rm server npm run catalog:seed -- catalog/catalog.json`. That is about 67 ElevenLabs calls for 12 products. The command prints the number of characters before the calls. With `MONGODB_URI` it also replaces the products of the database.
7. For Italian: set `ELEVENLABS_VOICE_IT`, run the seed with `--lang it` (the same number of clips again), and play three clips (Plan 1 Task 28 Step 4). If the voice reads Italian with English sounds, add `language_code` `it` to the body in `apps/server/src/speech/elevenlabs.ts` and listen again.
8. To store the products with no ElevenLabs call, add `--no-clips` to the seed command. `replaceProducts` has never run against a real database.

Also:

- Review the `visual` sentences of `apps/server/catalog/catalog.dev.json` for the barista oat drink, the rye bread, and the potato crisps. They are invented descriptions of demo products for the recognition prompt.
- Read `agents/recognition.md`. Its wording is new. The replay below gives the accuracy numbers.
- The seed of the dev catalog (`catalog/catalog.dev.json`, about 40 calls) did not run. The line `spotcheck.ask` depends on the product and gets its clip at the first use.

Accuracy of the recognition (Plan 1 Task 21 Step 4, one Gemini call for each frame, never run):

1. Collect frames with no Gemini cost: `SAVE_FRAMES=frames REQUIRE_BLUR=1 npm run dev:fake --workspace @glance/server` at the root. The frames land in `<directory>/<sessionId>/<seq>.jpg`. With `REQUIRE_BLUR=1` the server writes only frames with `blurred: true`. Never commit that directory: the frames can show people.
2. Move each frame to `apps/server/testdata/frames/<label>/`. A label is a product ID, `unknown`, or `none`. The folder does not exist yet.
3. Run `npm run replay --workspace @glance/server -- --frames testdata/frames`, and the same with `--media-resolution low`. `GEMINI_API_KEY` must be in `.env`. Add `--limit 20` for a first run. Spec section 16 wants 18 of 20 correct and `wrong identified: 0`.

## 6. Manual checks

### Tests to run one time on the merged tree

After the last merge (124282f) the night ran the first four commands below, and `node scripts/integration/android/run-spine.mjs --integration` (5 of 5 suites passed on the phone). Each passed. The other commands did not run on the merged tree. No command calls a vendor.

- `npm test --workspaces --if-present` and `npm run lint` at the root.
- `./gradlew clean ktlintCheck test :app:assembleDebug` in `apps/mobile/android`.
- `node scripts/integration/server-kotlin.mjs`.
- `node scripts/integration/server-web.mjs`. The BrowserBridge defect of the caption "Paid. ..." is fixed, and the script has no list of known defects. It ignores the flag `--strict`.
- `npm run build --workspace @glance/phone-ui` at the root, then `node scripts/integration/android/run-spine.mjs --all` (77 instrumented tests on the phone). Without the build, `PhoneUiPageTest` is skipped. Exit status 3 means "passed, a test was skipped". One suite: `--suite input`, `--suite extra`, `--suite state`. One class: `--class com.metaglance.android.StillPhotoPrepareTest`.
- `npm test` in `apps/mobile/android/tools/fake-server`.
- `CHROME_PATH="<path of msedge.exe>" node scripts/integration/server-web.mjs` for test 2 with another browser. It never ran.

`PaymentPromptTest` shows the Android biometric prompt on the phone for about one second, two times. It needs no touch.

One test timed out one time: "gives each kiosk its own ID, token, and code" in `apps/server/src/http/kiosks.test.ts` (5036 ms, one of six full runs, 20 POST calls). It then passed four times in a row.

### Phone with mock glasses: eyes, ears, and a finger

Setup: start `node server.mjs` in `apps/mobile/android/tools/fake-server` (after `npm install` there). Run `adb -s P11262000912 reverse tcp:8080 tcp:8080`. Use the server URL `http://127.0.0.1:8080` (in `local.properties` before the install, or in "Glance Mock", "Server URL"). Open the page with `adb -s P11262000912 shell am start -n com.metaglance.android/.MainActivity`. Read the log with `adb -s P11262000912 logcat -d -s Glance`.

Do the 14 rows of "Checks with the glasses or with sound" in `apps/mobile/android/README.md`. The rows that need no glasses:

- Mute time (Plan 2 Task 23 Step 4 row 1): mock session with sound against `npm run dev:fake --workspace @glance/server`. Tap `Say add` in "Glance Mock" while a prompt plays. Expected: the server logs no `speech.final`. Tap `Say add` one second after the prompt ended. Expected: `speech.final` with `add`, and the product is added.
- Real volume key (Task 21 Step 4 row 3): mock session with `mainYes: key`. Press volume up with no prompt. Expected: the volume changes, and the server logs no intent.
- Finger (Task 24 Step 2 row 1): type `bio` in the fake server, then put a known finger on the sensor. Expected: the prompt "Confirm payment" shows, and the fake server logs `biometric.result ok=true`.
- Wrong finger (row 2): type `bio`, use an unknown finger, then cancel. Expected: no line for the wrong finger, then `biometric.result ok=false`.
- Pocket mode with the prompt (row 3): enable pocket mode, type `bio`. Expected: the screen is bright while the prompt shows and dim after it.
- No screen lock (row 4): on a phone or an emulator with no screen lock, type `bio`. Expected: `ok=false`, and the page logs `native.biometric_unavailable`.
- Recognition slow: with sound on, type `slow` in the fake server. Expected: the glasses or the phone say "Recognition is slow right now."

Other checks with sound:

- Plan 2 Task 15 Step 3 rows 1 to 6: hear the tones of Camera on, found, added, and paid.
- Task 14 Step 4 rows 3 and 4 in the probe: `Play test line` (found sound, tone, `line ended`), and `Play bad clip` (the phone voice says "Test line." within 3 seconds, then `line ended`). Only `tools/fake-server` has `/clip.wav`.
- Task 15 Step 3 rows 8, 9, and 10: type `rest`, `badclip`, and `drop` in the fake server.
- Hear the "Connection lost" line after "Drop server link 10 s" in the mock menu.
- Task 3 row 4 in the probe: `Speak line`.

Other checks by hand:

- Feel each of the 8 haptic patterns (Task 19 Step 4). A hand must tell them apart. The debug panel (`debug=1`) gives no haptic message, so use a real session or the mock glasses.
- Pocket mode for one minute: the screen is black and stays on, and the screen timeout returns after `pocket.set` off.
- A pixelated face (Task 18 Step 5 rows 1 and 2): `cd apps/mobile/android/tools/fake-server && npm install && SAVE_FRAMES=1 node server.mjs`, "Glance Mock" with `Phone camera` pointed at a photo of a face, then open `glance-last.jpg` in the temp folder. No test image holds a face.
- Tap the menu items "Phone camera", "Still image", and "Replay CSV file". Each opens a picker or an Android prompt, and no test taps them.
- Task 17 Step 2 row 3: mock menu "Next registration fails", airplane mode, "Link glasses" on the page. Expected: the page shows "No internet." and "Try again".
- Task 17 Step 2 row 6: "Glance Mock", `Enable (registered)`, `Pair`, `Update required`, then the button "Open the update in Meta AI". Expected: it returns with no crash. No test sends `setup.openUpdate`, because the SDK opens the Meta AI app.
- The probe button `Mic permission` opens the permission screen of the SDK. Task 2 row 2: look at the phone camera feed (`Mock: phone camera`).
- Task 13 row 3: set the largest font size of the phone. Expected: the page text is larger.
- Task 13 row 2: `adb -s P11262000912 shell am force-stop com.metaglance.android`, open "Glance", and check that the profile is still there.
- Tap the "Get Meta AI" link. Expected: the Play Store page of `com.facebook.stella` opens outside the page.
- If `Mock: nod` gives no head intent, look at the sample timestamps first. The button loops its samples, and the time can go back at each wrap.

### Phone UI and accessibility

1. Run the Lighthouse accessibility audit of the session screen (Plan 3 Task 15 Step 5). The night could not run it. Start `npx vite --host 127.0.0.1 --port 5199 --strictPort` in `apps/mobile/ui`, then:

   ```text
   npx lighthouse "http://127.0.0.1:5199/?replay=1&ready=1" --only-categories=accessibility --chrome-flags="--headless=new"
   ```

   Repeat in dark mode from the Lighthouse panel of Chrome DevTools with the dark color scheme emulated. Expected: no contrast finding.
2. Turn TalkBack on and set the largest font size on the phone (Plan 3 Task 15 Step 6). Expected: a name for each control, a new caption and a cart change spoken with no touch, no cut text.
3. With TalkBack, check that the warning banners on the product card, the budget banner, and the fingerprint banner are read in a sensible order.
4. With TalkBack, check that the phone reads the Italian page with an Italian voice. The page sets the `lang` attribute to the profile language.
5. Measure the 48 px touch targets and the layout at 200 percent font scale on the Nothing Phone (1). The night measured only in jsdom and in desktop headless Chrome.
6. Look at the settings sheet on the phone. At a root font size of 200 percent on 360 px, the segments are cut in English and in Italian (Standard, Detailed, each speed, Nod is yes, Shake is yes, the head window values, the five main yes values). `apps/mobile/ui/README.md`, "Accessibility checks" item 2, says that no label may be cut. This defect is open.
7. Look at the page in the light and the dark scheme on the phone. The screenshots of the night are dark only.
8. Open `http://localhost:5173/?replay=1` at 360 px width after `npm run dev --workspace @glance/phone-ui`. Look at the card, the two full-width buttons (Add above Skip), and the cart. Headless Chrome confirmed the text and the order, not the look.
9. Check the extras against the fake server. Run `npm run dev:fake --workspace @glance/server`, open the phone UI dev server with `?ready=1&api=<server origin>`, and open the kiosk page with `/kiosk?spot=1`. Set an allergen and a budget in Settings, press Ask, fill a cart above 50 EUR, and look at the kiosk code. Set Italiano in Settings and check that the captions and the cart names arrive in Italian. The night checked the page side with unit tests and injected events.

Known limits of the phone UI:

- The demo run (`?replay=1`) ends with a full cart after "Paid", because `DEMO_RUN` has no `cart.updated` after `checkout.paid`. The real server sends one.
- The budget input takes whole euros only. A budget with cents from another client shows as a fraction in the field.
- In Italian these texts stay English: the words of Astryx itself ("completed" in the stepper, "Clear Budget" as the name of the clear button) and the debug panel.
- A touch yes with no prompt now says "Listening."

### Website and kiosk

1. Read the kiosk code with a camera (Plan 3 Task 6 Step 9). Run `npm run dev --workspace @glance/website`, and open `http://localhost:5174/kiosk?replay=1` in full screen on the demo laptop. A phone camera must read the code as `GL1 K3X7`. The code with its white border must be 15 cm wide or more (a 16:9 screen needs a diagonal of 14 inches or more). Then do the 1.5 m read test of spec section 16 with the glasses.
2. Look at the worst case of the kiosk on a real 1080p screen: 7 cart lines plus `and 2 more items` plus "Connection lost. Reconnecting.". By calculation it needs about 1054 px of 1080 px. A product name that wraps to two lines makes the page scroll.
3. Look at the spot check view with a cart of 9 lines on a real 1080p screen. `KIOSK_SPOT_ROWS = 5` comes from a calculation (row pitch 73 px), not from a measure. The replay `/kiosk?replay=1&spot=1` shows 2 lines only.
4. Check the kiosk against a server restart. Run `npm run dev:fake --workspace @glance/server`, open `http://localhost:5174/kiosk?name=Checkout%205`, then stop the server and start it again. Expected: "Connection lost. Reconnecting.", then a new code.
5. Try the spot check with the fake server: `POST /api/kiosks` with the body `{"name":"Checkout 4","store":"Demo Market","spotCheck":true}`. Expected on the session stream: `checkout.spotcheck`, then `checkout.offered` after the script shows the product again.
6. Open `http://localhost:5174/` and confirm that the headings show in the Figtree font and that the root route shows its heading. In headless Chrome, `document.fonts.check('16px Figtree')` was false after 4 seconds.
7. Open the landing page at 320 px width, press Tab through the links, and set 200 percent zoom (Plan 4 Task 3 Step 6). The night used a 200 percent root font size and CDP key events.
8. Read the landing page and the privacy page once on a phone and with a screen reader.
9. Print or show the QR text `GL1 K3X7` for tests with the fake server. It has the kiosk Checkout 3 at Demo Market from its start.

### Mirror page

Open `/mirror?latest=<DEMO_KEY>` on the second screen, with a server that has `DEMO_KEY` and real speech. Press Start mirror. Expected: each clip plays in order, and Mute stops the sound. Test 2 covers this path with fake speech only, which has no clip.

### Display HUD (Plan 4 Task 7 Steps 6 and 7)

These two steps did not run. No test renders `apps/display-pow/src/HudPage.tsx`. The night checked the screen by hand in headless Chrome at 600 x 600.

1. Run `npm run dev --workspace apps/display-pow -- --port 5175 --strictPort`. Open http://localhost:5175/ with the simulator extension https://chromewebstore.google.com/detail/jpjlmmodokemlepklkdbimceggpbjcll.
2. Step 6: check the quality checklist, the directional focus, and the first settled frame. The buttons exist only while a product is pending, so move the focus between the status region and the buttons in that time.
3. Step 7: record `hud-clip.webm` with the viewport recorder of the simulator. Keep it out of git. Label it "Simulation: Meta Ray-Ban Display Simulator" in the video.
4. Check the toast "Not sent. Try again.": open a live HUD link, stop the server while a product is pending, press Add.
5. Live mode: `npm run dev:fake --workspace apps/server`, then the `node -e` command of `apps/display-pow/README.md` (part "Run"), which prints the HUD address.
6. To repeat the runtime audit: start the dev server, start Chrome with `--remote-debugging-port=9222 --user-data-dir=<new empty folder>` and the HUD in its one tab at 600 x 600, then run at the root `node skills/mrbd-ui-toolkit/library/uit-screen-architecture-web/scripts/audit-runtime.mjs http://127.0.0.1:9222`. It has one open kind of finding: see decision 1.

### Other

- Review the 7 moderate `npm audit` findings of the dev tools. The night changed nothing for them. `npm install` also says that the postinstall scripts of `@astryxdesign/cli` and `@astryxdesign/core` are not covered by `allowScripts`. Nothing was approved.
- Read the schema limits of `packages/shared` in `QUESTIONS.md`, part "Phase A", and say if one is wrong.

## 7. Checks on the real glasses

Do these after the probe (section 2). Before them: connect Wi-Fi, install a build with the real server address, and allow Bluetooth at the first start.

1. Setup (Plan 2 Task 16 Step 3 rows 1 to 4): registration through Meta AI, the camera permission, a fold.
2. Start "Glance" cold with glasses that are registered and have the camera permission. Expected: the setup screen goes to "Ready" by itself when the glasses connect. Fix 654f8f2 was tested with MockDeviceKit only.
3. Spine with a fake server, 4 minutes of stream (Task 15 Step 4). Then M1 with the real server (Task 15 Step 5, and Plan 1 Task 15 Step 6).
4. Check that a DAT session reaches STOPPED after `session.stop()`. SessionController waits for that state. If the SDK does not report it, `session.start` after a rest does nothing.
5. Check if a stream error (for example `HINGE_CLOSED`) also stops the DAT session. The app classifies the stop only when the session reaches STOPPED or the stream reaches STOPPED or CLOSED.
6. Device states (Task 17 Step 3 rows 1 to 4, 4 stream minutes): a tap pauses, a tap and hold stops, doff and don, and a fold and an unfold start a new session. Expected for the fold: `native.hinge_closed`. The app reads the stop cause 500 ms after the stop. If the glasses report the closed hinge later, raise `STOP_SETTLE_MS` in SessionController.
7. Stop a session right after it starts, a few times (`session.start`, then `session.end` at once). DatLink waits until the stream is 1 second old, because the mock stream ended the app process in the video decoder of DAT 1.0.1. If the app still closes, raise `STOP_AFTER_STREAM_START_MS` in DatLink.
8. Face blur (Task 18 Step 5 row 3): a frame of 494 x 768 and a pixelated face of a person who agreed.
9. Haptics and pocket mode (Task 19 Step 4 rows 1, 3, 4).
10. Touchpad (Task 22 Step 4 rows 3 and 4, stream 2 minutes): double tap after a prompt, swipe after a line, one single tap. Expected: `intent yes` and `intent repeat` with the source `touch`, the line plays again, and the single tap pauses the session.
11. Voice (Task 23 Step 4 rows 3 to 5, stream 3 minutes), after `ProbeDecisions.SPEECH` is true: select the voice as main yes, allow the microphone in Meta AI, start a session. Expected: `capabilities.speech` is true. Say "add" after a prompt: one `speech.final`, and none with the words of the prompt. Say "add" for two prompts in a row: two messages.
12. Still (Task 25 row 3, stream about 3 minutes): start a session, hold a product up, type `amb` in the fake server. Expected: one frame with `kind=still blurred=true` in the fake server log. Write down its size and the milliseconds of the app log line `still seq=...`.
13. Nod after a still (Task 25 rows 4 and 5): wait for the next prompt and nod. Expected: `intent yes`, source `head`. The log shows `revive motion` if the still stopped Motion. If the nod has no effect, cut the sharp second look, as the plan says.
14. Second look with the real server (Plan 1 Task 30 Step 4): start the server with real recognition and `SECOND_LOOK_WAIT_MS=2500`. Hold the two look-alike products up in turn. Expected: the voice names the right product with no look-alike line.
15. Hear the spoken states of Plan 1 Task 18: "Paused. Tap the side of your glasses to resume." on a pause, "Glasses battery at twenty percent." and the ten percent line, "Back online." after the phone loses and regains the network, and "Recognition is slow right now." after 3 failed recognition calls.
16. Hear the lines of the extras with real clips: a glance with "Warning: contains gluten." and the sound warning, "That is over your budget of twenty euros.", "I cannot tell which oat drink this is. Turn the front to me." with the two real look-alike products, "Listening." with a real answer, the fingerprint line, and the spot check lines.
17. Read `docs/architecture.md` once against the real run. The glance path with the head nod is checked against the code and the fake server only.

## 8. End-to-end test of spec section 18, and Plan 4 Task 8

### End-to-end test

Run the main take of spec section 18 with the real glasses, the deployed server, the kiosk page on a laptop, and the mirror page on a second screen:

1. Start: "Camera on." The capture LED is visible.
2. Glance at the oat drink. Hear the name and the price. Put it back. The cart does not change.
3. Glance at the rye bread. Nod. "Added rye bread."
4. Glance at a product. Shake. "Skipped." With the allergen guard, the voice gives the warning first.
5. Show the phone: captions and the cart.
6. Look at the kiosk. Hear the store and the total. Nod. The kiosk shows "Paid". "Camera off." The LED goes dark.

Separate shots: glasses off the face and then folded, and two look-alike products. `docs/demo/run-sheet.md` has the steps of the shoot.

### Plan 4 Task 8: late content and the publish check

Branch: `chore/website-late-content`.

1. Fill the values:
   - `PROBE` in `apps/website/src/content/probe.ts`: the four values under "Values for seat 4" in `docs/research/2026-11-14-probe-results.md`.
   - `apps/website/src/content/numbers.json`: each measured number or `null`, and the date, the place, and the glasses in `context`. If the replay ran on another count than 100 frames, change the unit `of 100`. Remove `false-yes` and `false-no` if head gestures do not start.
   - `CATALOG_SIZE`, `TEAM`, `LINKS.videoId`, and `LINKS.apkUrl` in `apps/website/src/content/landing.ts`. The video has captions for each spoken line.
   - `PRIVACY_FACTS` in `apps/website/src/content/privacy.ts`: `contactEmail`, and `geminiNoTrainingConfirmed` only after the team reads the terms of its Gemini tier.
2. Publish the APK: `gh release create demo-2026-11-15 glance-demo.apk --title "Meta Glance demo APK" --notes "Demo build. It needs Developer Mode in the Meta AI app. SHA-256: <value from seat 1>"`. The link works only if the repository is public. If the team hosts the APK on the server, use that URL.
3. Check each privacy and data line against the build, with the table of Plan 4 Task 8 Step 2. Check each "Design" line of the landing copy, for example "MongoDB Atlas stores the cart and the order" and "The server runs on Vultr": the night server kept its data in memory and was not deployed. Open each `Source:` link one time.
4. Ask the Meta mentors about the logo on the landing page before the page goes public. It holds the Meta mark (Plan 4 Task 3).
5. Run `npm test --workspace @glance/website` after each edit, then `npm run build --workspace @glance/website`. The copy guard runs in the tests, and it also checks the context sentence. Commit with `chore(website): fill the measured numbers, the links, and the team`.
6. Merge the pull request. Build the static pages on the instance (Plan 1 Task 22 Step 6). Open `https://<domain>/` and `https://<domain>/privacy` in a private window, and reload `/privacy`. Expected: both pages load, the video plays, and the APK downloads.

## 9. Review of the Italian text by a native speaker

Nobody checked the Italian text. An agent wrote it.

1. Read `apps/server/src/speech/lines.it.ts` and the rows `PHRASES_IT` in `apps/server/src/speech/phrases.ts` (Plan 1 Task 28 rule 8). Points to check:
   - "Di' add per aggiungere." (an English command word in an Italian sentence)
   - "Annuisci per aggiungerne ancora."
   - "Nel carrello: un pezzo."
   - "Attenzione: non per vegani."
   - "Non distinguo tra X e Y. Mostrami il davanti."
   - "Ti ascolto." and "Non ho una risposta."
   - "uno e zero cinque" for 1.05
   - "Checkout 3, Demo Market." (the kiosk name stays as registered)
   - "Controllo rapido. Mostrami questo prodotto: bevanda di avena." and "Grazie."
   - the 14 allergen names
2. Confirm the number forms: centotto, centottanta (elision), centouno and milleuno (no elision), ventuno euro.
3. Read the table `IT` in `apps/mobile/ui/src/text/strings.ts`. It uses the informal "tu" and the words of the server lines (Fotocamera, Solleva un prodotto per sentire il prezzo, Annuisci, articoli, Totale).
4. Confirm these choices of the phone UI:
   - Undo and cancel are both "Annulla".
   - The main yes segment for the phone is "App". "Telefono" and "Schermo" were cut in a segment of 62 px at a width of 360 px.
   - The head window segment is "In vista". "Finché in vista" was cut.
   - "Prova la voce" for Play sample and "Elimina i dati" for Delete my data. The longer forms were cut at 200 percent.
   - `cameraChoose` says "Consenti sempre o Consenti una volta". Check both against the real button names of the Italian Meta AI app.
   - The speed shows a decimal comma ("1,5x").
   - The allergen names are the short label forms (for example "Frutta a guscio", "Lupini").
   - `spotCheckText` is "Mostrami questo prodotto: <name>.", with no article before the name.
5. Listen to the Italian clips after the seed (section 5, step 7).

## 10. Decisions for the team

Each one is a choice that the night made or left open. `QUESTIONS.md` has the reasons.

HUD:

1. The runtime audit has one open kind of finding: the caption repeats a fact of the screen (three states, listed in `apps/display-pow/README.md`). Accept it, or remove the caption block, which spec section 12 asks for.
2. The dock shows Add and Skip only while a product is pending, because the audit rejects a dock with no enabled action. The plan asked for two mounted, disabled buttons. The focus goes to Add when a product arrives, and to the body element after an answer. Check on the simulator that this feels right.
3. The HUD shows no sign of a lost stream. With the server stopped, the last state stays on the screen. Decide if the mockup needs one.

Server:

4. Confirm rule 7a of Plan 1 Task 5: a later appearance of the kiosk code gives a new pay prompt when the head window is over. It is in the code, and the spec does not state it.
5. Decide the value of `SECOND_LOOK_WAIT_MS` after the still check on the glasses. The wait starts at the ambiguous result. The still needs the capture (about 1 second in one test) plus one recognition call (4 seconds at most). If the still result is often later than 2500 ms, the shopper hears the look-alike line and then the glance line.
6. Decide if the look-alike line must stay silent while one of its candidates is muted (just added or skipped and still in view). It is one more rule in `onAmbiguous` of `apps/server/src/sessions/glance.ts`.
7. Decide the order of several warnings on one product, and the wording for missing diet data, which uses "Allergen data is missing for this product." (contract gap 8 of Plan 1).
8. Confirm three lines that are not in the spec (Plan 1, assumption 6): "Warning: not vegan.", "Warning: not vegetarian.", and "I cannot tell if this is oat drink or rye bread."
9. Decide if 30 seconds from the last look at the code is enough time for the fingerprint (R19).
10. Decide if the cost of one ElevenLabs call for each answer to a question is acceptable for the demo.
11. Decide if the kiosk of the demo registers with `spotCheck` (the kiosk page takes `?spot=1`). With real recognition the shopper must show the product with the highest price until the model identifies it. An unsure or ambiguous result does not pass, and the checkout ends after 30 seconds without the code in view.
12. Decide if the words of the shopper may be in the server log. `apps/server/src/ws/device.ts` logs `speech.final text=...`.
13. Decide if the events stream of a paid or ended session stays open (now) or ends (Task 10 decision).
14. Decide if a profile patch is stored at once (now) or only with the next event, as the plan says.
15. Decide the two open points between Plan 1 and Plan 2 in `QUESTIONS.md`: speech during a clip, and how often the phone repeats `kiosk.seen`. The server counts a nod on the pay prompt only if it got `kiosk.seen` in the last 3 seconds.

Android:

16. Decide if the payment prompt must report `ok: false` by itself after `cancelPayment`. The app waits for the error callback of the Android prompt after `checkout.cancelled` and `session.end`. That works on the test phone (Android 15). If a phone gives no callback, `PaymentConfirm` stays open, and the next `biometric.request` shows no prompt.
17. Decide if the main yes may change two times when the shopper selects the voice with no microphone permission: `head` at once, then `voice` when Speech starts. Each change goes to the page and to the server.

Phone UI and website:

18. "Play sample" sends the intent `help`, because the bridge has no message for a speech sample (contract gap 2). Decide if that is good enough.
19. The "Main yes input" control is not in spec section 6.5 (contract gap 6). Decide if it stays.
20. Decide if `checkout.suspended` must clear the banner "Quick check." on the phone. It ends at `checkout.offered`, `checkout.cancelled`, `checkout.paid`, or a snapshot. If the server sends only the caption "Thank you." after the product was shown, the banner stays until the shopper looks at the code again.
21. Decide if the APK needs ABI filters. The debug APK has about 110 MB, which matters for the website download.
22. Decide if the app configs get the HTTP agent for the Vite dev proxy (section 1). Without it, a dev server on this machine loses `/api` calls.
23. Decide if 5 seconds is the right grace time for the last line in a desktop browser (`LAST_LINE_GRACE_MS` in `apps/mobile/ui/src/bridge/browserBridge.ts`). It affects only the phone UI with `?api=`.
24. Decide if a phase change must clear the look-alike notice. It stays until the next product prompt, cart change, or snapshot, also behind the checkout sheet and after the phase ended.
25. Kiosk: when the server refuses the stream, the page registers a new kiosk each 3 seconds and shows a new code. The plan did not ask for this. Without it the page stays on "Connection lost. Reconnecting." until a person reloads it. Confirm.
26. Decide on code splitting. The builds of the phone UI and the website print the Vite warning for a chunk over 500 kB.

## 11. Checks that did not run

| Check | Why | Where |
|---|---|---|
| Probe on the glasses (Plan 2 Task 4), motion replay and walk test (Task 8 Steps 6 and 7) | No glasses | Section 2 |
| Each check on the real glasses of Plan 2 Tasks 15 to 25 | No glasses | Section 7 |
| Each check by ear | Media volume 0, and no clip exists | Sections 6 and 7 |
| ElevenLabs check (Plan 1 Task 15 Step 5), one clip through the cache | Not run, ledger 0 of 5 | Section 3 |
| Gemini text check (Plan 1 Task 26), English and Italian | Skipped | Section 3 |
| Seed with clips (Plan 1 Task 20 Step 4), Italian clips (Task 28 Step 4) | Over the ElevenLabs limit, no voice selected | Section 5 |
| Replay with real frames (Plan 1 Task 21 Step 4) | No frames, one Gemini call for each frame | Section 5 |
| `MongoStore` against a database (Plan 1 Task 8 Step 5), seed with `MONGODB_URI` | No MongoDB address | Section 3 |
| Vultr instance, DNS, deploy, smoke through the domain, real certificate (Plan 1 Task 22 Steps 2, 5, 6) | Needs a person | Section 4 |
| Final signed APK on the phone (Plan 2 Task 20 Step 3 rows 3 and 4, Step 4) | Needs the team keystore and the HTTPS address | Section 4 |
| Real catalog and its check (Plan 4 Task 1 Steps 1, 2, 4, 5) | Needs a shopping trip | Section 5 |
| Lighthouse audit (Plan 3 Task 15 Step 5), TalkBack and the largest font (Step 6) | Not run | Section 6 |
| Camera read and ruler measure of the kiosk code (Plan 3 Task 6 Step 9) | Needs a phone and a ruler | Section 6 |
| Mirror page with real clips | Needs ElevenLabs calls | Section 6 |
| Display simulator and the WebM clip (Plan 4 Task 7 Steps 6 and 7) | Needs a person and the Chrome extension | Section 6 |
| A test that renders `HudPage.tsx` | Does not exist | Section 6 |
| "Recognition slow" against the real server | `RecognitionSlowTest` runs against `tools/fake-server`, and fake mode never sends that error | Section 7, step 15 |
| A finger on the payment prompt, the real volume key, the mute time with sound | Need a person | Section 6 |
| Late content and the publish check (Plan 4 Task 8) | Morning work | Section 8 |
| End-to-end test of spec section 18 | No glasses, no deployment | Section 8 |

## 12. Documents to check

A documentation pass ran after the last merge (a5744ba, 43ad02c). It corrected `docs/architecture.md`, the root `README.md`, and the READMEs of the apps against the code. Nobody rendered the Mermaid diagrams after that pass, so open `docs/architecture.md` on GitHub one time and look at each diagram.
