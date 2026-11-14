# Morning steps for the team

In order: phone state, probe on the glasses, keys, deployment, catalog, manual checks, end-to-end test.

## 1. Phone state that the night changed

The team changed two settings on 2026-11-14 so that the phone stays awake. Restore them:

```text
adb -s P11262000912 shell settings put global stay_on_while_plugged_in 2
adb -s P11262000912 shell settings put system screen_off_timeout 30000
```

Old values: `stay_on_while_plugged_in` was 2, `screen_off_timeout` was 30000.

## 2. Probe on the glasses

Plan 2 Task 4: run the probe app on the real glasses and write the results file. Not done in the night.

## 3. Keys

- `apps/server/.env` holds `FAKE_RECOGNITION=1` and `FAKE_SPEECH=1`. Clear both for the real services.
- The env files set `ELEVENLABS_VOICE_EN` to the default voice George (`JBFqnCBsd6RMkjVDRZzb`). The team selects its voices.

## 4. Deployment

## 5. Catalog

## 6. Manual checks

## 7. End-to-end test of spec section 18

Plan 4 Task 8 (late content and the publish check) is morning work.
