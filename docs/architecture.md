# Architecture

This file describes the parts of Meta Glance that exist and work on the branch `feat/overnight-build`. The design, with the parts that do not exist yet, is in `docs/superpowers/specs/2026-11-13-meta-glance-design.md`.

Each name in this file is a name in the code. Each message type is a schema in `packages/shared/src`.

## Parts

```mermaid
flowchart LR
  glasses["Glasses, or mock glasses"]
  gemini["Gemini"]
  eleven["ElevenLabs"]

  subgraph phone["Phone"]
    app["Android app: apps/mobile/android"]
    page["Phone UI in the WebView: apps/mobile/ui"]
  end

  subgraph server["Server: apps/server"]
    socket["Device socket: /ws/device"]
    rest["REST paths and event streams: /api"]
    runtime["SessionRuntime with the rules in step"]
    recognition["RecognitionWorker, or ScriptPlayer in fake mode"]
    speech["Speech clips: ClipCache"]
    kiosks["KioskService and the mock payment"]
    bus["EventBus"]
    store["Store: MemoryStore or MongoStore"]
  end

  browser["Phone UI in a browser: BrowserBridge"]
  kioskPage["Kiosk page: apps/website, /kiosk"]
  mirror["Mirror page: apps/website, /mirror"]
  static["Landing page and privacy page: apps/website"]
  hud["Display HUD mockup: apps/display-pow"]

  glasses -- "frames, gyroscope samples, device state" --> app
  page -- "PageToNative" --> app
  app -- "NativeToPage" --> page
  app -- "DeviceToServer, binary frames" --> socket
  socket -- "ServerToDevice" --> app
  app -- "session calls, speech clips" --> rest
  browser -- "session calls" --> rest
  rest -- "ServerEvent stream" --> browser
  kioskPage -- "POST /api/kiosks" --> rest
  rest -- "KioskEvent stream" --> kioskPage
  mirror -- "newest session call, snapshot call, speech clips" --> rest
  rest -- "ServerEvent stream" --> mirror
  hud -- "snapshot call, intent with the source hud" --> rest
  rest -- "ServerEvent stream" --> hud

  socket -- "frames" --> recognition
  recognition -- "one JPEG for each call" --> gemini
  recognition -- "recognition result" --> runtime
  runtime -- "a question with the data of one product" --> gemini
  socket -- "intent, prompt.done, device.state, cart.edit, profile.set, question, biometric.result" --> runtime
  rest -- "intent, cart.edit, profile.set" --> runtime
  socket -- "kiosk.seen" --> kiosks
  kiosks -- "kiosk.seen with the kiosk, payment.result" --> runtime
  runtime -- "payment.start" --> kiosks
  runtime -- "text of a line" --> speech
  speech -- "text of a new line" --> eleven
  runtime -- "speak, session.rest, session.end, biometric.request" --> socket
  runtime -- "ServerEvent, caption" --> bus
  kiosks -- "KioskEvent" --> bus
  bus --> socket
  bus --> rest
  runtime --> store
  kiosks --> store
  speech --> store
```

| Part | Folder | Task |
|---|---|---|
| Contract | `packages/shared` | Each message type as a zod schema, one JSON fixture for each message variant, `TIMING`, the frame codec, and the kiosk code helpers. |
| Android app | `apps/mobile/android` | Connects to the glasses through the DAT SDK, sends frames and answers to the server, plays the lines, and hosts the phone UI. |
| Phone UI | `apps/mobile/ui` | The setup screen links the glasses. The session screen shows the current prompt, the last lines as text, the cart, the pay prompt, the receipt, and the settings. It has no network code: each message goes through a `GlanceBridge`. |
| Server | `apps/server` | Recognizes the product in a frame, runs the cart rules, writes the spoken lines, answers a question about a product, and runs the checkout with a mock payment. |
| Website | `apps/website` | The kiosk page shows the code that starts a checkout, and then the cart and the result. The mirror page shows the spoken lines and the cart of one session, and plays the speech clips. The landing page and the privacy page show fixed text and make no call to the server. |
| Display HUD | `apps/display-pow` | A mockup of the screen for glasses with a display. It shows the pending product, the total, and the last line of one session, and it sends a yes or a no. Without a session it plays a recording. |

Facts that the diagram does not show:

- The server is the only part that changes a cart or computes a total. Each price comes from the catalog of the server.
- The Android app has its own Kotlin classes for the messages, in `apps/mobile/android/core/src/main/kotlin/com/metaglance/core/contract`. A Kotlin test decodes each fixture of `packages/shared/fixtures`.
- The phone UI uses `AndroidBridge` in the WebView and `BrowserBridge` in each other browser. With the query flag `api`, `BrowserBridge` talks to the server with REST calls and the event stream. A session then needs no phone.
- With `FAKE_RECOGNITION`, the server makes no Gemini call. A `ScriptPlayer` gives the rules the results and the kiosk sightings of a script file.
- With `FAKE_SPEECH`, the server makes no ElevenLabs call. Each line has `url: null`, and the phone reads the text with its own voice.
- Mock glasses are MockDeviceKit of the DAT SDK. The app uses them through `MockGlassesController`.
- The `EventBus` has one topic for each session and one topic for each kiosk. It delivers inside the server process only.
- The server checks a token on the device socket and on each path with a session ID. The events stream of a kiosk needs the token of the kiosk. A missing or wrong token gets 401.
- The server sends two `error` events: `kiosk.busy` for a kiosk that another session holds, and `recognition.slow` after 3 failed recognition calls in a row, which never comes in fake mode. Each other `error` event comes from the Android app, with a code that starts with `native.`.

### Messages

| From | To | Channel | Type |
|---|---|---|---|
| Page | Android app | `window.GlanceNative.postMessage(json)` | `PageToNative` |
| Android app | Page | `window.__glanceReceive(json)` | `NativeToPage` |
| Android app | Server | Text message on the device socket | `DeviceToServer` |
| Android app | Server | Binary message on the device socket | A frame: 4 bytes with the header length, a `FrameHeader` as JSON, and a JPEG |
| Server | Android app | Text message on the device socket | `ServerToDevice` |
| Android app, browser | Server | `POST /api/sessions` | `CreateSessionRequest`, answer `CreateSessionResponse` |
| Android app, browser, mirror page, Display HUD | Server | `GET /api/sessions/:id` | Answer `SessionSnapshot` |
| Browser, Display HUD | Server | `POST /api/sessions/:id/intents` | `WebIntentRequest` |
| Browser | Server | `POST /api/sessions/:id/cart` | `CartEditRequest` |
| Browser | Server | `PATCH /api/sessions/:id/profile` | `ProfilePatch`, answer `Profile` |
| Android app, browser | Server | `DELETE /api/sessions/:id` | No body |
| Server | Browser, mirror page, Display HUD | `GET /api/sessions/:id/events` | A stream of `ServerEvent` |
| Mirror page | Server | `GET /api/demo/latest` | Answer `LatestSessionResponse`: the ID and the token of the newest live session |
| Kiosk page | Server | `POST /api/kiosks` | `CreateKioskRequest`, answer `CreateKioskResponse` |
| Server | Kiosk page | `GET /api/kiosks/:id/events` | A stream of `KioskEvent` |
| Android app, mirror page | Server | `GET /api/speech/<hash>.mp3` | Answer: the MP3 of a line |

The device socket carries each `ServerEvent` of its session inside the `ServerToDevice` message `event`. The Android app passes it to the page inside the `NativeToPage` message `event`.

## One glance, from the frame to the cart

The diagram shows a server with real recognition and real speech. The shopper looks at a product that is not in the cart, and answers the prompt with a nod.

```mermaid
sequenceDiagram
  participant Glasses
  participant App as Android app
  participant Page as Phone UI
  participant Socket as Device socket
  participant Worker as RecognitionWorker
  participant Gemini
  participant Runtime as SessionRuntime
  participant Clips as Speech clips

  Glasses->>App: video frames
  Note over App: FramePipeline selects the sharpest frame of each 500 ms
  App->>Socket: binary frame with FrameHeader and JPEG
  Socket->>Worker: submit(frame)
  Worker->>Gemini: generateContent with the JPEG and the exclude line
  Gemini-->>Worker: JSON answer
  Note over Worker: normalizeResult checks the answer
  Worker->>Runtime: dispatch(recognition, status identified)
  Note over Runtime: step makes the prompt p-0001 (R1)
  Runtime->>Socket: event glance.pending, through the EventBus
  Socket->>App: event glance.pending
  App->>Page: event glance.pending
  Note over Page: PromptCard shows the product
  Runtime->>Clips: text of the line
  Clips-->>Runtime: address of the clip, or null
  Runtime->>Socket: speak with promptId p-0001
  Socket->>App: speak with promptId p-0001
  Runtime->>Socket: event caption, through the EventBus
  Note over App: SpeechQueue plays the line
  App->>Socket: prompt.done p-0001
  Socket->>Runtime: dispatch(prompt.done)
  Note over Runtime: the head window of the prompt starts (R4)
  Glasses->>App: gyroscope samples with a nod
  Note over App: HeadInput finds the nod in the head window
  App->>Socket: intent yes, source head, promptId p-0001
  Socket->>Runtime: dispatch(intent)
  Note over Runtime: step accepts the yes and adds one unit (R3, R4, R7)
  Runtime->>Socket: events glance.cleared and cart.updated
  Socket->>App: events glance.cleared and cart.updated
  App->>Page: events glance.cleared and cart.updated
  Note over Page: CartList shows the cart and the total of the server
  Runtime->>Socket: speak "Added ..." with the sound added
  Socket->>App: speak
```

Rules of this path:

- The phone uploads one frame each 500 ms at most. The JPEG has the quality 80 and a long side of 768 pixels at most. It is the center of the camera frame (80 percent of the width, 70 percent of the height), and the phone pixelates each face in it before the upload.
- The upload stops while the socket is down, while an earlier frame is not sent yet, and while the glasses are off the face.
- The recognition worker runs one call at a time for each session. While a call runs, the newest frame waits, and a call that takes 4 seconds is dropped.
- Results for one product inside 3 seconds belong to one appearance, and one appearance gets one prompt.
- `glance.pending` and the glance line carry the allergen and diet warnings of the product for the profile of the session. A line with a warning has the sound `warning`. No message says that a product is safe.
- A yes from the head counts only with the ID of the current prompt, after `prompt.done`, with the product in view, and inside the head window of the profile. The default is 8 seconds.
- A yes from the page carries the ID of the prompt on its card and needs no `prompt.done`. In the WebView the app sends it as an intent with the source `phone`. In a browser it is a `POST /api/sessions/:id/intents` call.
- The server writes each line in the language of the profile, English or Italian. `speak` and `caption` carry that language as `lang`. A profile patch with a new language gives `cart.updated` with each cart name in that language.
- The runtime sends the lines in the order of the rules. A line waits for its clip, and a clip that fails gives `url: null`.
- After each step with an event, the runtime writes the session to the store.
- In fake mode no frame goes to a worker. The server decodes each frame, logs it, and drops it. The `ScriptPlayer` dispatches the recognition results.

A result with the status `ambiguous` gives no prompt. The server sends the event `glance.ambiguous` with the candidates and speaks "I cannot tell which oat drink this is. Turn the front to me." If the pending product is one of the candidates, `glance.cleared` comes first, so a yes cannot add it.

The Android app takes a still photo after each `glance.ambiguous`. The contract has no message that asks for a still, so the event is the signal for the phone. With `SECOND_LOOK_WAIT_MS` above 0 on the server, the look-alike line waits for the result of that still. The default is 0: the line plays at once, and the result of a still counts as the result of a stream frame. The diagram shows a server with a wait.

```mermaid
sequenceDiagram
  participant App as Android app
  participant Socket as Device socket
  participant Worker as RecognitionWorker
  participant Gemini
  participant Runtime as SessionRuntime

  Worker->>Runtime: dispatch(recognition, status ambiguous)
  Runtime->>Socket: event glance.ambiguous, through the EventBus
  Note over Runtime: the look-alike line waits in heldAmbiguous
  Socket->>App: event glance.ambiguous
  Note over App: takes a still
  App->>Socket: binary frame with kind still
  Socket->>Worker: submit(frame), in the slot for a still
  Worker->>Gemini: generateContent at the default media resolution
  Gemini-->>Worker: JSON answer
  Worker->>Runtime: dispatch(recognition, still true)
  alt status identified
    Runtime->>Socket: event glance.pending, speak the glance line
  else each other status, or no result inside the wait
    Runtime->>Socket: speak the look-alike line
  end
```

The other answers use the same messages. A no on a new product skips it, and recognition excludes it for 10 seconds. A no in the 8 seconds after an add removes that unit. When an add takes the total over the budget of the profile, the event `budget.exceeded` follows `cart.updated`, and the added line has the sound `warning`. The server README lists each rule from R1 to R24.

## A question about a product

The intent `ask` opens a question window of 10 seconds, and the voice says "Listening." The microphone button of the page sends that intent. A yes from the touchpad with no current prompt opens the window too.

```mermaid
sequenceDiagram
  participant App as Android app
  participant Socket as Device socket
  participant Runtime as SessionRuntime
  participant Gemini

  App->>Socket: intent ask
  Socket->>Runtime: dispatch(intent)
  Runtime->>Socket: speak "Listening."
  App->>Socket: speech.final with a text that is no command
  Socket->>Runtime: dispatch(question)
  Note over Runtime: step selects the product and gives the effect ask
  Runtime->>Gemini: generateContent with the question and the data of that product
  Gemini-->>Runtime: text
  Note over Runtime: dispatch(answer), with null after a failure or after 4 seconds
  Runtime->>Socket: speak with the answer, or "I could not answer that."
```

- The question is about the product of the current prompt, else the product in view, else the product of the last add. With no such product the voice says "Hold a product up, then ask."
- The model gets the name, the brand, the pack size, the price, the allergens, and the diet fields of that one product. It gets no frame. Its instruction is `agents/answers.md`.
- A `speech.final` outside the window that is no command has no effect.
- In fake mode no call goes to Gemini, and each question gets the answer "I do not have that information."

## Answers from the other inputs

The head is one of four inputs of the Android app. Each other input sends its answer on the same socket.

```mermaid
sequenceDiagram
  participant Glasses as Glasses, or mock glasses
  participant Keys as Volume keys of the phone
  participant App as Android app
  participant Socket as Device socket
  participant Runtime as SessionRuntime
  Note over App: the prompt p-0001 is finished: prompt.done went out
  alt touchpad
    Glasses->>App: InputEvent.Select, a double tap
    App->>Socket: intent yes, source touch, promptId p-0001
    Socket->>Runtime: dispatch(intent)
  else voice
    Glasses->>App: final transcript "add"
    Note over App: VoiceInput drops a result while a line plays, and for 500 ms after it
    App->>Socket: speech.final with text, confidence, locale
    Note over Socket: parseVoiceCommand maps the text to a command
    Socket->>Runtime: dispatch(intent yes, source voice, ID of the last finished prompt)
  else volume keys, with mainYes key in the profile
    Keys->>App: volume up
    App->>Socket: intent yes, source key, promptId p-0001
    Socket->>Runtime: dispatch(intent)
  end
  Note over Runtime: step accepts the yes while the prompt is current and finished (R3, R5)
```

- A double tap carries the ID of the last finished prompt, also after that prompt ended, and the server decides if it counts. A swipe sends `intent repeat` with the source `touch`, and the server sends its last line again.
- The app sends each final speech result as `speech.final` and maps no word to an intent. The server drops a result with a confidence below 0.5 and a text that is no command.
- Volume up is a yes and volume down is a no, only when `mainYes` of the profile is `key` and a prompt is current. In each other case the key changes the volume of the phone.
- Speech needs the microphone permission of the glasses. The app asks for it when the page sets `mainYes` to `voice`, and when the page sends the intent `ask`.

## The fingerprint and the still photo in the Android app

Two extras have their Android side: the fingerprint above 50 EUR, and the sharp second look. Each one starts with a message of the server.

```mermaid
sequenceDiagram
  participant Glasses as Glasses, or mock glasses
  participant Shopper
  participant App as Android app
  participant Socket as Device socket
  alt fingerprint above 50 EUR
    Socket->>App: biometric.request
    App->>Shopper: biometric prompt of Android, "Confirm payment"
    Shopper-->>App: fingerprint, face, or screen lock
    App->>Socket: biometric.result with ok true
    Note over App: a cancel and each error of the prompt send ok false
  else sharp second look
    Socket->>App: event glance.ambiguous
    Note over App: StillPolicy allows one capture at a time, and one each 5 seconds
    App->>Glasses: capturePhoto
    Glasses-->>App: photo
    Note over App: crop, long side 1440 at most, each face pixelated, JPEG
    App->>Socket: frame with kind still and blurred true
  end
```

- A phone with no screen lock and no biometric shows no prompt. The app sends `ok: false`, and the page gets the `error` event `native.biometric_unavailable`.
- The app closes an open prompt when the checkout ends: at `checkout.cancelled` and at `session.end`.
- If face detection fails on the phone, the still does not leave the phone.

## Phases of a session

`PhaseSchema` in `packages/shared/src/events.ts` names the phases. The server holds the phase in `SessionState.phase` and sends each change as the event `session.state`, with the value `cameraOn`.

```mermaid
stateDiagram-v2
  [*] --> shopping
  shopping --> checkout: kiosk code in view, cart has items, no product prompt
  checkout --> shopping: checkout ends with no payment
  checkout --> paid: payment succeeds
  shopping --> resting: 3 minutes with no product and no kiosk in view
  resting --> shopping: device.state with the stream streaming
  shopping --> ended: stop intent
  checkout --> ended: stop intent, not while the payment runs
  resting --> ended: stop intent
  paid --> [*]
  ended --> [*]
```

- A new session starts in `shopping` with `cameraOn: false`. The first `device.state` with the stream `streaming` sets `cameraOn`, and the voice says the start line.
- `resting`: the server sends `session.rest`, and the Android app stops its DAT session. The cart stays. The next `session.start` of the page starts a new DAT session for the same server session.
- `paid` and `ended`: the server sends `session.end`, and the session runtime stops. The session then takes only `device.state` and `profile.set`. It still answers a snapshot, for the receipt.
- A `device.state` with the stream `stopped` sets `cameraOn` to false and ends an open checkout, but not in the steps `biometric` and `paying`. The phase does not become `resting` or `ended`.
- The rules that depend on time alone run before each input. A timer of the `SessionRegistry` sends a `tick` input each second to each session in `shopping` or `checkout`.

The Android app has two sessions. The server session holds the cart and has the phases above. The DAT session holds the camera stream, and a stopped DAT session is final. So one server session can use many DAT sessions: after a rest, a closed hinge, or a lost link.

## Steps of a checkout

A checkout exists while `SessionState.checkout` is not null. Its `step` is `spotcheck`, `offered`, `suspended`, `biometric`, or `paying`. The phase of the session is `checkout` for that time.

```mermaid
stateDiagram-v2
  [*] --> offered: kiosk.seen for a free kiosk, cart has items, no product prompt
  offered --> suspended: a product gets a prompt
  suspended --> offered: the product left the view and the code is in view
  offered --> offered: cart change, or the code comes back after the head window
  offered --> paying: accepted yes on the pay prompt, total of 50 EUR or less
  offered --> biometric: accepted yes on the pay prompt, total above 50 EUR
  biometric --> paying: biometric.result with ok true
  biometric --> [*]: biometric.result with ok false, code out of view for 30 seconds, or stop intent
  offered --> [*]: no on the pay prompt
  offered --> [*]: empty cart, code out of view for 30 seconds, camera stopped, or stop intent
  suspended --> [*]: empty cart, code out of view for 30 seconds, camera stopped, or stop intent
  paying --> [*]: payment.result
  [*] --> spotcheck: kiosk.seen for a free kiosk with spotCheck, cart has items, no product prompt
  spotcheck --> suspended: identified result for the product of the spot check
  spotcheck --> [*]: empty cart, code out of view for 30 seconds, camera stopped, or stop intent
```

| Step | Event to the session clients | View of the kiosk page |
|---|---|---|
| A checkout starts | `session.state` with the phase `checkout`, then `checkout.offered` with a new prompt ID | `connected`, with the cart and the total |
| A checkout starts at a kiosk with `spotCheck` | `session.state` with the phase `checkout`, then `checkout.spotcheck` with the product to show. The line is "Quick check. Show me the rye bread." | `spotcheck`, with the cart and the total |
| The shopper shows that product | none. The line is "Thank you." The next `kiosk.seen` gives `checkout.offered` | `connected` |
| `offered` again | `checkout.offered` with a new prompt ID and the new total | `connected` |
| `suspended` | `checkout.suspended`, then `glance.pending` for the product | `connected` |
| `biometric` | none. The phone gets the line "Over fifty euros. Confirm with your fingerprint on the phone." and then the message `biometric.request` | `connected` |
| `paying` | none | `connected` |
| The payment succeeds | `checkout.paid` with the receipt, `cart.updated` with an empty cart, `session.state` with the phase `paid` | `paid` with the receipt for 10 seconds, then `idle` |
| The payment fails | `checkout.failed`, `session.state` with the phase `shopping` | `failed` for 10 seconds, then `idle` |
| The checkout ends with no payment | `checkout.cancelled`, `session.state` with the phase `shopping` | `idle` |

- The phone reports a kiosk code with `kiosk.seen` after 1500 ms in view, and then one time each second. The text is `GL1`, one space, and the code of the kiosk.
- `KioskService` finds the kiosk of the code. A text that is no code of a kiosk has no effect. A kiosk that another session holds gives the line "This checkout is busy."
- One session holds a kiosk from the start of its checkout to its end.
- Each pay prompt has a new ID. An answer with the ID of an older pay prompt cannot pay.
- The yes on the pay prompt gives the effect `payment.start`. The mock payment waits `PAYMENT_DELAY_MS`, writes an order to the store, and dispatches `payment.result`. No money moves.
- `checkout.offered` has `needsBiometric: true` for a total above 50 EUR. The yes on that pay prompt starts no payment: the server sends `biometric.request`, and the phone answers with `biometric.result`. A result with `ok: false` ends the checkout as a no does. A result with no request has no effect.
- While the step is `biometric`, no answer, no undo, no cart edit, and no recognition result has an effect. The checkout still ends when the code was out of view for 30 seconds, so a browser client, which has no fingerprint check, loses its checkout above 50 EUR after that time.
- While the step is `paying`, no answer, no undo, no cart edit, and no stop intent has an effect.
- After a no on the pay prompt, and after a failed payment, the kiosk is muted until its code has left the view. So the shopper looks away and back to start again.
- A failed payment keeps the cart. A kiosk that registered with `failPayment: true` declines each payment.
- A kiosk that registered with `spotCheck: true` starts its checkout in the step `spotcheck`. The product to show is the cart line with the highest unit price. Until an `identified` result names that product, no pay prompt exists. Another product in view gets its usual prompt, and the step stays. If the product leaves the cart, the server asks for another one with a new `checkout.spotcheck`.

## Parts that do not exist yet

Missing parts:

- `ProbeDecisions.SPEECH` of the Android app is false until the probe run on the glasses. So a session with the real glasses attaches no Speech and sends no `speech.final`. The voice commands and the spoken question work with mock glasses only.
- `SECOND_LOOK_WAIT_MS` has the default 0, so the server does not wait for a still. The Android app sends the still in both cases.
- A browser client has no fingerprint check and no microphone. Its checkout above 50 EUR ends after 30 seconds with no payment, and its question window closes with no question.
- The Display HUD shows the product prompt, the total, and the last line. It has no view for the pay prompt, the receipt, the look-alike candidates, or the spot check.
- A snapshot has no field for the spot check, and a `KioskEvent` does not name the product of the spot check.
- `apps/server/catalog/catalog.json` holds 12 product slots with `FILL_` texts and the price 0. A person must fill them. The default catalog is `catalog.dev.json` with four products.
- The products of both catalog files have no Italian texts, except the oat drink of `catalog.dev.json`. A product with no Italian text keeps its English text.
- In the Italian phone UI, the words of Astryx itself and the debug panel stay English. The voice commands stay English in each language.

Checks that nobody did:

- Nobody has run the app with the real glasses. The tests of the head, the touchpad, the voice, the volume keys, and the still photo use mock glasses.
- Nobody has put a finger on the payment prompt. The tests close the prompt of Android with no finger, or replace it.
- No native speaker has read the Italian lines of the server or the Italian table of the phone UI.
- Nobody has checked the Display HUD in the Display simulator or on glasses with a display. The checks ran in a browser.
- No replay of a frame set has run with the real recognition service, and no test has run the store tests against a MongoDB server.
