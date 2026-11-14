# Beat 2: Hero PoC - Hands-Free Grocery Shopping

- Presentation Timing: 0:30 - 1:15 (45 seconds)
- Spoken Word Budget: 99 words (~135 words per minute)
- Primary Artifact: Slide 2 and Raylight Video Scene 2
- Key Theme: The core interaction loop ("Glance tells, nod buys") operating on real Ray-Ban Meta Gen 2 glasses and self-checkout kiosks.

---

## 1. Interaction Protocol Architecture

The core protocol follows two strict rules:
1. **Glance tells, nod buys:** Looking at a product announces its identity and price. A glance never modifies the cart. A deliberate head nod is required to add the item.
2. **Context-bound consent:** An affirmative nod answers only the prompt just spoken, and is valid only while that product remains in view.

### Hardware Interface Honesty
- **Hardware Profile:** Ray-Ban Meta Gen 2 glasses. This device is audio-first (spatial open-ear audio, directional microphones, capture camera, head-motion IMU).
- **Visual Callout Rule:** Any graphical HUD overlays shown in the video and slides are explicitly labeled: **"Phone companion HUD / Audience visualization"**.
- **Display Transition:** When deployed on Meta Ray-Ban Display (`apps/display-pow`), this information renders directly in the user's in-lens display via `@wearables-ui-toolkit/mrbd`.

---

## 2. Slide 2 Layout and Visual Specification

- **Slide Title:** The Meta Glance Protocol: Glance Tells, Nod Buys
- **Visual Composition:**
  - *Center Diagram:* The 3-Beat Circular Loop:
    1. **1. Glance:** First-person vision recognition locks on the item in hand.
    2. **2. Tell:** Spatial audio whispers product name and price privately.
    3. **3. Nod:** Head nod adds item to cart; soft haptic earcon confirms.
  - *Bottom Section:* Dual Screen Integration:
    - *Left:* Phone Companion Mirror (live cart counter, price list, accessibility toggles). Labeled: "Audience visualization / Phone companion screen".
    - *Right:* Retail Kiosk Interface (live QR code session, itemized basket, instant settlement indicator).
- **Caption:** Tested on Ray-Ban Meta Gen 2 with thin-client Android DAT SDK integration.

---

## 3. Video Direction and Dual Sourcing

### Option A: Raylight Generative AI Scene Specification
- **Scene ID:** `scene_02_grocery_poc`
- **Time Window:** `00:30 - 01:15`
- **Camera Style:** First-person point of view (POV) with natural head movement.
- **Raylight Prompt:**
  `Cinematic first-person POV wearing Meta smart glasses inside a grocery aisle, picking up a carton of oat milk with one hand, subtle head stabilization, realistic grocery lighting, gentle audio waveform visualization overlay in bottom corner labeled Audience Visualization, subtle downward head nod camera dip, smooth HUD counter animation rolling from 0 to 1 item, walking up to a sleek self-checkout monitor displaying a crisp dynamic QR code, second downward nod, screen flashes soft green with Payment Complete, 4k 60fps photorealistic.`

### Option B: Real Hardware Testbed Recording Shot List
If splicing real footage from the hackathon testbed (`apps/server`, `apps/mobile`, and `apps/website`):
1. **Shot 2.1 (0:30 - 0:45):** Over-the-shoulder wide shot of the user wearing Ray-Ban Meta Gen 2 glasses, picking up a real catalog item (Oat Milk, 2.45 EUR). Split audio: captured earphone microphone playing the ElevenLabs voice response: "Oatly Oat Milk, 2.45 EUR".
2. **Shot 2.2 (0:45 - 0:58):** Close-up of user's head executing a crisp nod. Android phone on the table immediately triggers a soft audio chime, and the cart list updates to 1 item.
3. **Shot 2.3 (0:58 - 1:15):** User walks to laptop acting as the store kiosk (`apps/website`). Glasses look directly at the dynamic QR code on the screen. User nods. Laptop screen instantly transitions to "Payment Approved: 2.45 EUR".

---

## 4. Voiceover Script

> "Meet Meta Glance: our hands-free shopping protocol for Meta AI glasses. The rule is simple: glance tells, nod buys. You look at an item. The glasses immediately whisper the product name and price into your ear. A natural head nod confirms your purchase and adds it to your digital cart. Both hands stay completely free. At checkout, you walk up to a self-checkout kiosk, look at the dynamic QR code on the display, and nod once more. Payment settles instantly. No phones to unlock, no barcodes to search for, and no touchscreens to navigate. That is true hands-free utility."

*(Word count: 99 words)*

---

## 5. Presenter Live Speaker Notes

- Emphasize the core phrase: "Glance tells, nod buys." This slogan anchors the whole product philosophy.
- Explain that head gestures require zero hands, allowing a shopper to pack bags continuously while scanning.
- Highlight the kiosk handoff: glancing at the QR code pairs the glasses cart with the store terminal instantly, making self-checkout faster than traditional barcode scanners.
- Clarify that Gen 2 glasses use private open-ear audio, keeping financial transactions discreet.

---

## 6. Agent Retrieval Context

- **Core interaction law:** "Glance tells, nod buys" (glance identifies, nod confirms).
- **PoC target:** Grocery retail checkout.
- **Hardware:** Ray-Ban Meta Gen 2 (audio-first) with Android DAT SDK.
- **Display disclaimer:** Any visual graphic is an audience visualization or phone companion mirror.
- **Backend services:** Fastify vision pipeline, Gemini recognition, ElevenLabs low-latency voice, MongoDB Atlas live cart sync.
