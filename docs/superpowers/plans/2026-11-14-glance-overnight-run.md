# Meta Glance: brief for the unattended overnight build

This file is for the session that builds Meta Glance while the team sleeps. Read all of it before you start. The team cannot answer questions until the morning.

## Goal for the night

Build as much of the five plans as possible, in the order below, so that the team can start tests with the real glasses when it wakes up. The spine must work before any extra starts.

- Spec: `docs/superpowers/specs/2026-11-13-meta-glance-design.md`
- Plan 0, foundation: `docs/superpowers/plans/2026-11-14-glance-0-foundation.md`
- Plan 1, server: `docs/superpowers/plans/2026-11-14-glance-1-server.md`
- Plan 2, Android app: `docs/superpowers/plans/2026-11-14-glance-2-android.md`
- Plan 3, phone UI, kiosk, mirror: `docs/superpowers/plans/2026-11-14-glance-3-phone-ui-kiosk-mirror.md`
- Plan 4, website, HUD, catalog, run sheet: `docs/superpowers/plans/2026-11-14-glance-4-website-hud.md`

Each plan tags its tasks with a step: C1 (probe), C2 (spine), C3 (the parts that the challenge asks for), or an extra number. Read each task in full before you start it.

## Rules

1. Never wait for a person. If a step needs a person, a secret, or the real glasses, write it in `docs/overnight/MORNING.md` and continue with the next step.
2. Never work on `main` and never push to `main`. Create the branch `feat/overnight-build` from `origin/docs/implementation-plans`.
3. Each commit message is a conventional commit: `type(scope): description`. No Claude attribution lines in a commit or in a pull request.
4. Push `feat/overnight-build` after each finished task group. Do not merge it into `main`. At the end, open one draft pull request into `main` with the status table.
5. Follow each plan task by task, with its tests. Do not skip a test to save time.
6. When you do not know something, research it online before you guess. This applies to an API, a build error, a tool flag, and a version conflict. Read the vendor documentation first, then the issue tracker of the project. Write what you found, with its address, in `docs/overnight/QUESTIONS.md`.
7. Do not invent an SDK call. For the DAT SDK use `skills/meta-wearables-dat/` and the `wearables-dat` docs server. For Astryx use `npx @astryxdesign/cli`. For the Display toolkit use `skills/mrbd-ui-toolkit/`.
8. A task is `blocked` only when it needs a person, a secret, or the real glasses. For each other failure, do not give up: research the cause, try another approach, and write each attempt in `docs/overnight/STATUS.md`. If the task still fails, keep it `todo`, continue with a task that does not depend on it, and come back to it in a later iteration.
9. Text in code, comments, and docs follows `skills/anti-slop/SKILL.md`.
10. Commit no secret. `.env` files, `local.properties`, and keystores stay out of git. Never print a key, and never put one in a log, a test, a fixture, a document, or a commit message.
11. Do not stop at a time of day. The work is done when no task is `todo`. Then write the summary at the top of `docs/overnight/STATUS.md`, push, and end the loop.
12. The plans were written for four people. Where a plan says to open a pull request, to wait for a merge, to tell a seat, or to start a branch from `main`: do not. Do the work of each seat yourself, in the lanes below.
13. Plan 0 is the contract. If the code of two lanes disagrees on a type or a message, Plan 0 decides. Fix the lane, not the contract.
14. If a test of a plan cannot pass because the plan is wrong, do not bend the product code to it. Find the evidence in the spec, in Plan 0, or in the vendor documentation. Then fix the test, and write the reason in `docs/overnight/QUESTIONS.md`.
15. Never run `git add -A` or `git add .` at the repository root. Add the paths of the task, as the plans do.
16. Never commit with `--no-verify`. The pre-commit hook stops a commit with a secret, an ESLint error, or a ktlint error. Fix the finding (section "Lint and the commit hook").
17. The team has little money for the vendors. Keep to the limits of the section "Keys and money". A loop, a test, or a server that calls a vendor again and again is forbidden.
18. Keep the documentation current (section "Documentation"). Each diagram is a Mermaid code block.

## Lanes and branches

Do not create the branches that the plans name (`feat/server`, `feat/android-c1`, `chore/website-scaffold`, and the others).

- The main session works on `feat/overnight-build`. It owns the files in `docs/overnight/`. A lane agent reports to the main session and does not edit these files.
- Each lane has one git worktree outside the repository folder and one branch `overnight/<lane>`, created from `feat/overnight-build` after phase A. Lanes: `server` (Plan 1), `android` (Plan 2), `web` (Plan 3, and Plan 4 Tasks 1 to 5), `hud` (Plan 4 Tasks 6 and 7).
- After each finished task group: merge the lane into `feat/overnight-build`, run the tests of the merged tree, and push `feat/overnight-build`. Before each new task group: merge `feat/overnight-build` into the lane.
- A conflict in `package-lock.json`: take the file of `feat/overnight-build`, run `npm install` at the repository root, and commit the result.
- Each worktree needs its own `npm install`.

## The loop

This session runs under `/loop` with no interval, so that it never stops by itself.

1. At the start of each iteration, read `docs/overnight/STATUS.md`. If it does not exist, create it from the task lists of the five plans, with each task `todo`.
2. Select the next open tasks in the order of work below. Do not start a task that another agent of this session still works on.
3. Do the tasks. Update `docs/overnight/STATUS.md`, commit, and push. Write the status so that the next iteration can continue with no memory of this one.
4. Stop each server and each emulator that you started. A server that stays up holds its port, and the next iteration fails on it.
5. Schedule the next iteration. End the loop only when no task is `todo`.

## Order of work

| Phase | Work | Done when |
|---|---|---|
| A | Plan 0, Tasks 1 to 5 | `npm test --workspace @glance/shared` passes |
| B | In parallel: Plan 1 Tasks 1 to 16. Plan 2 Tasks 1 to 3 and 5 to 15. Plan 3 Tasks 1 to 6. | Each lane passes its own tests |
| C | The integration tests of this brief | The spine runs with mock glasses and the fake server |
| D | The C3 tasks: Plan 1 Tasks 17 to 22, Plan 2 Tasks 16 to 20, Plan 3 Tasks 7 to 15, Plan 4 Tasks 1 to 5 | Tests pass, and the debug APK builds |
| E | Plan 2 Tasks 21 to 23 first. Then the extras in the order of spec section 5: 1, 2, 3, 4, 5, 6, 7, 8, 9. For each extra, do its tasks in each plan before the next extra. | Tests pass |

- Do not start phase E while a task of phase B, C, or D is open and not blocked.
- Plan 2 Tasks 21 to 23 are the other input paths: volume keys, double tap, and voice. The probe on the glasses decides in the morning which input is the main yes, so each path must exist.
- Plan 4 Task 8 is morning work. Write its steps in `MORNING.md`.

## Software to install

Install without administrator rights, because nobody can confirm a system dialog. Put tools in `%USERPROFILE%\.glance-tools` and set the variables in each shell. The addresses below answered on 2026-11-14. Check each one before you use it.

- The machine is Windows 11 with 32 GB of memory. It has Node 26, npm 11, `gh`, Chrome, and Edge. It has no JDK and no Android SDK.
- `adb.exe` is at `%LOCALAPPDATA%\Android\platform-tools\adb.exe`. It is not on `PATH`.
- JDK 17 as a zip: `https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse`. Set `JAVA_HOME`.
- Android SDK command line tools as a zip: the link "Command line tools only" on `https://developer.android.com/studio`. Unpack to `<sdk>\cmdline-tools\latest`. Set `ANDROID_HOME` to `<sdk>`. Run `sdkmanager --licenses`, then install `platform-tools`, `platforms;android-36`, and the build tools that the build asks for. With `ANDROID_HOME` set, the build needs no `local.properties`.
- Gradle: Plan 2 Task 1 Step 1 creates the project with the Android Studio wizard. This machine has no Android Studio. Write the files of Step 2 by hand. Then get `https://services.gradle.org/distributions/gradle-8.14.1-bin.zip` and run `gradle wrapper --gradle-version 8.14.1` in `apps/mobile/android`. Commit the wrapper files. The project needs no resource file of the wizard.
- FFmpeg as a zip, with `libx265`: `https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip`. Integration test 3 needs it.
- Use `npm install` at the repository root for each JavaScript package of the plans.
- Docker Desktop is installed, and its daemon is not running. Start it only if it starts with no dialog. If not, skip the image build of Plan 1 Task 22 and write it in `MORNING.md`.
- If an installer asks for administrator rights, do not use it. Find a zip distribution.
- If Windows shows a firewall dialog for Node, leave it open. The tests use `127.0.0.1` and `adb reverse`, and they need no firewall rule.

## The phone

The team set one phone for the night. Use it for each device test.

- Use only the phone with the serial `P11262000912`. It is a Nothing Phone (1) with Android 15 and an arm64 processor.
- A second phone is attached (`00023156K005488`). Never send a command to it.
- Pass `-s P11262000912` to each `adb` command. Set `ANDROID_SERIAL=P11262000912` in each shell that runs Gradle. Without it, `./gradlew :app:installDebug` installs on each attached phone.
- The phone reaches a server on this machine through USB: run `adb -s P11262000912 reverse tcp:8080 tcp:8080`. Then `http://127.0.0.1:8080` on the phone is port 8080 of this machine. Build the test app with that address as `glance.serverUrl`. A debug build allows an address with no TLS.
- Give the app its Android permissions with `adb shell pm grant com.metaglance.android <permission>`, so that no dialog waits for a tap.
- The phone already stays awake while it is on USB. It has a screen lock. If `adb shell dumpsys window` shows `isKeyguardShowing=true`, the phone is locked: do not try to unlock it. Set the device tests to `morning`, continue with the other work, and check the lock again in each iteration.
- The team sleeps near the phone. Before the first device test, read the media volume and write it in `MORNING.md`. Then set it to 0. With no sound, the app reports each prompt at once (Plan 2 Task 9, rule 5).
- Change nothing else on the phone. Install only `com.metaglance.android` and its test package. Do not open, stop, or remove another app. Do not change another setting.
- The Meta AI app is on the phone. Do not use it. Mock mode needs no Meta AI app, and the registration with the real glasses is morning work.
- If the phone is not attached: use an Android emulator, if `emulator -accel-check` reports an accelerator. If not, build the debug APK, and set the device tests to `morning`.

## Without the glasses

The real glasses are not available during the night. "Mock glasses" means MockDeviceKit of the DAT SDK.

- Plan 2 Task 4 (the probe run) and each check "on the glasses" go to `docs/overnight/MORNING.md`. Build the probe app, but do not wait for its results.
- Until the probe has run, assume that Motion, Inputs, and Speech all start. Keep the gyroscope axes and the other probe values as named constants in one file, with the defaults of Plan 2.
- The motion recordings of Plan 2 Task 4 do not exist yet. The replay test of Plan 2 Task 8 passes with an empty folder. Leave its Steps 6 and 7 for the morning.
- Run the pure Kotlin tests with `./gradlew :core:test`. They need only the JDK.
- The plans describe many checks as taps on a probe screen or on a mock menu. Nobody can tap. Do each such check as an instrumented test, or drive the screen with `adb shell uiautomator dump` and `adb shell input tap`. A check that needs eyes or ears goes to `MORNING.md`.

## Keys and money

The team gave two keys and has little money. Each vendor call costs money. ElevenLabs is the scarce one.

- The keys are in `%USERPROFILE%\.glance-tools\secrets\server.env`, and in `apps/server/.env` of the main checkout. Git ignores both. A worktree has no `.env`: copy the file there only for a vendor check, and never add it to git.
- Both files also set `FAKE_RECOGNITION=1` and `FAKE_SPEECH=1`. So each server that reads the file makes no vendor call. Run each server of the night this way, or with `npm run dev:fake`.
- A vendor check is one command that reads `%USERPROFILE%\.glance-tools\secrets\vendor-check.env` in place of `.env`. That file holds the two keys and no fake switch. Example, in `apps/server`: `npx tsx --env-file=<that file> scripts/check-model.ts <frame.jpg>`.
- No unit test and no integration test calls a vendor. The tests of the plans use stubs.
- Keep a ledger in `docs/overnight/VENDOR.md`: one line for each vendor call, with the time, the vendor, the purpose, and the characters or the image count. Read the ledger before each call. The loop has no memory, and the ledger is the count.
- Gemini: the key works, and the model `gemini-3.5-flash-lite` exists (checked on 2026-11-14 with the model list, which costs nothing). Limit for the night: 20 calls. Use them for the checks of Plan 1 Task 13 Step 5 and Task 26. Never run a server with real recognition while a phone or a script sends frames: that is 2 calls each second.
- ElevenLabs: on 2026-11-14 the key was valid, but the API answered that it lacks the permission `text_to_speech`. It also cannot read the balance or the voice list. Make one test call: the call of Plan 1 Task 15 Step 5 with the text "Camera on.". If the answer is 401 again, make no other ElevenLabs call this night, and write in `MORNING.md` that the team must give the key the text to speech permission.
- If that test call works: the limit for the night is 5 calls and 300 characters in total. The team gave no voice ID. For the test call, take a default voice ID from the ElevenLabs documentation, and write it in `QUESTIONS.md`. The team selects its voices in the morning.
- Never run `catalog:seed` with clips. Use `--no-clips`. A seed makes about 40 clips, and a later change of the voice makes each one again.
- No MongoDB address exists. The server keeps its data in memory. Do not create an Atlas cluster.
- When a limit is reached, stop the calls to that vendor, write it in `STATUS.md`, and continue with the fake modes.

## Steps that need a person

- Plan 1 Task 22 (Vultr): write the files in `infra/`, and check that the image builds if Docker runs. The instance, the DNS records, and the secrets are morning work.
- Plan 2 Task 20 (signed APK): write the build configuration. Make a keystore with a random password, keep both in `local.properties` and out of git, and check that `assembleDemo` gives an APK. The team makes its own keystore and the final APK in the morning, when the server address exists.
- Plan 4 Task 1 (catalog): do Step 3 only. Write `apps/server/catalog/catalog.json` with the 12 slots of the shopping list and the template values. Keep the `FILL_` marks and the price 0. Never invent a price, a GTIN, a brand, or an allergen. `catalog:check` fails for this file until a person fills it, and that is correct. Each test and each server of the night uses `catalog/catalog.dev.json`.
- Plan 4 Task 7: Steps 6 and 7 need the Display simulator and a person. Do Steps 1 to 5, 8, and 9.
- Plan 3 Task 21 and Plan 1 Task 28: write the Italian text. A native speaker reads it in the morning.

## Lint and the commit hook

The repository has a pre-commit hook. `README.md` describes it in the part "Hooks".

- `.githooks/pre-commit` runs `scripts/hooks/pre-commit.mjs` on the staged files: a scan for secrets, ESLint, and ktlint. `git config core.hooksPath` is already `.githooks` on this machine, for each worktree.
- ESLint: `eslint.config.mjs` at the root holds the rules. Plan 0 Task 1 installs the tools at the workspace root. `npm run lint` checks all files. A worktree needs `npm install` before its first commit of a script file.
- ktlint: Plan 2 Task 1 adds the Gradle plugin and `.editorconfig`. Run `gradlew ktlintFormat` before a commit with Kotlin files. The hook needs `JAVA_HOME`.
- A lint rule that rejects code of a plan: fix the code where that is cheap. If not, change that one rule, with a comment that says why, and write it in `QUESTIONS.md`.
- If the hook itself fails, repair `scripts/hooks/pre-commit.mjs`. Do not go around it.

## Documentation

The repository has a Stop hook of Claude Code: `.claude/settings.json` runs `.claude/hooks/stop-docs.cjs` each time the session wants to stop. If code changed and no document changed with it, the hook asks one time for a documentation update. This is expected. Do the update, then stop.

Documents to keep current. Describe only what exists and works at that time.

- `README.md` at the root: what the project is, the folders, the tools that a machine needs, and the commands that install, test, and run each part. Keep the logo block and the parts "Hooks" and "Agent Skills".
- One `README.md` in each app and each package: how to run it, its settings, and its checks. Plans 0 and 2 already ask for two of them.
- `docs/architecture.md`: the parts and the messages between them, the path of one glance from the frame to the cart, the phases of a session, and the steps of a checkout.
- Each diagram is a Mermaid code block: `flowchart` for the parts, `sequenceDiagram` for a message path, `stateDiagram-v2` for phases and steps. No ASCII drawing and no image file of a diagram.
- The files in `docs/overnight/` are the log of the night. They do not count as documentation for the hook.

## Integration tests

The team asked for integration tests between the server and the app, and for tests of the DAT code with mock glasses. End-to-end tests with the real glasses happen in the morning.

Put the scripts in `scripts/integration/` and name them in `docs/overnight/STATUS.md`. Keep their tools in `scripts/integration/package.json`, so that no app gets a new dependency. A browser runner can drive the installed Chrome with no browser download.

1. Server and Kotlin client. A script starts the server with `--fake` on a free port, runs a JVM test of the Android project against it, and stops the server. The test uses the real `GlanceApi`, `DeviceSocket`, and codecs of Plan 2. It plays the spine: create a session, open the socket, send `device.state` and frames, receive a `speak` with a prompt ID, send `prompt.done`, send a yes, receive `cart.updated`, send `kiosk.seen` with `GL1 K3X7`, receive `checkout.offered`, send a yes, receive `checkout.paid` and `session.end`.
2. Server and web pages. A test starts the same fake server and drives the phone UI with `BrowserBridge` (`?api=`), the kiosk page, and the mirror page through one shop. Use the test tools that Plan 3 already has where they fit.
3. App with mock glasses, on the phone. Write instrumented tests in `apps/mobile/android/app/src/androidTest`. Follow the DAT guide "Android testing with Mock Device Kit": search the docs server for `testing-mdk-android MockDeviceKitTestCase`. Add the `androidx.test` libraries that the guide needs, with versions that you read from Google Maven. Plan 2 Task 1 deletes the `androidTest` folder of the wizard, and this folder is new work of this brief.

Details for test 3:

- The fake server runs on this machine, and the phone reaches it through `adb reverse`. Use a script file of your own for stable timing: `FAKE_RECOGNITION=<path>` takes it (Plan 1, "Two switches for the other seats").
- The mock camera takes a video file: `setCameraFeed(fileUri)`. The DAT docs say that the file must be h265. Make two short clips with FFmpeg from generated images, at 720 x 1280: a plain scene, and the QR code `GL1 K3X7`. Make the code image with the `qrcode` package.
- A mock nod is a motion feed with the samples of `GyroScript` (Plan 2 Task 8).
- Spine test: enable MockDeviceKit, pair the mock glasses, power on, unfold, don, set the plain clip, and start a session. Check each step: the stream reaches `streaming`, frames go out, a prompt arrives, `prompt.done` goes out, a mock nod adds the product, and the snapshot of the server holds one item. Then set the QR clip. Check: `kiosk.seen` goes out, the pay prompt arrives, a mock nod pays, the phase is `paid`, and the DAT session stops.
- State test: reach each state of spec section 6.6 with the MockDeviceKit calls and the debug hooks of Plan 2 Task 17. Check the fields of `NativeState`, the `error` events, and the `device.state` messages against the table of Plan 2 Task 17 Step 2.
- Page test: with the build of Plan 3 in the APK, check that the WebView shows the setup screen, the product card, and the cart.

## Known differences from the spec

The plans differ from the spec in three places. Follow the plans. Do not fix these differences. The team decides in the morning.

1. R19: the server ends a checkout after 30 seconds without the code in view. It does not test if the checkout screen of the phone is closed (Plan 1, "Contract gaps", item 3).
2. "The glasses cannot stream": the server and the page read it from the battery level and the thermal level, not from a stream error (Plan 1, "Contract gaps", item 1).
3. Plan 1 Task 5 rule 7a is not in the spec: a later appearance of the kiosk code gives a new pay prompt when the head window of the old one is over.

## Files to keep up to date

- `docs/overnight/STATUS.md`: one row for each task of each plan, with `todo`, `done`, `blocked`, or `morning`, and the commit of each finished task. At the top: what works, how to run it, and what is blocked.
- `docs/overnight/MORNING.md`: the steps for the team, in order: the phone state that you changed, the probe on the glasses, the keys, the deployment, the catalog, the manual checks, and the end-to-end test of spec section 18. For the keys, say that `apps/server/.env` holds `FAKE_RECOGNITION=1` and `FAKE_SPEECH=1`, and that the team clears both for the real services.
- `docs/overnight/QUESTIONS.md`: each decision that you made in place of the team, with the reason, and each fact that you researched, with its address.
- `docs/overnight/VENDOR.md`: the ledger of vendor calls (section "Keys and money").

## Prompt for the new session

Paste it as one line. `/loop` with no interval lets the session pace itself and start again each time it stops.

```text
/loop Read docs/superpowers/plans/2026-11-14-glance-overnight-run.md and follow it exactly. Build Meta Glance from the five plans it lists, unattended. Each time this prompt fires, read docs/overnight/STATUS.md and continue with the next open tasks, with workflows and parallel agents. Nobody can answer you: never wait for a person. When you do not know something, research it online before you guess. Install the software you need without administrator rights. For ADB use only the phone P11262000912, never the other one. Spend almost nothing on Gemini and ElevenLabs: keep to the limits of the brief. Never commit with --no-verify, and keep the documentation current, with Mermaid for each diagram. Use conventional commits with no Claude attribution lines, never touch main, and push feat/overnight-build as you go. Do not stop until no task is open.
```
