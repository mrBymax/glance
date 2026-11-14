# Morning steps for the team

In order: phone state, probe on the glasses, keys, deployment, catalog, manual checks, end-to-end test.

## 1. Phone state that the night changed

The team changed two settings on 2026-11-14 so that the phone stays awake. Restore them:

```text
adb -s P11262000912 shell settings put global stay_on_while_plugged_in 2
adb -s P11262000912 shell settings put system screen_off_timeout 30000
```

Old values: `stay_on_while_plugged_in` was 2, `screen_off_timeout` was 30000.

Media volume: it was already 0 of 16 on the speaker before the first device test (read at about 04:10 on 2026-11-14), so there is no value to restore.

Docker Desktop was started in the night with `docker desktop start`. Stop it with `docker desktop stop`.

The build tools are in `%USERPROFILE%.glance-tools` (about 2.4 GB, no change of the system PATH). Load them with `env.sh` or `env.ps1` in that folder.

## 2. Probe on the glasses

Plan 2 Task 4: run the probe app on the real glasses and write the results file. Not done in the night.

## 3. Keys

- `apps/server/.env` holds `FAKE_RECOGNITION=1` and `FAKE_SPEECH=1`. Clear both for the real services.
- The env files set `ELEVENLABS_VOICE_EN` to the default voice George (`JBFqnCBsd6RMkjVDRZzb`). The team selects its voices.

## 4. Deployment

## 5. Catalog

## 6. Manual checks

- Review the 7 moderate `npm audit` findings of the dev tools. The night changed nothing for them.
- Read the schema limits of `packages/shared` in `QUESTIONS.md`, part "Phase A", and say if one is wrong.

## 7. End-to-end test of spec section 18

Plan 4 Task 8 (late content and the publish check) is morning work.
