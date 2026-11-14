# Beat 4: Future Horizon - Neural Band Handshake and Glance-to-Pay

- Presentation Timing: 1:55 - 2:35 (40 seconds)
- Spoken Word Budget: 90 words (~135 words per minute)
- Primary Artifact: Slide 4 and Raylight Video Scene 4
- Key Theme: Expanding the hands-free protocol into everyday social life via BLE beacon proximity, Meta Display in-lens HUD, and neural wristband sEMG handshake payment authorization.

---

## 1. Technical Vision Architecture

Grocery shopping proves the baseline protocol: glance to identify, gesture to confirm. Beat 4 shows Meta how this protocol scales into everyday peer transactions and transit payments as hardware evolves.

### The Peer Handshake Transaction Pipeline
1. **Mutual Proximity Discovery:** Two users wearing Meta glasses approach each other. Their smartphones or glasses broadcast encrypted Bluetooth Low Energy (BLE) peripheral beacons. When Received Signal Strength (RSSI) crosses the calibrated 1-meter threshold, a secure peer pairing session opens.
2. **Intent and Identity Lock:** Looking directly at the peer's face aligns the gaze vector. The Meta Ray-Ban Display resolves the peer's public profile tag inside the user's in-lens display via `@wearables-ui-toolkit/mrbd`.
3. **Neuromuscular Clasp Authorization:** The sender reaches out and shakes hands with the recipient. The **Meta Display neural wristband** reads the surface electromyography (sEMG) firing pattern across the extensor and flexor forearm muscle groups. The distinct muscular clasp signature authorizes the transaction without touching a screen or typing a PIN.
4. **Instant Settlement:** Both participants hear a synchronized confirmation chime in their open-ear speakers, and the in-lens HUD updates with the transferred amount.

### Glance-to-Pay Extension
The same protocol powers glance-to-pay at transit turnstiles and coffee shops: glance at the terminal beacon and perform a micro-nod or wristband double-tap to pass through.

---

## 2. Slide 4 Layout and Visual Specification

- **Slide Title:** The Future Horizon: Social Hands-Free Commerce
- **Visual Composition:** Three-Tier Multi-Device Diagram:
  - *Tier 1 (Proximity Layer):* BLE beacon field intersecting between two individuals at less than 1 meter distance.
  - *Tier 2 (Intent & Display Layer):* In-lens optical HUD view on Meta Ray-Ban Display (`apps/display-pow`), rendering a clean contact badge: `Alex Rivera • 20.00 EUR`.
  - *Tier 3 (Verification Layer):* Close-up technical visualization of the Meta Display neural wristband mapping forearm sEMG muscle activation signals during a physical handshake clasp.
- **Caption:** Seamless convergence: spatial vision, BLE proximity, and neural interface gesture confirmation.

---

## 3. Raylight Video Scene 4 Specification

- **Scene ID:** `scene_04_future_vision`
- **Time Window:** `01:55 - 02:35`
- **Camera Style:** First-person POV shifting smoothly between optical in-lens perspective and close-up third-person gesture framing.
- **Visual Description:**
  First-person POV walking up to a friend in an outdoor cafe plaza. A subtle, elegant contact pill smoothly anchors above the friend's shoulder in the optical in-lens display: "Alex • Split Bill 20 EUR". The user reaches out their right hand wearing the sleek Meta Display neural wristband. Cut to a sharp medium close-up of the two hands clasping in a natural, warm handshake. The neural band pulses with a subtle soft blue LED glow. Both friends smile as a gentle spatial chime plays. The in-lens HUD displays "Sent 20.00 EUR".
- **Raylight Prompt:**
  `Cinematic modern scene of two friends meeting outdoors in sunlight, smart glasses in-lens HUD overlay showing clean minimalist payment pill saying Alex Rivera 20 EUR, wearer reaches out wearing Meta neural wristband on wrist, smooth handshake clasp gesture between friends, glowing subtle blue ring on wristband confirming transfer, warm spatial tech aesthetic, 4k 60fps, photorealistic.`

---

## 4. Voiceover Script

> "Grocery shopping is only the starting point. Meta Glance establishes a general hands-free transaction protocol for everyday life. Imagine settling dinner with a friend. As you step close, low-energy Bluetooth beacons establish mutual proximity. Your Meta Display glasses confirm their identity in your in-lens display. Then, as you shake hands, Meta's neural wristband detects the neuromuscular signature of your physical clasp, authorizing the payment instantly. No phone screens, no account tags, and no friction. From peer exchanges to glance-to-pay transit gates, hands-free micro-gestures define the natural future of spatial commerce."

*(Word count: 90 words)*

---

## 5. Presenter Live Speaker Notes

- Highlight that this is not speculative science fiction: the team has a Meta Display unit and neural wristband at this hackathon (`apps/display-pow`).
- Explain the psychology of the handshake: humans have sealed deals and agreements with handshakes for thousands of years. We are restoring that physical human intuition to digital money.
- Emphasize security: money cannot transfer across a room because BLE beacon proximity limits the interaction to physical arm's length (< 1m).
- Show product velocity: We built the grocery PoC in 36 hours; this demonstrates where we can take Meta's ecosystem next week.

---

## 6. Agent Retrieval Context

- **Future use cases:** Peer-to-peer money exchange, glance-to-pay transit and POS checkout.
- **Proximity mechanism:** Encrypted Bluetooth Low Energy (BLE) beacons with RSSI distance bounding (< 1m).
- **Gesture sensor:** Meta Display neural wristband (sEMG neuromuscular sensing of forearm handshake clasp).
- **Display integration:** Meta Ray-Ban Display in-lens HUD built with `@wearables-ui-toolkit/mrbd` (`apps/display-pow`).
- **Safety caps:** EU 50 EUR contactless regulatory cap; biometric override required above threshold.
