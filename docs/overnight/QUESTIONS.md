# Decisions and researched facts

Each entry: the decision or the fact, the reason, and the address of the source.

## Phase A (Plan 0)

- `@types/node` ^22 and `"types": ["node"]` were added to `packages/shared`, because the plan tests import `node:fs` and the typecheck includes them.
- The types are `z.infer` of the schemas. A probe confirmed that each one is assignable both ways to the hand-written type of the plan.
- Limits that the plan gives as comments are enforced in the schemas: speechRate 0.8 to 2, battery 0 to 100, thermal 0 to 7, confidence 0 to 1, item qty at least 1, Product.id lower case with hyphens, at most 20 captions in a snapshot, kiosk code 4 to 8 characters of A-Z and 0-9.
- `encodeFrame` throws `FrameFormatError` for a header above 1024 bytes, so that it cannot make a message that `decodeFrame` rejects.
- `EMPTY_CART` and `DEFAULT_PROFILE` are frozen (commit 8606460). Reason: a write in one lane would change the cart of each session. Make a new object in place of a write.
- Not changed: `parseKioskCode` converts to upper case before the match, as Plan 0 says. `Receipt.paidAt` is a non-empty string with no ISO check.
- npm registry on 2026-11-14 (https://registry.npmjs.org): vitest 5.1.0, zod 4.6.7, eslint 10.15.0, typescript-eslint 8.72.2, typescript 6.0.3 in the plan range (latest 7.0.2).

## Tools

- JDK: https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse gave 17.0.21+9. Checksum matched.
- Android command line tools: https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip, named on https://developer.android.com/studio. Checksum matched. `sdkmanager` prints a deprecation warning and still works.
- Gradle: https://services.gradle.org/distributions/gradle-8.14.1-bin.zip. FFmpeg: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip gave 9.0.2 with libx265. Checksums matched.
- Decision: build-tools 35.0.0 and 36.0.0 are both installed, because Plan 2 names no version.
- Decision: all Android SDK licenses were accepted with `sdkmanager --licenses` for the team.
- Decision: no emulator image is installed, because the phone is attached. `emulator -accel-check` reports WHPX as usable.

## Phone

- Read the media volume: `adb -s P11262000912 shell cmd media_session volume --stream 3 --get`. Set it: the same with `--set 0`. Source: the usage text that the phone prints for `cmd media_session`.
- The volume index is per output device. With a headset attached the index differs, so read the volume again before each device test.
