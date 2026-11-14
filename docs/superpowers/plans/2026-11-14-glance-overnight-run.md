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

Each plan tags its tasks with a step: C1 (probe), C2 (spine), C3 (the parts that the challenge asks for), or an extra number.

## Rules

1. Never wait for a person. If a step needs a person, a secret, or the real glasses, write it in `docs/overnight/MORNING.md` and continue with the next step.
2. Never work on `main` and never push to `main`. Create the branch `feat/overnight-build` from `origin/docs/implementation-plans`. Use git worktrees for work in parallel, and merge each finished lane into `feat/overnight-build`.
3. Each commit message is a conventional commit: `type(scope): description`. No Claude attribution lines in a commit or in a pull request.
4. Push `feat/overnight-build` after each finished task group. Do not merge it. At the end, open one draft pull request into `main` with the status table.
5. Follow each plan task by task, with its tests. Do not skip a test to save time. If a task fails three times, write the failure in `docs/overnight/STATUS.md`, mark the task `blocked`, and continue with a task that does not depend on it.
6. Do not invent an SDK call. For the DAT SDK use `skills/meta-wearables-dat/` and the `wearables-dat` docs server. For Astryx use `npx @astryxdesign/cli`. For the Display toolkit use `skills/mrbd-ui-toolkit/`.
7. Text in code, comments, and docs follows `skills/anti-slop/SKILL.md`.
8. Commit no secret. `.env` files stay out of git.
9. Stop at 09:00 local time, or when each task is done or blocked. Then write the summary at the top of `docs/overnight/STATUS.md` and push.

## Order of work

| Phase | Work | Done when |
|---|---|---|
| A | Plan 0, Tasks 1 to 5 | `npm test --workspace @glance/shared` passes |
| B | In parallel: Plan 1 Tasks 1 to 16. Plan 2 Tasks 1 to 3 and 5 to 15. Plan 3 Tasks 1 to 6. | Each lane passes its own tests |
| C | The integration tests of the next section | The spine runs with mock glasses and the fake server |
| D | The C3 tasks of each plan, and Plan 4 Tasks 1 to 5 and 8 | Tests pass, and the debug APK builds |
| E | Extras in the order of spec section 5: 1, 2, 3, 4, 5, 6, 7, 8, 9. For each extra, do its tasks in each plan before the next extra. | Tests pass |

Do not start phase E while a task of phase B, C, or D is open and not blocked.

## Software to install

Install without administrator rights, because nobody can confirm a system dialog. Put tools in `%USERPROFILE%\.glance-tools` and set the variables for each shell.

- The machine has Node 26 and npm 11. It has no JDK and no Android SDK.
- JDK 17: a zip distribution, for example Eclipse Temurin. Set `JAVA_HOME`.
- Android SDK: the command line tools zip. Set `ANDROID_HOME`. Install the packages that Plan 2 Task 1 names with `sdkmanager`, and accept the licenses with `sdkmanager --licenses`.
- Use `npm install` at the repository root for each JavaScript package.
- If an installer asks for administrator rights, do not use it. Find a zip distribution.

## Without the glasses

The real glasses are not available during the night. "Mock glasses" means MockDeviceKit of the DAT SDK.

- Plan 2, Task 4 (the probe run) and each manual check "on the glasses" go to `docs/overnight/MORNING.md`. Build the probe app, but do not wait for its results.
- Until the probe has run, assume that Motion, Inputs, and Speech all start. Build each input path. Keep the gyroscope axes and the other probe values as named constants in one file, with the defaults of Plan 2.
- Run the pure Kotlin tests with `./gradlew :core:test`. They need only the JDK.
- For tests that need an Android device, use this order. First: a phone on USB, if `adb devices` lists one. Second: an Android emulator, if the machine has hardware acceleration. Third: no device. In the third case, build the debug APK and note the missing device tests in `MORNING.md`.

## Without keys

- If `apps/server/.env` holds `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, and `ELEVENLABS_VOICE_EN`, use them for the steps that call a vendor. Keep each vendor call small: a few test calls, not a loop.
- If a key is missing, use `FAKE_RECOGNITION=1` and `FAKE_SPEECH=1`, and write the skipped vendor steps in `MORNING.md`.
- Plan 1 Task 22 (Vultr): write the files in `infra/` and check that the image builds, if Docker is present. The instance, the DNS records, and the secrets are morning work.
- Plan 4 Task 1 (catalog): write `catalog.json` from the dev catalog of Plan 1, with a clear mark on each value that a person must replace.

## Integration tests

The team asked for integration tests between the server and the app, and for tests of the DAT code with mock glasses. End-to-end tests with the real glasses happen in the morning.

1. Server and Kotlin client. A script starts the server with `--fake` on a free port, runs a JVM test of the Android project against it, and stops the server. The test uses the real `RestClient`, `DeviceSocket`, and codecs of Plan 2. It plays the spine: create a session, open the socket, send frames, receive a `speak` with a prompt ID, send `prompt.done`, send a yes, receive `cart.updated`, create a kiosk, send `kiosk.seen`, receive `checkout.offered`, send a yes, receive `checkout.paid`.
2. Server and web pages. A test starts the same fake server and drives the phone UI with `BrowserBridge`, the kiosk page, and the mirror page through one shop. Use the test tools that Plan 3 already has. Add a browser runner only if it installs with no system dialog.
3. App with mock glasses. On a device or an emulator: start the app in mock mode against the fake server, feed the mock camera, and check that a spoken line arrives and that the page shows the cart. Reach each state of spec section 6.6 from the mock menu.

Put the scripts in `scripts/integration/` and name them in `docs/overnight/STATUS.md`.

## Files to keep up to date

- `docs/overnight/STATUS.md`: one row for each task of each plan, with `todo`, `done`, `blocked`, or `morning`, and the commit of each finished task. At the top: what works, how to run it, and what is blocked.
- `docs/overnight/MORNING.md`: the steps for the team, in order: the probe on the glasses, the keys, the deployment, the catalog, the manual checks, and the end-to-end test of spec section 18.
- `docs/overnight/QUESTIONS.md`: each decision that you made in place of the team, with the reason.

## Prompt for the new session

```text
Read docs/superpowers/plans/2026-11-14-glance-overnight-run.md and follow it exactly.
Build Meta Glance from the five plans it lists, unattended, until 09:00 local time.
Nobody can answer you tonight: never wait for a person, and write open points in the files that the brief names.
Work in the order of the brief, with workflows and parallel agents. Use the superpowers skills for execution.
Install the software you need without administrator rights.
Use conventional commits, no Claude attribution lines, never touch main, and push feat/overnight-build as you go.
```
