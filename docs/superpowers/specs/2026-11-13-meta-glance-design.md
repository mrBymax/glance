# Meta Glance PoC - design document

- Date: 2026-11-13
- Status: draft 3, after five zero-context reviews and the first team review on pull request 3. It waits for team approval.
- Event: Junction 2026, Meta challenge "AI Glasses for Everyone, Everyday" (`CHALLENGE.md`)
- Deadline: Sunday 2026-11-15 at 08:00 (team target). The public schedule says 10:00.
- Research and reviews behind this document: the files in `docs/research/`

## 1. Intent and why

Meta Glance is a proof of concept that the team pitches to Meta. It shows how smart glasses replace the scanner in scan-as-you-shop.

1. The shopper holds a product and looks at it. A voice in the glasses says the name and the price.
2. A nod adds the product to the cart.
3. At a self-checkout kiosk, the shopper looks at a code on the screen and nods to pay.

Two rules define the product:

- Glance tells, nod buys. A glance never changes the cart.
- A yes answers the prompt that the shopper just heard, and it counts only while that thing is in view.

Why glasses: the camera sees what the hand holds, so both hands stay free and the kiosk needs no touch.

Why now: scan-as-you-shop exists. S Group runs "Kerää ja skannaa" in 67 Finnish stores, and Coop runs Salvatempo. It still needs a hand for a scanner or a phone. Camera systems in the store ceiling need an installation in each store, and Amazon removed Just Walk Out from its Fresh stores in 2024.

What is new: parts exist. Meta announced product and price recognition for its own assistant, and Meta India tests payment by QR code. The research found no project with the closed loop in a store, a consent rule, or an accessibility case. Those three parts are the pitch.

Audience (team decision: all three stay):

- Shoppers with full hands.
- Blind and low-vision shoppers. They cannot read labels, and they cannot use a touchscreen kiosk.
- Retailers that already run scan-as-you-shop. They are the path to a pilot.

What the store changes: it adds no camera and no sensor. Its kiosk software shows one code and accepts the cart. Its catalog supplies the prices.

## 2. Goals, non-goals, anti-goals

Goals:

- G1. The loop works on real Ray-Ban Meta Gen 2 glasses: glance, nod, cart, kiosk, pay.
- G2. The prototype handles permissions, errors, connectivity, and device state changes. The challenge text asks for this.
- G3. Each action works without sight, without hearing, without speech, and without head movement.
- G4. A video and a website show the loop. The APK is available for download.
- G5. The four sponsor technologies do real work: Gemini, ElevenLabs, MongoDB Atlas, Vultr.
- G6. The team measures recognition accuracy, time from glance to voice, and false yes count, and shows the numbers.

Non-goals:

- An iOS app.
- Real payment, real store integration, user accounts.
- Barcode decode of products. The stream cannot read them.
- Operation with the phone locked.
- Transit tickets and payments between people. They go on one vision slide.
- A production release. Beta capabilities of the SDK cannot ship to production.

Anti-goals. Each one is a failure even if the demo works:

- An item enters the cart, or a payment happens, without a deliberate yes.
- The voice states a guess as a fact, or guesses a price or an allergen.
- The server stores a camera frame.
- A feature works only for a shopper who can see, hear, speak, and nod.

## 3. Constraints

| Constraint | Source |
|---|---|
| 33 hours from Friday 23:00. Four people. One pair of Gen 2, one Display, three Android phones, one Mac. | Team |
| The DAT SDK is native only. Android is the only app. | `2026-11-13-dat-feasibility.md` |
| The stream is at most 720 x 1280 with heavy compression. It cannot read a product barcode or small print. | `2026-11-13-context-and-prior-art.md` |
| Motion, Inputs, Speech, and in-stream audio are beta capabilities. Nobody on the team has run them yet. They may need a project in the Wearables Developer Center. | DAT docs |
| The device reserves two touchpad gestures. A single tap pauses the session. A tap and hold stops it. | DAT docs |
| Meta states up to 30 minutes of live streaming. The capture LED stays on during a stream. | Meta |
| Meta policy: "Deliberate, not ambient" and "narrow purpose, short retention, obvious to bystanders". | Acceptable-use guidance |
| Google requires the paid Gemini tier for users in the European Economic Area. | Google terms |
| Astryx is React only. It has no Android binding. | `2026-11-13-stack-facts.md` |
| WCAG 2.2 level AA is the accessibility reference. Criterion 2.5.4 requires an alternative to each motion input. | `2026-11-13-accessibility-and-trust.md` |

## 4. Approaches considered

### 4.1 How a product enters the cart

| Option | Trade-off |
|---|---|
| Glance tells, nod buys (chosen) | Consent is explicit and hands-free. A wrong recognition costs nothing. One extra beat for each item. The nod needs a beta API. |
| Glance buys, shake undoes | Closest to "zero interaction". Each look at a label adds an item. A blind shopper cannot identify without a purchase. |
| Flip to buy (show the barcode side) | Needs only the camera. A blind shopper cannot find the barcode. |
| Nod by default with an express switch | Keeps "zero interaction" as a mode. A second mode to build and test. |

The team chose the first option. It matches the Meta guidance "Deliberate, not ambient".

### 4.2 Architecture

| Option | Trade-off |
|---|---|
| A. Thin phone, smart server (chosen) | One server holds recognition, cart logic, and voice. Three people can work without the glasses. It needs a network, and frames leave the phone. |
| B. Smart phone | Frames stay on the phone. All logic sits in the one codebase that one person can test. Gemini becomes a side feature. |
| C. Gemini Live agent | The Live API waits for user speech, stops video sessions at 2 minutes, and speaks with its own voice. It cannot do the glance. |

The team chose A. The phone keeps the privacy steps and the nod detection.

### 4.3 UI stack

- Components: Astryx with a stock theme (team decisions).
- Phone screens: a React app in a WebView inside the Kotlin app (team decision). The alternative was Jetpack Compose. One reviewer would replace the WebView with one native screen to save time.
- Server language: TypeScript (team decision). The alternative was Python.

### 4.4 Lead audience

A zero-context judge recommended one lead audience: blind and low-vision shoppers who own the glasses. The team keeps all three audiences.

## 5. Scope

The core has three steps, in build order. Each step ends with a test on the real glasses.

C1, the probe:

- A small build starts the stream, Motion, Inputs, Speech, and a speech clip on the glasses. It logs each state.
- Its results fill the table in section 16. They decide the yes input.

C2, the spine:

- Session start and stop, with a spoken "Camera on" and "Camera off".
- Glance: recognition of a held product from a closed catalog, with a spoken line and a caption.
- A yes adds, a no skips, with the rules of section 6.2.
- Cart with a running total.
- Kiosk code, cart on the kiosk screen, payment by yes, receipt.
- One phone screen (Session) and the kiosk page.

C3, the parts that the challenge text asks for:

- Setup: registration with the Meta AI app and the camera permission, with text that explains each jump.
- The device and error states of section 6.6.
- Captions, haptics, and a phone button for each action.
- The preferences marked "core" in section 6.5.
- Crop and face blur on the phone. No stored frame.
- The mirror page for judges and for the video.
- Server on Vultr with HTTPS, the website with the video, the APK link, and the privacy page.

Extras, in this order:

1. Allergen guard.
2. Budget guard.
3. An answer for look-alike products: the voice says that it cannot tell them apart (author's addition, see section 21).
4. Display HUD as a mockup in the simulator (the first request of the team).
5. Ask about a product.
6. Fingerprint above 50 EUR.
7. Voice in Italian.
8. Spot check by glance.
9. A sharp second look: a still photo during the stream for look-alike products.

Rules for extras:

- A seat may start its next extra when its own core work is merged and it blocks no other seat.
- If the spine does not speak on the glasses by Saturday 14:00, only extras 1 to 3 stay.
- At the freeze on Saturday 18:00, work that is not done is cut.

If time is left: a practice round in setup, a shopping list on the HUD, a wake gesture for the camera, "Hey Meta, start Glance", catalog retrieval with Atlas Vector Search, a barcode scan with the phone camera for unknown products, a sound beacon on the kiosk.

## 6. The experience

### 6.1 Voice script

Standard detail level, English. The cart holds rye bread (2.60) at the start.

| Moment | Voice | Sound |
|---|---|---|
| Session starts | "Camera on. Hold a product up to hear its price." | |
| Product recognized | "Oat drink, one litre, one eighty-nine." | |
| First three glances of a session | Adds "Nod to add." | |
| Allergen match (extra) | "Oat drink, one litre, one eighty-nine. Warning: contains gluten." | warning |
| Yes | "Added oat drink. Total four forty-nine." | added |
| No on a new product | "Skipped." | |
| No within 8 seconds after an add | "Removed oat drink. Total two sixty." | removed |
| Second yes on the product that was just added | "Hold it up again to add another." | |
| Product already in the cart | "Oat drink. One is in your cart. Nod to add another. Shake to remove." | |
| Product not in the catalog | "I do not know this product." | |
| Product partly visible | "I can see part of it. Move it left a little." | |
| Look-alike products (extra) | "I cannot tell which oat drink this is. Turn the front to me." | |
| A yes after the product left the view | "Hold it up again." | |
| Total passes the budget (extra) | "Added oat drink. Total twenty-one ten. That is over your budget of twenty euros." | warning |
| Kiosk code in view | "Checkout 3 at Demo Market. Three items, six euros thirty-nine. Nod to pay." | found |
| A yes at checkout with the code out of view | "Look at the checkout code, then nod." | |
| Spot check (extra) | "Quick check. Show me the oat drink." Then "Thank you." | |
| Total above 50 EUR (extra) | "Over fifty euros. Confirm with your fingerprint on the phone." | |
| Paid | "Paid. Six euros thirty-nine. Your receipt is on your phone. Camera off." | paid |
| Checkout cancelled | "Checkout cancelled. Your cart is safe." | |
| Help | "Hold a product up to hear its price. Nod to add it. Look at a checkout code and nod to pay." | |

Detail levels:

- Brief: "Oat drink, one eighty-nine." and "Added oat drink."
- Standard: the table above.
- Detailed: "Oatly oat drink, one litre carton, one euro eighty-nine." Allergens always follow.

Rules for speech:

- One or two short sentences for each line. Long detail goes to the phone.
- A line with higher priority interrupts the current line. Order: payment and errors, then glances, then information.
- A sound never carries information alone. Speech follows each sound.
- Each add and each removal names the product.
- The pay prompt always names the payee and the total. No detail level shortens it.
- A prompt names the main yes input of the shopper: "Nod to add", "Double tap to add", "Say add", or "Press Add on your phone".
- If the shopper swaps the gestures, the prompts say "Shake to add".

### 6.2 Interaction rules

The server owns these rules. Times are defaults that the builder can tune.

Terms:

- Target: a product from a recognition result, or a kiosk from a code.
- In view: reported within the last 3 seconds. Left the view: not reported for 3 seconds.
- Prompt: a spoken line that asks for a yes or a no. Each prompt has an ID and one target.
- Finished prompt: the phone played the clip to its end, or showed the caption if sound is off. The phone reports it.
- Head window: the time in which a nod or a shake counts. It starts when a prompt finishes, lasts 8 seconds, and needs the target in view.

Products:

- R1. A recognized product that is not in the cart and not muted becomes the pending product. The voice gives the glance prompt.
- R2. A new product in view replaces the pending product and gets a new prompt.
- R3. Each yes and each no carries the ID of the last finished prompt. The server accepts it only if that prompt is the current one.
- R4. A yes or no from the head counts only inside the head window.
- R5. A yes or no from voice or touchpad counts while the prompt is current. A product prompt stays current until another prompt replaces it, or its target left the view for 15 seconds.
- R6. A yes or no from the phone names the product on its card. It needs no view test. The card stays as long as the prompt is current.
- R7. An accepted yes on the pending product adds one unit. The voice names the product and the total.
- R8. An accepted no on the pending product skips it. The product is muted until it has left the view.
- R9. After a no, the next recognition calls exclude the skipped product for 10 seconds. If the model then names another product, that product becomes pending.
- R10. After an add, the product is muted while it stays in view. For 8 seconds, a no removes that unit. A second yes gets the line "Hold it up again to add another."
- R11. A product in the cart that comes into view again, after it left the view, gets the prompt for "add another" or "remove".
- R12. An undo from voice or phone removes the last added unit and names it.
- R13. The voice says "I do not know this product" one time for each appearance of an unknown product.

Checkout:

- R14. The phone reports a kiosk code after 1.5 seconds in view. If it sees several codes, it reports the largest.
- R15. A kiosk code, with items in the cart and no current product prompt, starts checkout. The kiosk shows the cart, and the voice gives the pay prompt. With an empty cart the voice says "Your cart is empty."
- R16. A yes pays only as an answer to the pay prompt. From the head it also needs the code in view.
- R17. A product held up during checkout suspends the checkout, and the product rules apply. When the product has left the view and the code is in view, the voice gives a new pay prompt with the new total.
- R18. A no on the pay prompt cancels the checkout. That kiosk is muted until its code has left the view.
- R19. The kiosk returns to idle when its code was out of view for 30 seconds and the checkout screen of the phone is closed. The cart stays.

General:

- R20. A yes or no with no valid target gets one short hint if a prompt finished within the last 15 seconds. If not, nothing happens and nothing sounds.
- R21. Silence never adds and never pays.
- R22. After 3 minutes with no product and no kiosk in view, the camera stops. The voice and a haptic say so. The cart stays. The phone restarts the camera.
- R23. "Cart" by voice speaks at most five lines, then "and more on your phone".
- R24. If the glasses cannot stream, for example with a flat battery, Glance does not check out. The shopper uses a regular checkout: a staffed checkout, or a self-checkout where the shopper scans each product. The cart stays on the phone as a list.

### 6.3 Inputs

Each action has a phone path. No action needs the head, the voice, or the touchpad alone.

| Action | Head | Voice | Touchpad | Phone |
|---|---|---|---|---|
| Add the pending product | nod | "add", "yes" | double tap | Add button on the card |
| Skip the pending product | shake | "no", "skip" | | Skip button on the card |
| Remove the product just added | shake | "remove" | | row control |
| Undo the last add | | "undo" | | Undo button |
| Pay | nod | "pay" | double tap | Pay button |
| Cancel checkout | shake | "cancel" | | Cancel button |
| Repeat the last line | | "repeat" | swipe | tap on the caption |
| Hear the total or the cart | | "total", "cart" | | on screen |
| Ask a question (extra) | | speak after the double tap | double tap, when no prompt is current | microphone button |
| Stop the camera | | "stop" | tap and hold (device gesture) | End button |

- The touchpad and voice columns depend on section 16.
- If neither Motion nor Inputs starts, the volume keys of the phone are the hands-busy input: up is yes, down is no.
- The Inputs docs warn that a touchpad gesture may not reach the app. No action depends on the touchpad alone.

### 6.4 Outputs

| Channel | Carries | For whom |
|---|---|---|
| Speech in the glasses | each event | default |
| Sounds in the glasses | found, added, removed, warning, paid | faster feedback |
| Captions on the phone | each spoken line as text, in a polite live region | deaf and hard-of-hearing shoppers |
| Haptics on the phone | one pattern for each of: prompt, added, removed, warning, paid, error. A repeated pattern for "camera paused" and "camera off". | deaf and hard-of-hearing shoppers, noisy stores |
| Kiosk screen | cart, total, payment state | everyone at checkout |
| Mirror page | captions, the audio of each clip, the cart | judges and the video, because nobody else can hear the glasses |
| Display HUD (extra) | captions, pending product, total | a mockup of the version for glasses with a display |

### 6.5 Preferences

| Preference | Values | Default | Step |
|---|---|---|---|
| Voice detail | brief, standard, detailed | standard | core |
| Speech speed | 0.8x to 2.0x, with a sample | 1.0x | core |
| Head gestures | on, off | on | core |
| Gesture meaning | nod is yes, or shake is yes | nod is yes | core |
| Head window | 8 seconds, 15 seconds, while in view | 8 seconds | core |
| Haptics | on, off | on | core |
| Speak prices aloud | on, off | on | if time is left |
| Allergens and diet | the 14 EU allergens, vegan, vegetarian | none | extra 1 |
| Budget | amount in EUR, or none | none | extra 2 |
| Language | English, Italian | English | extra 7 |

Speech speed applies on the phone at playback. The server does not make a clip for each speed.

### 6.6 Device and error states

Each state has one cause sentence and one action on the phone, in one banner component. The voice speaks each state where the glasses can play it. When the glasses are disconnected, the phone speaker plays the line.

| State | Signal | Voice | Recovery |
|---|---|---|---|
| Meta AI app missing | registration error | | Link to the app store |
| Not registered | registration state | | Setup step 1 |
| No internet at registration | registration error | | Retry button |
| Camera permission denied | permission status | | Setup step 2 explains, then asks again |
| Glasses not found | no connected device | | "Unfold your glasses and keep them near the phone." |
| Update required | device compatibility | | Button opens the update in Meta AI |
| Paused | session or stream state PAUSED | "Paused. Tap the side of your glasses to resume." | Wait for the device. Do not restart. |
| Stopped by the device | session state STOPPED | "Camera off." | A stopped session is final. If the link dropped or the hinge closed, create a new session when the glasses return. If not, wait for the shopper. |
| Glasses off the face | wear state | | Stop uploads. Resume when worn. A stream that starts off the face pauses when worn, until a tap. |
| Battery at 20 and 10 percent | battery level | "Glasses battery at twenty percent." | Information only |
| Battery too low, too warm | stream error | "Camera off. Please use a regular checkout." | Regular checkout (rule R24). The cart stays on the phone as a list. |
| Server not reachable | socket closed or timeout | "Connection lost. Your cart is safe. Glances are paused." | Reconnect with backoff, then "Back online." |
| Recognition slow | 3 failed or late calls | "Recognition is slow right now." | Automatic |
| Payment failed (mock) | kiosk test flag | "Payment failed. Nothing was charged. Look at the code to try again." | Look again |

## 7. Architecture

```text
Glasses --Bluetooth--> Android app (Kotlin shell) --WebSocket--> Server (Node, Vultr)
                        DAT session, stream 720x1280 at 7 fps     recognition worker -> Gemini
                        QR decode (ML Kit)                         session rules (section 6.2)
                        frame pick, face blur, crop, JPEG          cart, orders, catalog -> MongoDB Atlas
                        head gesture detector                      speech lines -> ElevenLabs, clip cache
                        speech and sound playback                  event bus
                        WebView: phone UI (React, Astryx)               |
                                                                        | events (SSE)
                                         Kiosk page, mirror page, Display HUD, website
```

Repository layout:

| Path | Content |
|---|---|
| `apps/mobile/android` | Kotlin shell app |
| `apps/mobile/ui` | Phone UI: React 19, Vite, Astryx |
| `apps/server` | Node 22, TypeScript, Fastify, `ws` |
| `apps/website` | Landing page, `/kiosk`, `/mirror`, `/privacy`: React 19, Vite, Astryx |
| `apps/display-pow` | Display HUD mockup: React, `@wearables-ui-toolkit/mrbd` |
| `packages/shared` | Message types as zod schemas, bridge interface, money helpers |
| `agents` | Gemini prompts for recognition and for answers |
| `infra` | Dockerfile, Compose file, Caddy config |

## 8. Contract

`packages/shared` is the single source for these types. The Kotlin app mirrors them. Write the types before the code on each side.

### 8.1 REST and events

| Call | Purpose |
|---|---|
| `POST /api/sessions` with the profile | Returns `sessionId`, `token`, and the socket URL |
| `GET /api/sessions/:id` | Snapshot: phase, current prompt, cart, profile |
| `PATCH /api/sessions/:id/profile` | Preferences that the server needs |
| `POST /api/sessions/:id/intents` | A yes, a no, an undo, or a cart edit from a web client |
| `GET /api/sessions/:id/events` | Server-sent events for web clients |
| `DELETE /api/sessions/:id` | Deletes the session, its cart, and its receipt |
| `POST /api/kiosks` with name and store | Returns `kioskId`, `token`, and the short `code` |
| `GET /api/kiosks/:id/events` | Server-sent events for the kiosk page |
| `GET /api/speech/:hash.mp3` | A cached speech clip |

Each session and each kiosk has a random token. The token goes in the query string for events.

### 8.2 Device socket

`wss://<domain>/ws/device?session=<id>&token=<token>`, one for each session.

Phone to server:

- A binary message for each frame: 4 bytes with the header length, a JSON header (`seq`, `ts`, `w`, `h`, `blurred`), then the JPEG bytes.
- `intent`: `kind` (`yes`, `no`, `undo`, `repeat`, `total`, `cart`, `help`, `stop`), `source` (`head`, `voice`, `touch`, `phone`, `key`, `camera`), and `promptId` for a yes or a no.
- `prompt.done`: the ID of a prompt whose clip finished.
- `kiosk.seen`: the text of the code. At most one each second while the code is in view.
- `speech.final`: `text`, `confidence`, `locale`.
- `device.state`: link, battery, wear, hinge, thermal level, stream state.

Server to phone:

- `speak`: `id`, `priority`, `text`, `lang`, `url`, `sound`, `interrupt`, and `promptId` if the line is a prompt.
- Each event from section 8.3.
- `session.rest` and `session.end`: the phone stops the camera.

### 8.3 Events

One union type, sent to the phone, the kiosk, the mirror page, and the HUD:

`session.state`, `glance.pending`, `glance.cleared`, `glance.hint`, `glance.unknown`, `cart.updated`, `budget.exceeded`, `checkout.offered`, `checkout.suspended`, `checkout.spotcheck`, `checkout.cancelled`, `checkout.paid`, `checkout.failed`, `caption`, `error`.

- `glance.pending` carries the prompt ID, the product (ID, name, pack size, price in cents), the warnings, and the quantity already in the cart.
- `cart.updated` carries all lines, the total in cents, and the last change with the product name.
- `caption` carries each spoken line as text, and the clip URL for the mirror page.

### 8.4 Bridge between the WebView and Kotlin

The phone UI has no network code. Kotlin relays server events to the page and sends UI actions to the server.

- Page to Kotlin: `setup.register`, `setup.requestCamera`, `session.start`, `session.end`, `intent`, `cart.edit`, `profile.set`, `pocket.set`, `haptic`, `data.delete`.
- Kotlin to page: `native.state` (registration, permission, device, session, stream, network, capabilities) and each server event.

`packages/shared` defines the bridge as an interface with two implementations. `AndroidBridge` uses the WebView. `BrowserBridge` talks to the server directly and fakes the native state, so the UI runs in a desktop browser.

### 8.5 Kiosk code

- The code is a QR code with a short text: `GL1`, a space, and the kiosk code. Example: `GL1 K3X7`. It uses capital letters and digits and has at most 20 characters.
- A short text gives the smallest QR size (21 modules), which decodes from the stream at more than 1 m.
- The code does not change in the PoC. A code that changes after each use is work for a product.

### 8.6 Data model (MongoDB Atlas)

| Collection | Fields |
|---|---|
| `products` | `_id`, `gtin`, `name` and `spokenName` for each language, `brand`, `packSize`, `priceCents`, `allergens`, `vegan`, `vegetarian`, `visual` (the look of the package, for the prompt), `lookAlikes` (IDs of products with a similar package) |
| `sessions` | `_id`, `token`, `phase`, `prompt`, `profile`, `cart.items` (`productId`, `qty`, `unitPriceCents`), `cart.totalCents`, `kioskId` |
| `kiosks` | `_id`, `token`, `code`, `name`, `store`, `boundSessionId`, `lastSeenAt`, `spotCheck` |
| `orders` | `_id`, `sessionId`, `kioskId`, `items`, `totalCents`, `paidAt`, `method: "demo"` |
| `speech_clips` | `_id` (hash of text, language, voice, model), `path` |

Money is an integer number of cents in EUR. Only the server computes a total. Prices come only from `products`.

## 9. Android app

This is the main part for the mobile builder. Read `skills/meta-wearables-dat/references/android/` before you write SDK code, and query the `wearables-dat` docs server for exact API names.

### 9.1 Responsibilities

The app is a shell. It connects the glasses, runs the frame pipeline, detects head gestures, plays audio, and hosts the UI. It holds no cart logic and no prices.

### 9.2 The probe comes first

Before the app, build the probe of step C1. It is one screen with a log.

1. Register, get the camera permission, start a session, and start the stream at 720 x 1280 and 7 frames per second.
2. Add Motion, Inputs, and Speech, one at a time. Log the state and each error of each one.
3. Play a speech clip while the stream runs. Log the frame size before and after.
4. Save 20 frames of products that a hand holds up. They are the first test set for Gemini.
5. Run the stream, Motion, and audio together for 10 minutes. Log battery and thermal level.

The probe code becomes the `dat` module of the app.

### 9.3 Modules

| Module | Responsibility |
|---|---|
| `dat` | Registration, permissions, device state, session, camera stream, and the beta capabilities |
| `pipeline` | Frame pick, QR decode, face blur, crop, JPEG |
| `gesture` | Head gesture detector |
| `net` | Device socket with reconnect |
| `audio` | Speech queue and sounds |
| `bridge` | WebView host and message bridge |
| `session` | The controller that connects the modules and holds the app state |
| `mock` | MockDeviceKit menu for debug builds |

### 9.4 Session lifecycle

1. Start: the UI sends `session.start`. The app creates the server session, opens the socket, and creates the DAT session.
2. Subscribe to session state and errors before `start()`. Add capabilities only after the state is STARTED.
3. Add the camera with high quality and 7 frames per second. A lower frame rate gives a sharper frame.
4. Add Motion at 30 Hz, Inputs for the touchpad only, and Speech, as far as section 16 allows.
5. When the stream reaches STREAMING, tell the server. The server sends the "Camera on" line.
6. Read the size of each frame. The glasses can lower the resolution.
7. Stop: on `session.end`, `session.rest`, the End button, or a stop from the device. Stop the camera, then the session. A stopped session is final, so create a new one for the next start.
8. Keep the screen on while a session runs.

State handling follows section 6.6. Do not restart a paused session. Do not guess why a session stopped: use the link state and the hinge state.

The device selector takes any connected glasses. The Display glasses also stream, so a second phone with the Display is a second test device.

### 9.5 Frame pipeline

Run it off the main thread.

1. Each frame goes to the ML Kit barcode scanner, for QR codes only. A text that starts with `GL1 ` is a kiosk code. Report it after 1.5 seconds in view. If there are several, take the largest.
2. Each 500 ms, pick the sharpest frame since the last pick.
3. Skip the upload if the last upload is still in the send queue, or the glasses are off the face, or the socket is down. Do not queue frames.
4. Detect faces with ML Kit and pixelate them. If this step fails, drop the frame.
5. Crop to the center 80 percent of the width and 70 percent of the height. Scale the long side to 768 pixels at most.
6. Encode as JPEG at quality 80 and send it.

The app never writes a frame to storage. Face detection is best effort at this resolution, and the crop removes most of the scene.

### 9.6 Head gesture detector

- Input: gyroscope samples from Motion. Find the pitch axis and the yaw axis with the probe, and keep them configurable.
- A nod is a fast pitch movement down and up that returns to its start. A bend to a low shelf does not return, so it is not a nod.
- A shake is a fast yaw movement with two reversals or more.
- The detector runs only inside the head window of a prompt (section 6.2). It sends `intent` with source `head` and the prompt ID.
- It reports within 400 ms after the gesture ends.
- Thresholds are settings with three levels. The off switch and the swap of meanings come from the profile.
- Test with recorded samples. MockDeviceKit can replay a CSV file of motion samples. Record nods, shakes, walks, put-backs on a low shelf, and speech with head movement.
- Target: no false yes and no false no in 15 minutes of walks and put-backs by two people. Test the nod on five heads. Put the numbers in the pitch.

### 9.7 Audio and speech input

- The server sends `speak` with a clip URL. The app plays clips one at a time and obeys `interrupt`.
- When a prompt clip ends, the app sends `prompt.done`. If sound is off, it sends it when the caption shows.
- Sounds are short files in the app. The app plays the sound first, then the clip.
- Playback uses the default media route. With glasses connected, that is the glasses. Without them, it is the phone speaker.
- Speech speed is a playback setting with pitch correction.
- Do not open the Bluetooth microphone (HFP). It lowers the output quality.
- If Speech starts: ask for the DAT microphone permission in setup, with its own explanation. Ignore each result while a clip plays and for 500 ms after it, because the microphone can hear the prompt.

### 9.8 WebView host

- The UI build is copied into the APK and loaded through `WebViewAssetLoader`. A debug setting loads the Vite dev server.
- The bridge follows section 8.4. Kotlin sends `native.state` on each change.
- Set the text zoom of the WebView from the font scale of the system.
- Pocket mode: the page shows a black screen with the total, and Kotlin keeps the screen on.
- Haptics run in Kotlin, with the patterns of section 6.4.
- Volume keys send a yes or a no while a prompt is current, if section 16 selects that input.

### 9.9 Mock mode

Debug builds have a menu for MockDeviceKit: pair mock glasses, use the phone camera as the stream, fold, take off, set battery and thermal level, deny a permission, inject a tap. Each state in section 6.6 must be reachable from this menu. Mock mode is also the fallback for the live demo.

### 9.10 Manifest and build

- Minimum Android 10. Permissions: Bluetooth connect, internet, vibrate, and camera for the mock stream only.
- DAT application ID and client token are `0` for Developer Mode, and come from build config. A Developer Center project replaces them if section 16 needs one. The URL scheme for Meta AI callbacks is `glance`.
- The server URL comes from build config.
- One debug build and one signed demo APK for the website.

## 10. Phone UI

React 19, Vite, Astryx with the stock Neutral theme. Run `npx @astryxdesign/cli init` in the app, and use `astryx component <Name>` and `astryx template --list` to select components. Do not hand-write a component that Astryx has.

Core screens:

| Screen | Content |
|---|---|
| Setup | Three steps on one screen: link glasses, allow camera, ready. Each step says what opens, what to tap, and how to return, before the jump to Meta AI. |
| Session | Status row (glasses, battery, camera, network). The card of the current prompt: name, pack size, large price, warnings, and Add and Skip buttons. Captions. Cart with a control for each row. Total. Undo, Pocket mode, Settings, End. One banner for the states of section 6.6. |
| Checkout and receipt | Kiosk name, store, total, Pay and Cancel. Then the receipt with the line "Demo payment. No money moved." |

Settings is a sheet on the Session screen with the core preferences, the privacy text, and "Delete my data".

If time is left: a welcome screen, a preferences step in setup, and a practice round that coaches the hold position and tests one nod.

Requirements:

- Touch targets of 48 dp or more. Contrast of 4.5:1 or more for text.
- Captions and cart changes use a polite live region.
- The UI works at 200 percent font scale and with TalkBack.
- No state depends on color alone.
- Each string that the voice speaks also shows as text.

Reference patterns for these screens are in `docs/research/2026-11-13-ui-references.md`. The team chose a stock theme, so use the patterns and ignore the custom tokens there.

## 11. Server

One Node process. Modules: `http`, `ws`, `sessions` (the rules of section 6.2 as pure functions), `recognition`, `speech`, `catalog`, `kiosk`, `ask` (extra), `db`, `bus`.

### 11.1 Recognition

- Model: `gemini-3.5-flash-lite` from an environment variable. Verify the ID with one call. Use the paid tier.
- One call at a time for each session. If frames arrive faster, keep only the newest.
- The system instruction lists the catalog: ID, name, brand, pack size, and the look of the package.
- The model answers only about one product that a hand holds up, large in the frame. Products on a shelf do not count.
- A request can carry a list of IDs to exclude (rule R9).
- The response is structured output with this schema:

| Field | Values |
|---|---|
| `status` | `identified`, `ambiguous`, `unsure`, `unknown`, `none` |
| `productId` | a catalog ID, or null |
| `candidates` | catalog IDs, for `ambiguous` |
| `confidence` | 0 to 1 |
| `aimHint` | `none`, `left`, `right`, `up`, `down`, `closer`, `farther`, `turn` |
| `gesture` | `none`, `thumbs_up`, `thumbs_down` |

- Only `identified` leads to a spoken name and price. `unsure` leads to an aim hint, at most one each 5 seconds.
- `ambiguous` (extra 3): the frame fits two or more products with `lookAlikes`. The voice says that it cannot tell them apart, and asks for the front.
- Sharp second look (extra 9): on `ambiguous`, the phone takes a still with `stream.capturePhoto()` and sends it. One test got 1440 x 1080 in about 1 second.
- Start with the default media resolution. Test the low setting on the saved frames, and keep the cheaper one if accuracy holds.
- A call that takes more than 4 seconds is dropped.
- The server holds a frame in memory for the call only. It never writes a frame to disk, to the database, or to a log. A flag `SAVE_FRAMES` exists for the test set and stays off in the demo.

### 11.2 Speech

- Templates for each language turn an event into text. A helper turns cents into spoken prices.
- The clip key is a hash of text, language, voice, and model. A hit returns the cached file.
- A miss calls ElevenLabs: model `eleven_flash_v2_5`, the HTTP streaming endpoint, an MP3 format.
- The catalog seed makes the glance lines for each product in advance.
- Each `speak` also goes out as a `caption` event with the clip URL.

### 11.3 Catalog

- About 12 real products, in `catalog.json`, loaded by a seed script. Two of them are look-alikes with different prices or allergens.
- A person writes the price, the pack size, and the look of the package. Open Food Facts can fill allergens by GTIN, and a person checks each value.
- If a product has no allergen data and the shopper has an allergen profile, the voice says "Allergen data is missing for this product."
- The allergen guard never says that a product is safe. It warns or it reports missing data.

### 11.4 Kiosk and payment

- The kiosk page registers, shows its code, and listens for events.
- The server binds one session to one kiosk. A second shopper hears "This checkout is busy."
- Payment is a mock that succeeds after a short delay. A query flag on the kiosk page makes it fail, to show the error path.
- A paid order ends the session, and the phone stops the camera.

### 11.5 Events and storage

- An event bus in the process sends events to the phone, the kiosk, the mirror page, and the HUD. Atlas is the store of record.
- Atlas change streams are not on the critical path. Use them when the server grows past one process.

### 11.6 Deployment

One Vultr instance in Stockholm with Docker Compose: Caddy for TLS on the team domain, the server, and the static builds of the website and the HUD. Secrets come from environment variables: `GEMINI_API_KEY`, `GEMINI_MODEL`, `ELEVENLABS_API_KEY`, voice IDs, `MONGODB_URI`, `PUBLIC_BASE_URL`.

## 12. Kiosk, mirror, website, Display HUD

Kiosk page (`/kiosk`, Astryx):

- The code stays on the screen in each state, as large as the screen allows and at least 15 cm wide.
- Idle: "Look at this code to pay", the code, the kiosk and store name, and a line for shoppers without glasses.
- Connected: the code on one side. On the other side the total at the top, the cart lines, and the text "Waiting for your nod".
- Paid: the amount, "Paid", the receipt, and "Demo payment".
- Failed: "Payment failed. Nothing was charged."
- On a 1080p screen, the total is 160 px or more and a row is 48 px or more.
- Put the screen at seated eye height. Test the code from a chair at 1.5 m.

Mirror page (`/mirror`, Astryx): large captions, the audio of each clip, and the cart of one session. Open it on a laptop next to the demo. It is a demo tool, and the pitch says so.

Website (Astryx): the story, the video, three steps (look, nod, pay), the accessibility part, what leaves the phone, the measured numbers, the APK with Developer Mode steps, and `/privacy`. The privacy page says how to delete data. The Meta terms require that.

Display HUD mockup (extra 4, `apps/display-pow`): follow the `mrbd-ui-toolkit` skill. One screen at 600 x 600 in the Display simulator: camera status, pending product with price and warning, prompt, total, captions. Add and Skip are focusable buttons. It reads recorded events or the events of a live session. The simulator records the video clip for the pitch.

## 13. Privacy and data

| Topic | Practice |
|---|---|
| Consent points | Registration, camera permission, session start, each add, each payment |
| Frames | Faces pixelated and frame cropped on the phone, sent over TLS, held in memory for one call, never stored |
| Model provider | Gemini paid tier. The team must confirm that the paid tier does not train on the data. |
| Audio | No raw audio leaves the glasses. Speech recognition on the glasses returns text. |
| Stored data | Session with cart and preferences, order, speech clips. No account, no name. |
| Deletion | "Delete my data" in the app deletes the session and the order |
| Bystanders | The capture LED stays visible. The voice says "Camera on" and "Camera off". The app does not analyze people. A pilot store shows a notice at the entrance. |
| Camera time | The shopper starts and stops the session. The camera stops after 3 idle minutes and after payment. |
| Payment | A nod is consent, not authentication. Above 50 EUR the phone asks for a fingerprint (extra 6). |

Known weak point: the purchase is deliberate, but the camera runs for the whole session. That is not what Meta means by "deliberate, not ambient". The PoC answers with the session start, the spoken cues, the blur, the crop, and no storage. A product needs a wake signal on the glasses, so that the camera runs only while a hand holds a product. The pitch says this and asks Meta for that signal.

## 14. Performance and trade-offs

| Choice | Reason | Cost |
|---|---|---|
| 720 x 1280 at 7 frames per second | Less compression in each frame. Enough for the kiosk code and 2 uploads each second. | Slower code detection than at 30 |
| 2 uploads each second, one call at a time, newest wins | Bounded cost and delay | A short glance can miss |
| Clip cache | Product lines play with no model delay | Disk space |
| Server-side recognition | One place for logic, any phone works | Needs a network. An estimate of 2 to 4 seconds from glance to voice, not measured yet. |
| Camera on for the session | Simple and reliable for the PoC | Battery: Meta states up to 30 minutes of streaming |

A handheld scanner reads a barcode in about a second. Glance is slower for each item. Its gain is free hands, no kiosk touchscreen, and no scanner to carry.

The pitch names what a product needs from the platform: a low-power wake signal, a sharp still in under a second, and general availability of Motion, Inputs, and Speech.

## 15. Verification

- Server: a replay tool sends saved frames to the recognition module and prints an accuracy table. Unit tests cover each rule in section 6.2. Replay recorded result sequences with gaps and changes, because live results flicker.
- Android: MockDeviceKit reaches each state in section 6.6. Unit tests replay recorded motion files against the gesture detector.
- Web: `BrowserBridge` and a debug panel that sends events.
- End to end on the glasses: the demo script in section 18, three clean runs in a row before the shoot.
- Numbers for the pitch: accuracy on 100 frames over all products with no wrong `identified`, time from glance to voice (median and 95th percentile at the venue), false yes and false no in the walk test, the distance at which the kiosk code decodes, battery after 10 minutes.

## 16. Probe results that switch the design

The probe of section 9.2 fills this table. Ask the Meta mentors at the venue first if a beta capability does not start.

| Probe | If it passes | If it fails |
|---|---|---|
| Motion, Inputs, and Speech start with app ID `0` | Use them | Create a project in the Wearables Developer Center, enable the capabilities, create a version, and invite the team to its release channel. Use the real app ID and client token. This needs a Meta developer account. |
| Motion starts (with or without a project) | Nod and shake as designed | The main yes is the double tap. If Inputs also fails, it is the volume keys. The pitch line becomes "glance tells, tap buys". The `gesture` field (thumbs up) is an experiment, not a plan. |
| Inputs starts | Double tap is a yes for a prompt, and "listen" at other times. Swipe repeats. | Volume keys: up is yes, down is no |
| Speech starts | Voice commands, and "Ask about a product" | A microphone button on the phone with the Android speech recognizer. If that fails, cut "Ask about a product". |
| A clip plays during the stream, and the frame size holds | As designed | Play speech on the phone speaker |
| Stream, Motion, and audio for 10 minutes | Plan the shoot from the battery number | Shoot in short takes. Keep the case near. |
| Gemini names 18 of the 20 saved frames | Text catalog in the prompt | Add reference photos to the prompt. Raise the media resolution. |
| The kiosk code decodes from a chair at 1.5 m | Kiosk as designed | A larger screen for the kiosk |

## 17. Timeline and seats

| Seat | Owns |
|---|---|
| 1 | Probe, Android shell, the glasses |
| 2 | Server, deployment, recognition tests |
| 3 | Phone UI, kiosk page, mirror page |
| 4 | Video, deck, website, demo store, catalog, tests on the glasses, HUD mockup |

| Time (Finnish) | Milestone |
|---|---|
| Friday night | Confirm that the preliminary submission of Friday 23:55 is in. Probe on the glasses, with any packaged products at hand for the 20 frames. Repository scaffold. Types in `packages/shared`. Server and domain answer with HTTPS. |
| Saturday morning | Seat 4 buys and fixes the 12 products. Probe results are in section 16. |
| Saturday 13:00 | M1: a glance speaks on the real glasses. If M1 is not reached by 14:00, only extras 1 to 3 stay. |
| Saturday 17:00 | M2: the core works end to end, with the kiosk. |
| Saturday 18:00 | Feature freeze. Only fixes after this point. |
| Saturday 18:00 to 21:00 | Shoot: the venue store first, then plain footage in a real store before it closes. |
| Sunday 02:00 | Video cut, website, deck. |
| Sunday 07:00 | Submit. One hour of buffer before the team deadline. |

The probe can take 3 to 5 hours, because the sample app of Meta covers only the stream and photos.

Time on the glasses is a budget. One charge gives about 30 minutes of stream. Keep a list of who holds the Gen 2 and when. Charge it in each break. Seats 2 and 3 use mock mode. Stream work that does not need the Gen 2 uses the Display.

## 18. Demo and video

Demo store: a table or shelf with about 12 real products, and the kiosk page on a laptop at seated eye height. The store name is "Demo Market". The mirror page runs on a second screen, so viewers hear and read the voice.

Main take, about 90 seconds:

1. Start: "Camera on." The capture LED is visible.
2. Glance at the oat drink. Hear name and price. Put it back on a low shelf. The cart does not change.
3. Glance at the rye bread. Nod. "Added rye bread."
4. Glance at a product. Shake. "Skipped." With the allergen guard, the voice gives the warning first.
5. Show the phone: captions and the cart.
6. Look at the kiosk. Hear the store and the total. Nod. The kiosk shows "Paid". "Camera off." The LED goes dark.

Separate shots, each on real hardware:

- Glasses off the face, then folded. The phone names each state. A fold ends the session, so the shot ends there.
- Two look-alike products, if extra 3 is done.

Fallbacks: mock mode with the phone camera if the glasses fail, labeled as a simulation, and a screen recording of the kiosk.

Honest lines for the pitch: the payment is a demo, the catalog has 12 products, and no blind shopper has tested it yet. If the team finds a blind or low-vision tester on Saturday, show that test. If not, name the next step: a test with the Finnish Federation of the Visually Impaired.

## 19. Challenge fit

A zero-context reviewer in the role of a Meta judge scored draft 1 at 6, 7, 5, and 8 out of 10, in the order of the table. The full review is in `docs/research/2026-11-13-reviews.md`.

| Criterion | Strength | Risk | What the PoC must show |
|---|---|---|---|
| Creativity and use case | An everyday task. The loop, the consent rule, and the touch-free kiosk are new together. | Recognition and QR payment exist as single features. | The full loop in one take |
| Technical execution | Real glasses, real recognition, real state handling | Beta capabilities, one pair of glasses | The separate state shots, and the measured numbers |
| Real-world value and feasibility | Retailers already run scan-as-you-shop. The store adds no camera. New self-service terminals in the EU must be accessible. | Battery of 30 minutes, few shoppers own the glasses, a catalog of 30,000 products, lent glasses do not fit prescription wearers | The pilot path: one retailer with scan-as-you-shop, for shoppers who own the glasses |
| Input, accessibility, and trust | Four inputs, six output channels, prompts bound to their target, no touchscreen, face blur, no stored frame | No test with disabled shoppers yet. The camera runs for the session. | The inputs table, the captions, and an honest statement of both gaps |

The questions that a judge will ask, with the answer that the design gives:

| Question | Answer |
|---|---|
| How do you tell look-alike products apart among 30,000? | Today the voice says that it cannot tell, and asks for the front. A still at higher resolution is the next step. A product uses the store catalog, the shelf position, and the 2D codes that GS1 plans for 2027. |
| A scanner is faster. Who is better off? | A shopper with full hands, and a shopper who cannot use the touchscreen. Section 14 states the speed cost. |
| How is a camera for the whole shop "deliberate"? | It is not. Section 13 states the gap and the platform request. |
| Is a bend to the low shelf a nod? | No. A nod must return to its start, and it counts only in the 8 seconds after a prompt. The walk test gives the number. |
| What did you learn that Meta does not know? | The measured numbers of section 15, on the public SDK, on real glasses. |

The challenge text uses the word "focused" two times. The pitch shows one use case. Transit and payments between people are one closing slide.

## 20. Risks

| Risk | Mitigation |
|---|---|
| The beta capabilities share one gate, and all fail in Developer Mode | The probe is the first task. Section 16 has the Developer Center path and the volume keys. Ask the Meta mentors. |
| Nobody has run the SDK on the glasses yet | The probe comes before all other work on seat 1 |
| The core does not fit in the time | Three steps (C1 to C3), three phone screens, one banner for all states, and the cut rule at M1 |
| Recognition results arrive late and flicker | Prompts with IDs, a yes bound to its prompt, the product name in each confirmation, replay tests with gaps |
| Gemini is slow or wrong on compressed frames | The test set from the probe. Reference photos. A closed catalog. |
| The venue network fails | A phone hotspot for the phone and the kiosk laptop |
| One pair of glasses, 30 minutes of stream for each charge | The glasses budget in section 17, mock mode, the Display as a second stream device |
| Astryx is in beta and new to the team | Stock theme, templates from the CLI, no custom theme |
| Eight extras in the plan | The order in section 5 and the cut rule at M1 |
| A false yes on camera | The head window, the return rule for a nod, the walk test, and the off switch |

## 21. Decisions by the author

The team did not decide these. Review them.

1. The stock theme is Neutral, because it is the most legible. Butter is a one-line change.
2. The Display HUD uses the Display toolkit, not Astryx. It is a mockup in the simulator, as the team first asked.
3. A nod or a shake counts for 8 seconds after a finished prompt, and only while the target is in view.
4. Each yes and each no carries the ID of the prompt that the shopper heard.
5. A phone button acts on its card, with no view test.
6. The standard glance line includes the pack size. Each confirmation names the product.
7. Face blur is in the core.
8. The answer for look-alike products is extra 3, above the HUD. The sharp second look is extra 9.
9. The camera stops after 3 idle minutes.
10. The kiosk code is a short text in a QR code, and it does not change in the PoC.
11. The mirror page is in the core, for judges and for the video.
12. The core phone UI has three screens. The practice round and the welcome screen wait.
13. The server sends events through a bus in the process. Atlas change streams are optional.
14. The phone UI is bundled in the APK and has no network code.
15. The payment is a mock, with a labeled receipt.
16. Voice commands work in the language of the glasses only. Italian changes the output.
17. If Motion and Inputs both fail, the volume keys of the phone are the yes and the no.
18. Product recognition uses a text catalog in the prompt first, and reference photos only if the test fails.
19. The pitch does not claim that the store installs nothing, or that the store lends glasses.

## 22. Left to the builder

- Gradle setup, library versions, and the code structure inside each module.
- The exact Astryx components and templates for each screen.
- The gesture algorithm and its thresholds.
- The wording of the Gemini prompts, within the schema.
- The sounds and the haptic patterns.
- The crop numbers and the sharpness measure.
- The layout of the website.

## 23. Inputs from the team

| Input | Needed for |
|---|---|
| Probe results (section 16) | The yes input and the voice features |
| A Meta developer account, if the probe needs a Developer Center project | The beta capabilities |
| The domain name | TLS and the web pages |
| The list of the 12 products with prices, with two look-alikes | The catalog and the prompt |
| The names for the four seats | The plan |
| The ElevenLabs voice for English and for Italian | Speech |
| Whether Meta mentors are at the venue | Risk handling |
| A blind or low-vision tester for Saturday, if the organizers can find one | The pitch and the accessibility claim |
