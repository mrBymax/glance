# DAT feasibility notes for Meta Glance

Date: 2026-11-13.

Scope: what the Meta Wearables Device Access Toolkit (DAT) allows for the store demo on Ray-Ban Meta Gen 2, and what the Display web app platform allows for the mockup.

Sources: the `wearables-dat` docs server (DAT SDK docs v1.0, SDK 1.0.1) and `skills/meta-wearables-dat/references/`. Page paths are relative to `https://wearables.developer.meta.com/docs/develop/`. A line marked "verify" is not stated in the docs and needs a test on real glasses.

## Summary

The store demo is feasible on Ray-Ban Meta Gen 2. Four facts shape the design:

1. The camera stream is at most 720 x 1280 pixels. A standard product barcode at arm's length is too small to decode. A large QR code with a short text on a kiosk screen is large enough.
2. Gen 2 glasses have no display. Sound is the only output on the glasses, so speech is the main interface and not an extra.
3. The SDK is native only: Swift for iOS and Kotlin for Android. The docs show no React Native or Flutter support. Two platforms mean two glasses integrations.
4. Voice, touchpad, button, and head-motion input all use beta capabilities. Beta capabilities work in development and beta channels, which is enough for a hackathon.

## Devices and SDK

| Fact | Source |
|---|---|
| Supported glasses: Ray-Ban Meta Gen 1 and Gen 2, Ray-Ban Meta Optics, Meta glasses, Meta Ray-Ban Display, Oakley Meta HSTN, Oakley Meta Vanguard. | `dat/getting-started-toolkit` |
| SDK 1.0.1 needs Meta AI app V292 and glasses firmware V128, or later. | `dat/version-dependencies` |
| Android: Maven Central group `com.meta.wearable`, modules `mwdat-core`, `mwdat-camera`, `mwdat-display`, `mwdat-mockdevice`. Android 10 or later. | `references/android/getting-started.md` |
| iOS: Swift package `meta-wearables-dat-ios`. The sample apps need Xcode 26.4, Swift 6.3, and iOS 17.2, or later. | `references/ios/getting-started.md` |

An iOS build needs a Mac. That is an Apple rule, not a DAT rule.

## Camera

| Fact | Source |
|---|---|
| Stream sizes: 720 x 1280 (high), 504 x 896 (medium), 360 x 640 (low). Frame rates: 2, 7, 15, 24, 30. | `dat/streaming` |
| The stream uses Bluetooth Classic. When bandwidth drops, the glasses lower the resolution first and the frame rate second. | `dat/streaming` |
| A request for a lower resolution or frame rate can give a sharper frame, because each frame gets less compression. | `dat/streaming` |
| The glasses crop the sensor image to 9:16, correct lens distortion, stabilize, and compress with HEVC. | `dat/camera-stream-processing` |
| `stream.capturePhoto()` takes a still while the stream runs. One iOS test got 1440 x 1080 in about 1 second. | `dat/streaming`, GitHub issue `meta-wearables-dat-ios#363` |
| Standalone photo capture (beta) reaches 4032 x 3024. It cannot run while the stream runs. A full-size photo takes more than 40 seconds. | `dat/camera-capture`, GitHub issue `meta-wearables-dat-android#199` |
| A single tap on the touchpad pauses or resumes the session. A tap and hold stops the session. The device reserves both, and the app never receives them. | `dat/inputs` |
| Meta states "up to 30 minutes live streaming" at 720p and 30 frames per second. The docs give no battery figure for a DAT stream. | `meta.com/legal/ray-ban-meta/disclosures` |
| The capture LED stays on during a DAT stream. No API turns it off. | GitHub issue `meta-wearables-dat-ios#318` |
| A stream that starts while the glasses are off the face pauses when the wearer puts them on. A tap resumes it. | `references/ios/debugging.md` |

### Can the stream read a product barcode?

No, not at a natural distance. Sources are in `2026-11-13-context-and-prior-art.md`.

- An EAN-13 barcode at standard size is about 37 mm wide. Its narrowest bar is 0.33 mm.
- A developer measured the stream at about 53 by 83 degrees. The docs give no figure.
- ML Kit needs 2 pixels for the narrowest bar, so an EAN-13 must be 190 pixels wide.
- With 720 pixels across 53 degrees, the stream gives that only within about 12 cm.
- Developers report the same result: only large and well-lit codes decode in the stream.

A QR code on a kiosk screen is a different case. A 15 cm code with 25 modules has 6 mm modules. At 50 cm, each module covers about 9 pixels.

Consequences:

- Do not build on barcode decode. Gemini recognizes the product from the look of its package.
- The stream cannot read small print. Price, ingredients, and allergens come from the store catalog.
- Make the kiosk QR code large, and test the distance at which it decodes.

## Audio and voice

| Fact | Source |
|---|---|
| The glasses are a standard Bluetooth audio device. Audio that the app plays goes to the glasses speakers over A2DP. No SDK call is necessary. | `dat/microphones-and-speakers` |
| Microphone capture over HFP moves the glasses off A2DP. Playback drops to mono voice quality while HFP is active. | `dat/microphones-and-speakers` |
| On iOS, the HFP route must settle before the camera stream starts. If not, the audio route can fail with no error. | `dat/microphones-and-speakers` |
| Speech (beta) runs speech recognition on the glasses and returns partial and final text. It needs the DAT microphone permission. | `dat/speech` |
| Speech does not use the phone audio route, so playback should stay on A2DP. Verify. | inferred |
| Speech can stop after inactivity or a timeout. The app must watch its state and start it again. | `dat/speech` |
| Speech reports the locale of the glasses, for example `en-US`. The docs do not list the supported languages. Verify for Italian. | `Speech` reference |
| In-stream audio (beta) delivers raw PCM with the video and does not use HFP. It is not filtered to the voice of the wearer. | `dat/microphones-and-speakers` |
| "Hey Meta, start <app name>" can open the app (beta). It needs setup in the Wearables Developer Center and a new integration version. | `dat/voice-invocations` |

## Input without the phone

| Fact | Source |
|---|---|
| Inputs (beta) delivers decoded events: `Nav` and `Select` from the touchpad, and `Capture` from the capture button (short press, hold, double press). | `dat/inputs` |
| A double tap on the touchpad arrives as `Select`. A swipe arrives as `Nav`. | `dat/inputs` |
| `Back` events do not arrive from real glasses yet. Action button support is not validated on all hardware. | `dat/inputs` |
| Inputs has no runtime permission. `PERMISSION_DENIED` means that the capability is not approved for the app in the Developer Center. | `references/android/inputs.md` |
| Motion (beta) streams accelerometer and gyroscope samples from the glasses at 5 to 60 Hz. App code can detect a nod or a head shake from them. | `dat/motion` |
| Motion has no runtime permission. It must be enabled for the app in the Developer Center. | `references/android/motion.md` |
| Inputs gives no raw touch signal and no muscle signal. | `dat/inputs` |

Open point: the docs do not say if beta capabilities start in Developer Mode with app ID `0`. Verify in the first hour.

## Session, device state, and errors

The challenge asks for a prototype that handles permissions, errors, connectivity, and device state changes. The SDK exposes each of them.

| Fact | Source |
|---|---|
| Session states: idle, starting, started, paused, stopping, stopped. Stopped is final, and the app must create a new session. | `dat/lifecycle-events` |
| A session pauses or stops when another experience takes the glasses, when the wearer removes or folds them, or when Bluetooth drops. | `dat/lifecycle-events` |
| Folded glasses disconnect Bluetooth. Unfolded glasses connect again, but the session does not start again. | `dat/lifecycle-events` |
| Device state gives battery level, charging, worn or not worn, hinge open or closed, and thermal level. It is available before a session starts. | `dat/device-state` |
| Stream errors include hinge closed, thermal hot, battery low, peak power limit, permission denied, and timeout. | `StreamError` reference |
| Registration and the camera permission both open the Meta AI app. Registration needs internet. The wearer selects "allow once" or "allow always". | `dat/permissions-requests` |

## Phone in the pocket

| Fact | Source |
|---|---|
| iOS: decoded (`raw`) frames arrive only while the app is in the foreground. Compressed `hvc1` frames also arrive in the background, and the app must decode them. | `VideoCodec` reference |
| iOS needs the background modes `bluetooth-central`, `bluetooth-peripheral`, `external-accessory`, and `processing` in `Info.plist`. | `references/ios/getting-started.md` |
| Android: the searched docs state no background rule. Expect that a foreground service is necessary. Verify. | not documented |

Consequence: for the demo, keep the app in the foreground with the screen on and a touch-locked "pocket" screen. Background operation is a later step.

Update of 2026-11-14. The app now has that later step, and the "pocket" screen is gone.

| Fact | Source |
|---|---|
| The CameraAccess sample of Meta keeps a camera stream alive "when the screen is locked or the app is in the background" with a foreground service of the type `connectedDevice` and a partial wake lock. It sets `compressVideo = true` and decodes the frames itself. | `samples/CameraAccess`, `stream/StreamingService.kt`, in `facebook/meta-wearables-dat-android` |
| The jars of DAT 1.0.1 (`mwdat-core`, `mwdat-camera`, `mwdat-motion`) hold no check of the foreground, of the screen state, or of a wake lock. | read in the jars |
| The Android docs of the SDK still state no background rule. The rule "only in the foreground" is in the iOS reference only. | `Stream`, `StreamConfiguration`, and the streaming guide |

Consequence: Glance has `SessionService`, a foreground service with the types `connectedDevice` and `mediaPlayback` and a partial wake lock. Glance uses the frames that the SDK decodes, which the sample does not show behind a locked screen. Nobody measured it on the glasses yet. `apps/mobile/android/README.md` has the checks, in "Checks with the glasses or with sound". If the decoded frames stop with the screen off, the next step is `compressVideo = true` with a decoder in the app.

## Registration and distribution

| Fact | Source |
|---|---|
| Developer Mode: in the Meta AI app, open Settings, then App Info, and tap the app version five times. A toggle appears. | `dat/getting-started-toolkit` |
| In Developer Mode the app ID and the client token can be `0`. The SDK then skips attestation. | `dat/build-integration-android` |
| Only one third-party app can stay registered at a time in Developer Mode. | `dat/permissions-requests` |
| Developer Mode can switch off after an app update or a firmware update. | `references/ios/debugging.md` |
| Without Developer Mode, a user must accept an email invite to the release channel of the project. The invite goes to a Meta account. | `dat/set-up-release-channels` |

Consequences for the download links on the website:

- An APK link works for a person who has the glasses and turns on Developer Mode.
- An IPA file does not install on an arbitrary iPhone. Apple requires TestFlight or a profile that lists the device. This is an Apple rule.

## Development without glasses

| Fact | Source |
|---|---|
| MockDeviceKit simulates a pair of glasses inside the app: power, fold, wear, battery, thermal level, and permission results. | `dat/mock-device-kit` |
| The mock camera can play a video file or use the camera of the phone as a live feed, on both platforms. | `dat/mock-device-kit` |
| The mock can inject input events, speech transcripts, and motion recordings. | capability references |

Consequences:

- Teammates without glasses can build and test.
- The phone camera feed is a fallback for the live demo if the glasses fail.

## Meta Ray-Ban Display

| Fact | Source |
|---|---|
| A web app runs in a Chromium browser on the glasses. It must use HTTPS. | `webapps` overview |
| A web app cannot use the camera and cannot capture microphone audio. Only a DAT phone app can. | `llms.txt` |
| The display is 600 x 600 and additive: a black pixel is transparent. Input is directional focus and select. | `webapps/build/display-and-layout` |
| The Meta Ray-Ban Display Simulator (a Chrome extension) previews a web app on a desktop and records a WebM video. | `webapps/test` |
| A web app loads on real glasses from the Meta AI app: Developer Mode, App Settings, Apps, Web Apps, Connect Web App. | `webapps/setup` |
| The glasses give head motion events. Where it is released, the Neural Band gives wrist orientation as a quaternion. | `webapps/build/sensors-and-location` |
| Text to speech works through `speechSynthesis` with one default `en-US` voice. | `webapps/build/text-to-speech` |
| A DAT phone app can also draw on the display (text, images, buttons, short video) through `mwdat-display`. | `dat/display-overview` |

Consequences:

- The Display mockup can be a real web app that runs in the simulator. The simulator recording can go into the video.
- "Look at the QR code" cannot work inside a Display web app, because a web app has no camera. On Display glasses, the camera part stays in the phone app.
- Peer-to-peer payment: a search of the DAT docs found no API for BLE beacons or for proximity between two wearers. The Neural Band gives decoded gestures and wrist orientation, not a raw muscle signal. A handshake detector needs its own motion logic and a server that matches two wearers. Treat it as a concept, not as a feature of the prototype.

## Checks for the first hour

The design document replaces this list. Use section 9.2 (the probe) and section 16 (the result table) of `docs/superpowers/specs/2026-11-13-meta-glance-design.md`. The list below is the first version, kept for the record.

Do these checks on real glasses before the team commits to a design. The `CameraAccess` sample app covers the stream and photos only, so the other checks need the probe build.

1. Start Motion, Inputs, and Speech in Developer Mode with app ID `0`. Record which capabilities start. This check decides what confirms a purchase, so do it first.
2. Hold a real product at a natural distance. Save 20 stream frames at 720 x 1280 and 7 frames per second. These frames are the test set for Gemini.
3. Show a QR code of 15 cm on a laptop screen. Record the largest distance at which ML Kit decodes it from the stream.
4. Play a speech clip to the glasses while the stream runs. Make sure that the stream continues.
5. Lock the phone. Check if frames continue to arrive.
6. Stream for 10 minutes. Record the battery drop and the thermal level.
7. On the Display glasses, start a stream and then open a web app. Check if the stream continues.
