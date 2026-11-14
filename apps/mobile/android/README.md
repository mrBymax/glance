# Glance for Android

The Android app of Meta Glance. This folder holds a Gradle project with two modules.

- `core` is pure Kotlin on the JVM. It holds each rule that a unit test can check.
- `app` is the Android application `com.metaglance.android`. Its debug build also holds the probe screen "Glance Probe". Its demo build is the signed APK for the testers.
- `tools` holds a fake server and the script that makes the sounds. Both need Node 22 or later.
- `app/src/androidTest` holds the tests that run on a phone with mock glasses. See "Instrumented tests".

The app has three screens. Each one has its own icon on the phone.

- "Glance" is `MainActivity`: a WebView with the phone UI. An APK that was built without the phone UI shows a placeholder page with one button for each message of the bridge.
- "Glance Mock" is `MockMenuActivity`: the menu of mock mode, in each build. See "Mock mode for seats without glasses".
- "Glance Probe" is `ProbeActivity`, in the debug build only: a list of buttons above a log. It writes each log line to Logcat with the tag `Glance`, and to `Android/data/com.metaglance.android/files/probe/probe-<start time>.log` on the phone.

The debug APK has about 110 MB, because it holds the ML Kit models and the libraries of the DAT SDK.

`biometric.request` of the server has no handler yet. The app logs it.

## Parts

```mermaid
flowchart LR
    Page[Page in the WebView] <--> Bridge[WebBridge]
    Bridge <--> Session[SessionController]
    Session --> Link[DatLink]
    Session --> Pipeline[FramePipeline with QrScanner and FaceFinder]
    Session --> Queue[SpeechQueue with ExoLinePlayer]
    Session <--> Socket[DeviceSocket]
    Session --> Api[GlanceApi]
    Socket <--> Server[Glance server]
    Api --> Server
    Pipeline --> Socket
    Link --> Sdk[DAT SDK]
    Mock[MockGlassesController] --> Kit[MockDeviceKit]
    Kit --> Sdk
    Sdk --> Glasses[Glasses through Meta AI]
    Probe[ProbeActivity, debug build] --> Link
    Probe --> Mock
    Menu[MockMenuActivity] --> Mock
    Menu --> Link
    Menu --> Session
```

- `GlanceApp` owns one `DatLink`, one `MockGlassesController`, one `ProfileStore`, and one `SessionController`. A new activity keeps the session.
- `DatLink` is the one connection to the DAT SDK. It gives a `snapshot` of the state, the `faults` of the SDK, and the `frames` of the stream. Call its functions on the main thread.
- A frame is a `RawFrame` in I420 layout. `frames` holds the newest frame only. A frame with an odd width or height, or with fewer bytes than its size needs, is dropped with one log line.
- While a session runs, the device of the snapshot comes from the session. After the session, it comes from the device list of the SDK again.
- `attachMotion`, `attachInputs`, and `attachSpeech` add a capability to a started session. `gyro`, `motionRows`, `touches`, and `transcripts` give their data.
- A capability that stops with no request from the app starts again 750 ms later, at most 3 times in a row, and only if the session still runs then. `Revival` in `core` holds the count.
- A stop waits until the stream is 1 second old. A stop at the start of a stream ended the app process in the video decoder of the SDK (DAT 1.0.1).
- `captureStill` takes a photo while the stream runs.
- `PhoneVoice` speaks a line with the speech engine of the phone, as media sound.
- `ProbeDecisions` holds the values that the probe run on the glasses decides: the capabilities that start, the input sources, and the gyroscope axes. Its values are defaults until that run.
- A stopped DAT session is final. `startSession` creates a new session each time.
- `MockGlassesController` pairs mock glasses of MockDeviceKit. Call `DatLink.initialize` after `enable` and after `disable`. `enable` on a kit that runs starts it again, and its mock glasses are gone then.
- `DatLink.initialize(false)` with MockDeviceKit off stops the use of the SDK: the registration is `UNAVAILABLE`, and the device is gone.
- `DatLink` has three debug hooks for the states that MockDeviceKit cannot make. `debugFault` reports a fault as if the SDK reported it, and a `STREAM` fault also stops the session. `debugOverride` sets a missing Meta AI app or the compatibility of the device. `debugClearOverrides` removes both.
- After a stop, the snapshot of `DatLink` has the stream state `STOPPING`, then `STOPPED`. The stream collectors end with the stop, so `DatLink` sets these two states itself.

## The page and the bridge

- The page loads from `https://appassets.androidplatform.net/index.html`. `UiAssetsHandler` serves it from the APK assets: from the folder `ui` when the APK holds `ui/index.html`, else from the folder `placeholder`. A debug build adds `?debug=1`.
- The Gradle task `syncUi` copies `apps/mobile/ui/dist` into the APK as the folder `ui`. It does not run npm. Build the phone UI first: `npm run build --workspace @glance/phone-ui` at the repository root.
- A debug build with `glance.uiDevUrl` loads that address in place of the assets.
- The page sends a message with `window.GlanceNative.postMessage(json)`. The app sends one with `window.__glanceReceive(json)`. `WebBridge` sends nothing before the first `ui.ready`. A page that loads again gets no message until its own `ui.ready`, and the answer to that brings the state, the profile, and the snapshot again.
- A link to another site opens outside the app.
- The text of the page follows the font size of the phone.
- `ProfileStore` keeps the profile, the yes input that the shopper selected, the server session, the server address, the gesture sensitivity, and the placeholder switch in the preferences file `glance`.

## The setup

`MainActivity` and `SessionController` handle the three setup messages of the page.

```mermaid
sequenceDiagram
    participant Page
    participant App as MainActivity and SessionController
    participant Android
    participant Sdk as DAT SDK
    App->>Android: first resume: ask for BLUETOOTH_CONNECT (Android 12 or later)
    Android-->>App: granted or denied
    App->>Sdk: initialize, only if granted
    Page->>App: setup.register
    alt the SDK runs
        App->>Sdk: startRegistration
        Sdk-->>App: registration state, or a registration error
    else Bluetooth is denied
        App->>Android: ask again
        Android-->>App: denied
        App-->>Page: event native.bluetooth_denied
    end
    Page->>App: setup.requestCamera
    App->>Sdk: RequestPermissionContract with CAMERA
    Sdk-->>App: granted, denied, or an error
    Page->>App: setup.openUpdate
    App->>Sdk: openDATGlassesAppUpdate or openFirmwareUpdate
```

- No SDK call runs before the Bluetooth permission. Without it, `registration` is `unavailable`. Mock glasses need no Bluetooth: they keep their registration, and the app does not ask.
- The app asks one time at the first resume. A new activity does not ask again. Android shows its prompt two times at most, and then it denies with no prompt.
- `setup.register` with Bluetooth denied asks again. Each denied answer sends `native.bluetooth_denied`, also the answer of Android with no prompt.
- A registration error `FAILED_TO_REGISTER` or `UNKNOWN` sends `native.registration_failed`. The page reads "no internet" from `network`.
- A camera request that fails sends `native.permission_failed`, but not for a missing Meta AI app: `metaAiInstalled` is false then.
- Each resume reads the camera permission and the microphone permission of the SDK again. The shopper returns from Meta AI through this path.
- The app reads both permissions again when the glasses connect. The SDK answers a permission check only with connected glasses (`PermissionError.NO_DEVICE`, `NO_DEVICE_WITH_CONNECTION`), so a check at the start of the app can fail before the link exists.
- A permission check suspends. If `DatLink.initialize` runs again before the answer arrives, for example at a change between mock glasses and the SDK, the app drops that answer.
- Meta AI opens the app again through the `glance` scheme. `onCreate` and `onNewIntent` give the intent to the SDK, after the SDK started.

## A session

The app holds two sessions. The server session holds the cart. The DAT session holds the camera stream, and a stopped DAT session is final. So one server session can see many DAT sessions: after a rest, a closed hinge, or a lost link.

```mermaid
sequenceDiagram
    participant Page
    participant App as SessionController
    participant Glasses as DatLink
    participant Server
    Page->>App: session.start
    App->>Server: POST /api/sessions, if no session is live
    App->>Server: open the device socket
    Server-->>App: snapshot
    App->>Glasses: startSession
    Glasses-->>App: stream STREAMING
    App->>Server: device.state
    loop each 500 ms
        App->>Server: the sharpest frame as a JPEG
    end
    Server-->>App: event glance.pending, speak with a promptId
    App-->>Page: event
    App->>Server: prompt.done, when the line ended
    Glasses-->>App: gyroscope samples with a nod
    App->>Server: intent yes, source head
    App->>Server: kiosk.seen, when a kiosk code stays in view
    Server-->>App: session.end
    App->>Glasses: stopSession
```

Start checks, in this order. Each failure sends one `error` event to the page and starts nothing.

| Check | Error code |
|---|---|
| The Bluetooth permission is granted, or the glasses are mock glasses | `native.bluetooth_denied` |
| A device is connected | `native.no_device` |
| The glasses are not off the face | `native.not_worn` |
| The server answers `POST /api/sessions` | `native.server_unreachable` |
| The SDK creates the session | `native.sdk_too_old` for `INSUFFICIENT_SDK_VERSION`, else `native.session_failed` |

Rules of `SessionController`:

- A start with a live server session makes no new one. If its socket is down, the app first asks the server for the snapshot. With no answer, a new server session starts.
- `session.rest` of the server stops the DAT session. The socket and the server session stay.
- `session.end` of the server stops the DAT session and marks the server session as not live. The socket closes 5 seconds later, so the last lines still arrive. If the server closes the socket first, the app does not connect again, and it does not say the "Connection lost" line.
- `profile.set` of the page changes the profile only when the result is inside the limits of `packages/shared`: a speech rate from 0.8 to 2, a head window of 8000, 15000, or null, and a budget above 0 or null. The page gets a `profile` message after each `profile.set`, also when nothing changed.
- When a DAT session stops with no request from the app, `StopCauses.classify` names the cause, and the page gets its `error` event. The app reads the cause 500 ms after the stop, because the glasses can report a closed hinge after the stop.
- After a lost link or a closed hinge, a new DAT session starts by itself when the glasses are connected, open, and not off the face. The app waits 2 seconds first, and it stops after 5 such starts in a row with no stream.
- A stream that ends by itself after it ran also ends its DAT session.
- The screen stays on while a DAT session runs, and in pocket mode.
- `haptic` of the page plays the pattern of `HapticPatterns`, if `haptics` of the profile is true. The app never vibrates by itself.
- `pocket.set` on dims the screen to 1 percent and hides the system bars. A swipe from the edge shows them for a short time. `pocket.set` off gives the brightness of the phone again. The page draws the black screen and blocks the touches. A new activity starts with pocket mode off.
- Five seconds after the first `STREAMING`, `MainYesResolver` selects the yes input that works. A change goes to the page and to the server as a profile patch.
- With the socket down for 3 seconds, the phone voice says "Connection lost. Your cart is safe. Glances are paused."
- With the media volume at 0, no line plays, and each prompt is reported at once.
- `FramePipeline` scans each frame for a kiosk code, and selects the sharpest frame of each 500 ms. `FaceFinder` looks for faces in that frame with ML Kit, on the phone. The upload is the center of the frame (80 percent of the width, 70 percent of the height) with each face pixelated, as a JPEG of quality 80 with a long side of 768 pixels at most: 494 x 768 for the stream of 720 x 1280. Its header has `blurred: true`. If face detection fails, the frame is dropped. The app writes no frame to storage.
- `ExoLinePlayer` plays the sound of a line, then its clip. A clip that does not load, that does not start in 3 seconds, or whose address is not an address, is replaced by the phone voice. The speech rate of the profile changes the clip, not the sound.

## The core module

`core` has no Android import and no DAT import.

```mermaid
flowchart LR
    Fixtures[packages/shared/fixtures] -. checked by tests .-> Contract
    Contract[contract: types, GlanceJson, Codec, Profiles]
    Frame[frame: FrameCodec] --> Contract
    Kiosk[kiosk: KioskCode, KioskDwell] --> Contract
    Image[image: Sharpness, SharpestFramePicker, UploadGate, FrameGeometry, Pixelate, FramePrep, I420] --> Contract
    Gesture[gesture: HeadGestureDetector, GyroScript, MotionCsv]
    Audio[audio: SpeechQueue] --> Contract
    Input[input: PromptTracker, HeadInput, MainYesResolver] --> Contract
    Input --> Gesture
    State[state: StateMapper, StopCauses, NativeErrors, ConnectionAnnouncer, Revival, HapticPatterns] --> Contract
    Net[net: GlanceApi, DeviceSocket, Backoff] --> Contract
    Net --> Frame
    BridgeText[bridge: Bridge] --> Contract
```

| Package | Content |
|---|---|
| `contract` | The Kotlin mirror of `packages/shared`: one file for each TypeScript file, with the same type names and field names. `GlanceJson` is the one JSON format. `Codec` encodes and decodes the messages, and returns null for a message that it does not know. `Profiles.applyPatch` sets the keys of a profile patch, and changes nothing for a patch that does not decode or that leaves the limits of `ProfileSchema`. |
| `frame` | `FrameCodec` builds and reads the binary frame message: a 4-byte header length, the JSON header, the JPEG. |
| `kiosk` | `KioskCode` parses the QR text `GL1 <code>`. `KioskDwell` reports a kiosk code after 1500 ms in view, then one time each second. |
| `image` | `Sharpness` and `SharpestFramePicker` select the sharpest frame of each 500 ms. `UploadGate` gives the reason to skip an upload. `FrameGeometry` and `FramePrep` crop and scale a frame to a long side of 768 pixels at most. `FrameGeometry.mapBox` maps a face box into the output and never makes it smaller. `Pixelate` covers a box that is 20 percent larger on each side with blocks of one color. A block has one sixth of the box width, and 8 pixels at least. `I420.cropScaleToArgb` converts with BT.709 limited range. |
| `gesture` | `HeadGestureDetector` finds a nod and a shake in gyroscope samples. `HeadGestureConfig.of` gives the limits of the levels `GENTLE`, `NORMAL`, and `FIRM`. `GyroScript` builds samples of head movements for tests and for mock glasses. |
| `audio` | `SpeechQueue` plays one line at a time through a `LinePlayer`, with interrupt and priority. It reports each prompt whose line ended. A line with no clip uses the phone voice. |
| `input` | `PromptTracker` follows the prompts of the server. `HeadInput` turns a gesture into a yes or a no while the head window of a prompt is open. `MainYesResolver` selects the yes input that works. |
| `state` | `StateMapper` maps the state of the DAT SDK to `NativeState` and `DeviceState`. `StopCauses` names the cause of a stopped session, and says if a new session starts by itself. `NativeErrors` holds the `error` events of the phone, with codes that start with `native.`. `ConnectionAnnouncer` gives the "Connection lost" line after 3 seconds without the socket. `Revival` limits the restarts of a capability. `HapticPatterns` holds the vibration timings of the 8 haptic patterns. |
| `net` | `GlanceApi` makes the REST calls. It puts the socket address and each clip address of the server on the server address of the app. A server address that is not an HTTP address fails each call with an `IOException`, like a server that does not answer. `DeviceSocket` sends messages and frames, and connects again after 500, 1000, 2000, 4000, and 8000 ms. A message never waits for a later connection. |
| `bridge` | `Bridge` builds the JavaScript call that gives a message to the page, and knows the MIME types of the page files. |

The detector cuts the angle of each axis into strokes. A nod is a stroke down and a stroke back up to the start, then quiet. A shake is two strokes to opposite sides.

### Tests of the contract

`FixturesTest` reads each file of `packages/shared/fixtures` and compares it with the Kotlin types. The Gradle build gives the folder to the test as the system property `glance.fixtures`. A new message variant in `packages/shared` needs its Kotlin class, or this test fails on the fixture count.

`MotionReplayTest` replays each motion recording in `core/src/test/resources/motion`. A file name ends with `__nod<n>_shake<n>.csv`, and the test expects these counts. The folder is empty until the probe run on the glasses.

### Test against the real server

`ServerSpineTest` in `core/src/integrationTest` plays one shop against the server of `apps/server` in fake mode, with the real `GlanceApi`, `DeviceSocket`, and codecs. It needs a server, so `./gradlew test` and `./gradlew check` do not run it. `node scripts/integration/server-kotlin.mjs` at the repository root starts the server, runs the test, and stops the server. `scripts/integration/README.md` lists the steps of the test.

## The probe

Open "Glance Probe" on the phone. The text field above the buttons gives the label of a saved frame and of a motion recording.

| Button | Action |
|---|---|
| `Bluetooth permission` | Asks for `BLUETOOTH_CONNECT`, then starts the DAT SDK |
| `Register` | Starts the registration in the Meta AI app |
| `Camera permission`, `Mic permission` | Asks for the DAT permission in the Meta AI app |
| `Start session`, `Start session (no camera)`, `Stop session` | Starts a session with or without the stream at 720 x 1280 and 7 frames per second, or stops it |
| `Save frame` | Saves the next frame as `probe/frames/<label>-<nn>.jpg` |
| `QR log` | Logs each QR code in the stream, at most 2 lines each second |
| `Motion`, `Inputs`, `Speech` | Adds the capability to the session. `Speech` needs the microphone permission. |
| `Speak line` | Speaks one product line with `PhoneVoice`. Logs the audio outputs, and the frame size before and after the line. |
| `Axis test` | Reads the gyroscope for 4 seconds. Logs the RMS rate of each axis, the strongest axis, and the sign of its first movement. |
| `Gesture test` | Runs the head gesture detector on the gyroscope with no head window. Logs each nod and each shake with a count. |
| `Still` | Takes a photo. Logs its size, its variant, and the time. |
| `Pipeline test` | Runs `FramePipeline` on the stream and sends nothing. Logs `upload seq=<n> <w>x<h> <bytes> bytes` and `kiosk <text>`. |
| `Play test line` | Plays the `found` sound, then `<server address>/clip.wav` of the fake server. Logs `line ended`. |
| `Play bad clip` | The same line with a clip that does not exist. The phone voice says "Test line." |
| `Record motion` | Appends each motion sample to `probe/motion/<label>.csv`, in the CSV format of MockDeviceKit |
| `Endurance 10 min` | Speaks the line each 30 seconds. Logs battery, thermal level, frame count, frame size, and motion sample count each minute. |
| `Mock: enable and pair` | Enables MockDeviceKit and pairs mock glasses that are on, open, and on the face |
| `Mock: enable, not registered` | Starts MockDeviceKit with no registration and pairs mock glasses. `Register` then registers. |
| `Mock: deny camera` | Sets the camera permission of the mock glasses to denied, also for the next request |
| `Mock: phone camera` | Uses the back camera of the phone as the stream of the mock glasses |
| `Mock: motion` | Feeds 60 samples with a gyroscope rate of 1 rad/s on the x axis, in a loop |
| `Mock: nod` | Feeds one nod of 15 degrees each 4 seconds, in a loop |
| `Use placeholder page` | Makes "Glance" show the placeholder page, also when the APK holds the phone UI. Close "Glance" and open it again. |
| `Mock: double tap`, `Mock: swipe` | Sends a select event and a navigation event from the touchpad |
| `Mock: say add` | Sends the final transcript "add" |
| `Mock: still image` | Uses the newest saved frame as the next photo |
| `Mock: disable` | Stops the session and disables MockDeviceKit |

The probe folder on the phone is `/sdcard/Android/data/com.metaglance.android/files/probe`. Get it with `adb pull` in PowerShell.

The second tap on `QR log`, `Gesture test`, `Pipeline test`, `Record motion`, or `Endurance 10 min` stops it.

## Mock mode for seats without glasses

Mock mode runs the app with the mock glasses of MockDeviceKit. It needs no glasses, no Meta AI app, and no Bluetooth permission. It is in each build, because it is the fallback of the live demo.

1. Start a server. See "The fake server", or use `npm run dev:fake --workspace @glance/server` at the repository root.
2. Open "Glance Mock" on the phone. Tap `Enable (registered)`, then `Pair`.
3. Tap `Phone camera` and allow the camera. The back camera of the phone is the camera of the mock glasses then.
4. Type the address of the server in the field `Server URL` and tap `Save server URL`. An empty field gives the address of the build again.
5. Open "Glance" and start a session on the page. The placeholder page has the button `session.start`.

The top line of the menu shows `NativeState` and `DeviceState` as JSON, live. The line below it shows the result of the last item. The menu has a task of its own, so "Glance" keeps its page when you change between both.

| Group | Items |
|---|---|
| Mode | `Enable (registered)`, `Enable (not registered)`, `Disable`. Each one stops a running session first, and removes the forced values. |
| Glasses | `Pair`, `Power on`, `Power off`, `Don`, `Doff`, `Fold`, `Unfold` |
| Camera | `Phone camera`. `Still image`: select an image for the next still photo. |
| State | `Battery 100`, `20`, `10`, `3`. `Thermal none`, `severe`, `critical`. |
| Touchpad | `Tap` (pause and resume), `Tap and hold` (stop), `Double tap`, `Swipe` |
| Registration | `Next registration fails`, `Next registration works`. `Camera: deny`, `Camera: allow`. |
| Motion | `Replay nod`, `Replay shake`: head movements of `GyroScript`, one time. `Replay CSV file`: select a motion recording. |
| Speech | `Say add`, `Say skip`: a final transcript |
| Force | `Meta AI missing`, `Update required`, `Stream error BATTERY_LOW`, `Stream error THERMAL_HOT`. MockDeviceKit has no call for these states, so the debug hooks of `DatLink` make them. |
| App | `Server URL`. `Drop server link 10 s`: the socket closes and connects again after 10 seconds. `Sensitivity: gentle, normal, firm` for the head gestures. `Use placeholder page`. |

The states of the app, and the items that make each one:

| State | Items | Result |
|---|---|---|
| Meta AI app missing | `Meta AI missing` | `metaAiInstalled` is false |
| Not registered | `Enable (not registered)`, `Pair` | `registration` is `unavailable`, and no device shows. `setup.register` gives `registered` and the device. |
| Registration fails | `Next registration fails`, then `setup.register` | Event `native.registration_failed` |
| Camera permission denied | `Camera: deny` | `cameraPermission` is `denied` |
| Glasses not found | `Power off` | No device, or `link` is `disconnected`. `session.start` sends `native.no_device`. |
| Update required | `Update required` | `device.updateRequired` is true |
| Paused | `Tap` in a session | `paused`, and no frame goes out. `Tap` again resumes the same session. |
| Stopped by the device | `Tap and hold` | Event `native.stopped_by_device`. Only `session.start` starts a new session. |
| Hinge closed | `Fold`, then `Unfold` and `Don` | Event `native.hinge_closed`. A new session starts by itself, with the same cart. |
| Link lost | `Power off` in a session, then `Power on`, `Unfold`, `Don` | Event `native.link_lost`. A new session starts by itself. |
| Off the face | `Doff` | `device.worn` is false, and no frame goes out. `session.start` sends `native.not_worn`. |
| Battery too low | `Battery 3`, `Stream error BATTERY_LOW` | The session stops. Event `native.battery_low`. |
| Too warm | `Thermal critical`, `Stream error THERMAL_HOT` | The session stops. Event `native.too_warm`. |
| Server not reachable | `Drop server link 10 s` | `network` is `offline`. After 3 seconds the phone voice says the "Connection lost" line. |

## The fake server

`tools/fake-server` stands in for the Glance server. It holds one session and no cart logic, and it reads its messages from `packages/shared/fixtures`.

| Command, in `tools/fake-server` | Result |
|---|---|
| `npm install` | Installs `ws` |
| `node server.mjs` | Starts the server on port 8080. `PORT` sets the port, and `HOST` sets the address (default `0.0.0.0`). |
| `SAVE_FRAMES=1 node server.mjs` | Also writes the newest frame to `<temp folder>/glance-last.jpg` |
| `npm test` | Plays one shop against the server on `127.0.0.1` and a free port |

What it does:

- `POST /api/sessions` gives the session `s-1`. `GET /clip.wav` gives a tone of 1 second.
- The first `device.state` with the stream `streaming` gives the "Camera on" line.
- A product prompt comes 3 seconds after the first frame, then each 15 seconds while frames arrive. A product prompt with no answer ends with `glance.cleared` when the next one comes.
- A yes on the product prompt gives `glance.cleared`, the "Added" line, and `cart.updated`. A no gives `glance.cleared` and "Skipped."
- `kiosk.seen` gives a pay prompt. A yes on it gives `checkout.paid`, the "Paid" line, and `session.end`.
- A yes or a no with another prompt ID logs `rejected`.
- Type a command and press Enter: `rest` (`session.rest`), `bio` (`biometric.request`), `amb` (`glance.ambiguous`), `badclip` (a prompt with a clip that does not exist), `drop` (closes the socket and refuses a new one for 10 seconds).

A phone on USB reaches the server with `adb -s <serial> reverse tcp:8080 tcp:8080` and `glance.serverUrl=http://127.0.0.1:8080`.

## Instrumented tests

`app/src/androidTest` holds tests that run on a phone with mock glasses of MockDeviceKit. They follow the DAT guide "Android testing with Mock Device Kit" (https://wearables.developer.meta.com/docs/develop/dat/testing-mdk-android). No test needs the glasses, the Meta AI app, or a vendor.

```mermaid
flowchart LR
    Runner[run-spine.mjs on the laptop] -->|starts with fake recognition and fake speech| Server[apps/server on port 8080]
    Runner -->|adb reverse, install, am instrument| Tests[Tests in the app process]
    Tests --> App[SessionController, DatLink, the pages]
    Tests --> Kit[MockDeviceKit: glasses, video file, motion samples]
    Kit --> App
    App <-->|127.0.0.1:8080 through USB| Server
```

| Class | What it checks |
|---|---|
| `SpineTest` | One shop: the stream starts, frames go out, the product prompt arrives, `prompt.done` goes out, a mock nod adds the product, and the server snapshot holds one item. Then the mock glasses fold and open, the app starts a new DAT session by itself, the kiosk code gives `kiosk.seen`, a mock nod pays, the phase is `paid`, and the DAT session stops. A start after the payment gets a new server session. |
| `ProbeLinkTest` | `DatLink` with mock glasses: the paired device, the stream, the colors of a frame, the kiosk code in a frame, a stop and a new start, and six stops at the start of a stream. |
| `ProbeScreenTest` | The probe screen: each test taps the buttons and reads the log, for the stream, the saved frame, `QR log`, `Pipeline test`, Motion, Inputs, Speech, `Speak line`, `Still`, `Record motion`, and `Play bad clip`. |
| `PlaceholderPageTest` | The placeholder page in the WebView: state and profile, a stored profile patch, a page that loads again, and `Add` and `Skip` on a product prompt. |
| `SetupFlowTest` | The setup messages with mock glasses: a registration, a registration that fails, a denied and an allowed camera request, the permissions after a resume, and the permissions when the glasses connect after the start. |
| `BluetoothPromptTest` | The Bluetooth prompt of Android: the test denies it, the app does not stop, and `setup.register` asks again and sends `native.bluetooth_denied`. At its end the test clears the flags of the permission. |
| `DeviceStatesTest` | The states of the table in "Mock mode for seats without glasses": `NativeState`, the `error` events, and the `device.state` messages for each one. One test pays at a kiosk that declines each payment: `checkout.failed` and its line arrive, the cart stays, and the camera stays on. |
| `MockMenuTest` | The mock menu: each item of the plan exists, the top line follows the mock glasses, and the App items change the stored settings. |
| `HapticsPocketTest` | The 8 haptic buttons of the placeholder page give the 8 patterns, `haptics: false` gives none, and pocket mode dims the screen, hides the bars, and keeps the screen on. |
| `FaceFinderTest` | ML Kit face detection runs on the phone, and an image with no face gives an empty list. |
| `PhoneUiPageTest` | The phone UI in the WebView. The setup test clicks through the three steps: link the glasses, a denied and then an allowed camera, and the start, which opens the session screen. The card test reads the product card of a prompt and the cart after `Add`. Both are skipped for an APK with no build of the phone UI. The setup test is skipped for a phone UI with no setup screen. |

`SpineTest`, `DeviceStatesTest`, `PhoneUiPageTest`, and the prompt tests of `PlaceholderPageTest` need the server of `apps/server` with both fake switches at `BuildConfig.SERVER_URL`. They read `GET /healthz` first, and they fail if recognition or speech is real.

Run them with the script, in `scripts/integration`. It needs `adb`, FFmpeg, and the JDK on `PATH`.

| Command | Result |
|---|---|
| `npm install` | Installs `qrcode`, one time |
| `node android/run-spine.mjs` | Starts the fake server, sets `adb reverse`, builds the phone UI, builds and installs both APK files, and runs the suite `spine`. Then it removes the reverse and stops the server. |
| `node android/run-spine.mjs --integration` | Runs the three suites, each with a new server: `spine` (`SpineTest`), `state` (`DeviceStatesTest`, `SetupFlowTest`), and `page` (`PhoneUiPageTest`) |
| `node android/run-spine.mjs --suite state` | Runs one suite. A list takes commas: `--suite state,page`. |
| `node android/run-spine.mjs --runs 3` | Runs each selected suite three times, each time with a new server |
| `node android/run-spine.mjs --all` | Runs each test class |
| `node android/run-spine.mjs --class com.metaglance.android.ProbeScreenTest` | Runs one class. `Class#method` runs one test. |
| `node android/run-spine.mjs --no-build` | Uses the APK files of the last build |
| `node android/make-clips.mjs --force` | Makes the camera feeds again: `scene.mp4`, `kiosk.mp4`, and `scene.png` in `app/src/androidTest/assets`. The files are in git. |

Rules of the script and of the tests:

- The script uses the phone with the serial `P11262000912` only, and each `adb` call names it. Change `SERIAL` in `run-spine.mjs` for another phone.
- The script ends with status 2 when the phone is locked or not attached. It does not unlock the phone.
- The script prints one line for each test: `ok`, `FAIL`, or `skip` with the cause. It ends with status 0 when each test passed, with 1 after a failure, and with 3 when no test failed and a test was skipped.
- The build step runs `npm run build --workspace @glance/phone-ui` first, because Gradle copies `apps/mobile/ui/dist` into the APK and does not run npm. With `--no-build` the APK keeps the phone UI of its last build.
- For `DeviceStatesTest`, the script registers a kiosk with `failPayment: true` at each new server. The server gives that kiosk a random code, so the script makes a clip with that code and writes it into the cache folder of the app with `adb exec-in run-as`. The test gets the code and the file name as the instrumentation arguments `failKioskText` and `failKioskClip`. Without them the test of the failed payment is skipped. The script deletes the clip after the run.
- The script reads the media volume. If it is not 0, it prints the old value and sets 0. Each test class fails at its start when the volume is not 0, because the phone voice speaks each line that has no clip.
- The server gets no vendor key, and it plays `scripts/integration/android/spine-script.json`: the product `oat-drink-1l` from second 8 to second 10 after the socket of a session opens.
- The script installs with no `-g`, and no test grants `BLUETOOTH_CONNECT`. Without that permission the app never starts the real SDK, and mock glasses need no Bluetooth. A feed from a video file needs no camera permission.
- The log of each server is in `<temp folder>/glance-integration`.
- The tests run with `GlanceTestRunner`. It stops the Bluetooth prompt at the start of "Glance", and it takes each vibration in place of the phone. So the phone stays quiet, and no prompt waits for a tap. `BluetoothPromptTest` turns the prompt on for itself and taps its deny button.
- No test sends `setup.openUpdate`, because the SDK opens the Meta AI app for it.
- No test image holds a face. Check the pixelated face by hand: start the fake server with `SAVE_FRAMES=1`, point the mock camera at a photo of a face, and open `glance-last.jpg` in the temp folder.
- On a phone with no network of its own, `network` stays `offline`. `DeviceStatesTest` then checks the dropped server link in the frames, the line, and the messages only.

Facts about MockDeviceKit that the tests found (DAT 1.0.1, Nothing Phone (1), Android 15):

- `setCameraFeed(fileUri)` takes effect at the next stream start. A running stream keeps its feed, and it plays the file again from its start when the file ends.
- A feed from a video file gives 30 frames each second, also for a file with 15 and a stream configuration with 7.
- `fold()` reports `DOFFED`, then the session error `SESSION_ENDED_BY_DEVICE` and `STOPPED`, and the closed hinge after them.
- With `initiallyRegistered = false`, the registration state is `UNAVAILABLE`, not `AVAILABLE`, and the paired mock glasses are not visible. `startRegistration` gives `REGISTERED` at once, with no `REGISTERING` state, and then the glasses show.
- After `simulateRegistrationOutcome(false)`, `startRegistration` reports the error `FAILED_TO_REGISTER`.
- `captouch.tap()` pauses a running session, and no frame arrives while it is paused. A second tap resumes the same session: its state goes from `PAUSED` to `STARTED` again.
- `doff()` in a session reports `DOFFED`, and `don()` gives frames again with no tap.
- `setMotionFeed(samples, loop = false)` on a running Motion capability plays the samples one time from their start.
- With no network on the phone, the page shows `network: offline` also when the socket through `adb reverse` is open, because the phone reports no active network.

## The sounds

`node tools/make-sounds.mjs` writes `found.wav`, `added.wav`, `removed.wav`, `warning.wav`, and `paid.wav` to `app/src/main/res/raw`. The files are in git. Run the script only to change a sound.

## Machine needs

- A JDK from 17 to 24. Gradle 8.14.1 does not run on JDK 25 or later.
- The Android SDK with Platform 36. Set `ANDROID_HOME` to its folder, or write `sdk.dir` in `local.properties`.
- A phone or an emulator with Android 10 or later, for the install only.

## Build commands

Run each command in `apps/mobile/android`. PowerShell uses `.\gradlew.bat` in place of `./gradlew`.

| Command | Result |
|---|---|
| `./gradlew --version` | Prints the JVM that Gradle uses |
| `./gradlew ktlintFormat` | Formats the Kotlin files |
| `./gradlew ktlintCheck` | Checks the Kotlin style. The pre-commit hook of the repository runs it. |
| `./gradlew :core:test` | Runs the unit tests of `core` |
| `./gradlew :core:test --tests "*gesture*"` | Runs the tests of one package |
| `./gradlew test` | Runs each unit test task. `app` has no unit test. |
| `./gradlew :core:integrationTest -Pglance.serverUrl=<address>` | Runs the tests of `core/src/integrationTest` against a running Glance server. No other task runs them. |
| `./gradlew :app:assembleDebug` | Builds `app/build/outputs/apk/debug/app-debug.apk` |
| `./gradlew :app:installDebug` | Installs the debug build on each attached phone |
| `./gradlew :app:assembleDebugAndroidTest` | Builds the test APK `app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk` |
| `./gradlew :app:assembleDebug -Pglance.serverUrl=http://127.0.0.1:8080` | Builds with another server address. A Gradle property wins over `local.properties`. |
| `./gradlew :core:test :app:assembleDemo` | Builds the signed demo APK `app/build/outputs/apk/demo/app-demo.apk`. See "The demo build". |

Run `ktlintFormat` and `ktlintCheck` as two commands. In one command, the check can read a file before the format task writes it.

## The demo build

The build type `demo` is the APK for the testers. It is not debuggable, it has no probe screen, and it allows no address without TLS, because both are in `app/src/debug`. It has mock mode.

1. Make the keystore one time, in `apps/mobile/android/app`. `keytool` is in the `bin` folder of the JDK. It asks for the password.

   ```bash
   keytool -genkeypair -v -keystore glance-demo.jks -alias glance-demo -keyalg RSA -keysize 2048 -validity 3650 -dname "CN=Meta Glance Demo"
   ```

2. Write `glance.demoStorePassword`, `glance.demoKeyPassword`, and `glance.serverUrl` with the HTTPS address of the server in `local.properties`. Git ignores `local.properties` and each `*.jks` file. Never commit them.
3. Build the phone UI at the repository root: `npm run build --workspace @glance/phone-ui`.
4. Build the APK: `./gradlew :core:test :app:assembleDemo`.
5. Check it. `apksigner` and `aapt2` are in `build-tools` of the Android SDK.

| Command | Expected |
|---|---|
| `apksigner verify --print-certs app/build/outputs/apk/demo/app-demo.apk` | `Signer #1 certificate DN: CN=Meta Glance Demo` |
| `unzip -l app/build/outputs/apk/demo/app-demo.apk` | The list has `assets/ui/index.html` |
| `aapt2 dump badging app/build/outputs/apk/demo/app-demo.apk` | Two `launchable-activity` lines: `MainActivity` and `MockMenuActivity`. No `application-debuggable` line. |

Give the keystore and its password to one other team member. An update with another key needs an uninstall first, and so does a change from the debug build to the demo build.

## Keys of `local.properties`

Git ignores `local.properties`. Each key is optional, and each one is also a Gradle property: `-P<key>=<value>`.

| Key | Default | Use |
|---|---|---|
| `mwdat_application_id` | `0` | DAT application ID. `0` is Developer Mode. |
| `mwdat_client_token` | `0` | DAT client token. `0` is Developer Mode. |
| `glance.serverUrl` | `http://10.0.2.2:8080` | Address of the Glance server, as `BuildConfig.SERVER_URL` |
| `glance.uiDevUrl` | empty | Address of the dev server of the phone UI, as `BuildConfig.UI_DEV_URL` |
| `glance.demoStoreFile` | `glance-demo.jks` | The keystore of the demo build, as a path from the folder `app` |
| `glance.demoStorePassword` | empty | The password of the keystore |
| `glance.demoKeyAlias` | `glance-demo` | The name of the key in the keystore |
| `glance.demoKeyPassword` | empty | The password of the key |

## Notes

- JDK: a terminal outside Android Studio needs `JAVA_HOME`. With Android Studio, its JDK is in `C:\Program Files\Android\Android Studio\jbr`. If `./gradlew --version` prints JVM 25 or later, select a JDK 21.
- `adb`: run each `adb` command that names a device path in PowerShell. Git Bash rewrites `/sdcard/...` to a Windows path.
- More than one phone: set `ANDROID_SERIAL` to the serial of the test phone, and pass `-s <serial>` to `adb`. Without it, `installDebug` installs on each attached phone.
