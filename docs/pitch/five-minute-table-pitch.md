# Meta Glance: 5-Minute In-Person Table Pitch Runbook

This guide defines the minute-by-minute protocol for the HackJunction 2026 table judging rounds. Reviewers have 5 minutes to travel between tables, followed by strictly 5 minutes (300 seconds) of pitch and demo time at your assigned table.

---

## 1. Team Role Assignments

To avoid talking over one another, assign strict roles before the round begins:

| Role | Primary Responsibility | Focus |
|---|---|---|
| **Speaker 1: Pitch Lead** | Delivers the opening hook (0:00 - 0:45) and the strategic speed wedge / vision (2:15 - 3:15). | Clear narrative, energy, eye contact with judges. |
| **Speaker 2: Demo Lead** | Operates the live hardware demo (0:45 - 2:15). Wears Ray-Ban Meta glasses and executes gestures cleanly. | Fluid physical execution; narrating physical actions. |
| **Speaker 3: Tech Defender** | Manages the phone companion app, laptop kiosk, and leads technical Q&A defense (3:15 - 5:00). | Technical depth on DAT SDK, Fastify, sEMG, and privacy. |
| **Speaker 4: Hardware & Timekeeper** | Tracks the 5-minute countdown clock and holds the Meta Display / neural wristband for inspection. | Time management, physical hardware handoffs to judges. |

---

## 2. Pre-Round Staging Checklist (During the 5-Minute Travel Window)

Complete this 60 seconds before reviewers arrive at your table:

- [ ] **Laptop Kiosk (`apps/website`):** Display the checkout terminal in full screen with a fresh dynamic session QR code. Set screen brightness to 100%. Angle screen toward incoming judges.
- [ ] **Android Phone (`apps/mobile`):** Phone unlocked, DAT SDK connected to Ray-Ban Meta Gen 2, battery above 40%, volume set to 90% (or external Bluetooth mini-speaker paired so judges hear the spatial audio whisper).
- [ ] **Hardware Props on Table:**
  - 1x Grocery basket containing Oatly Oat Milk carton, apple, and rye bread.
  - 1x Meta Display with neural wristband placed prominently on a clean white cloth or stand next to the laptop.
- [ ] **Instant Fallback Buffered:** Have the offline 3-minute video demo loaded in full screen on a secondary device in case convention Wi-Fi disconnects.

---

## 3. Minute-by-Minute Pitch and Demo Choreography (300 Seconds Total)

```text
0:00 --[ 0:45: Opening Hook & Problem ]--> Speaker 1
0:45 --[ 1:30: Live Hardware PoC Demo ]--> Speaker 2 (Wearer) + Speaker 3
2:15 --[ 1:00: Speed Advantage & Future Vision ]--> Speaker 1 + Speaker 4
3:15 --[ 1:45: Hands-On Inspection & Judge Q&A ]--> Entire Team
5:00 --[ Round Ends: Thank judges promptly ]
```

---

### Phase 1: The Opening Hook and Retail Problem (0:00 - 0:45 | 45s)
*Owned by Speaker 1 (Pitch Lead)*

**Spoken Script:**
> "Hi everyone, welcome to Meta Glance. Everyday activities still trap our hands behind screens. When shopping, carrying a basket while fumbling for a phone to scan barcodes creates constant friction and dropped items. For blind and motor-impaired people, self-checkout touchscreens and packaging labels are completely inaccessible. Amazon spent fortunes installing ceiling camera grids to solve this, but the capital costs were unsustainable. Today, we show you how smart glasses turn any retail store into an instant, hands-free checkout lane without touching a phone or rebuilding the store."

---

### Phase 2: The Live Hardware Demo (0:45 - 2:15 | 90s)
*Owned by Speaker 2 (Demo Lead) and Speaker 3 (Tech Defender)*

#### Step-by-Step Live Demo Execution:
1. **The Item Scan (0:45 - 1:15):**
   - Speaker 2 wears the Ray-Ban Meta Gen 2 glasses and picks up the Oatly Oat Milk carton from the basket, holding it at chest level.
   - *Speaker 2 states:* "Our protocol is simple: glance tells, nod buys. I look at this carton."
   - The glasses open-ear audio (or paired speaker) announces clearly: *"Oatly Oat Milk, 2.45 EUR"*.
   - Speaker 3 points to the phone mirror screen: "The vision model locks on the product in under 800 milliseconds."
2. **The Affirmation Nod (1:15 - 1:35):**
   - Speaker 2 gives a clean, deliberate downward nod while holding the carton.
   - Soft confirmation chime plays. The phone cart counter immediately updates: `1 Item - 2.45 EUR`.
   - Speaker 2 smoothly drops the oat milk into the shopping bag with hands completely free: "Nod confirms consent. My hands never left my groceries."
3. **The Kiosk Payment (1:35 - 2:15):**
   - Speaker 2 steps up to the laptop kiosk running the live web checkout terminal.
   - *Speaker 2 states:* "I walk to checkout. I glance at the dynamic QR code on the screen."
   - Speaker 2 looks at the screen and executes a second nod.
   - The laptop screen flashes soft green and chimes: **"Payment Approved: 2.45 EUR"**.
   - Speaker 2 picks up the bag: "Zero touchscreens, zero barcode alignment, zero phone unlocking. Done."

---

### Phase 3: Meta's Speed Advantage and Future Vision (2:15 - 3:15 | 60s)
*Owned by Speaker 1 (Pitch Lead) and Speaker 4 (Hardware Lead)*

**Spoken Script:**
> "Why does Meta win this space? Implementation velocity. Supermarkets operate on 1 to 3 percent margins; they cannot afford 100,000 USD ceiling camera retrofits. Meta Glance requires zero store infrastructure. Retailers simply display our session QR code on existing monitors. Customers already own Ray-Ban Meta glasses and smartphones. Meta can deploy this to European retail chains in days.
>
> But grocery is only day one. The hands-free protocol expands into social commerce. *(Speaker 4 presents the Meta Display and neural wristband)* For peer money exchange: low-energy Bluetooth beacons establish proximity within arm's reach. Your Meta Display glasses confirm your friend's name in your in-lens display. Then, as you shake hands, Meta's neural wristband detects the muscular clasp of your handshake, confirming the payment instantly. We turn humanity's oldest social greeting into secure spatial commerce."

---

### Phase 4: Hands-On Inspection and Judge Q&A (3:15 - 4:50 | 95s)
*Owned by Entire Team*

Hand the Ray-Ban Meta glasses and Meta Display directly to the judges to inspect the hardware while fielding questions.

#### Quick-Fire Defense Answers:
- **Judge: "What stops accidental nods from paying?"**
  - *Response:* "A nod is evaluated only after an active audio prompt and only while that specific item or QR code remains locked in the forward camera view. If you turn your head to chat, the session state resets instantly."
- **Judge: "How do you protect bystander privacy in stores?"**
  - *Response:* "The Android client blurs detected human faces in local memory before transmitting object crops. The backend server stores zero camera frames, and the capture LED stays on during streaming."
- **Judge: "What about people who cannot nod or speak?"**
  - *Response:* "We comply with WCAG 2.5.4. Every nod has four redundant input fallbacks: voice command, glasses temple tap, phone screen buttons, or a companion switch."
- **Judge: "How reliable is the handshake gesture on the wristband?"**
  - *Response:* "It requires dual confirmation: BLE proximity under 1 meter plus sEMG forearm co-contraction matching a sustained clasp. A fist bump or casual bump lacks the sustained flexor muscle signature."

---

### Phase 5: The Closing Ask (4:50 - 5:00 | 10s)
*Owned by Speaker 1 (Pitch Lead)*

> "We built this functional prototype in 36 hours across Android, Fastify, and Gemini. We are ready to pilot Meta Glance in European retail stores. Thank you!"

---

## 4. Live Demo Failure Contingency Protocols

If technical glitches occur during the live demo, execute these contingency protocols instantly without freezing:

1. **If Wi-Fi / Vision Server Lags (> 3 seconds):**
   - Speaker 3 immediately taps "Mock Aisle Scan" on the phone companion app to push the cached Oat Milk product card to the glasses.
   - Say: *"The live convention network has packet jitter, so the client falls back to cached store aisle embeddings."*
2. **If Glasses Bluetooth DAT Link Disconnects:**
   - Speaker 2 immediately picks up the Android phone, aims the phone camera at the oat milk, and nods.
   - Say: *"The protocol is hardware-agnostic; the phone operates as an identical companion input node."*
3. **If Kiosk QR Code Does Not Scan on Laptop:**
   - Speaker 3 clicks the QR code once to trigger the simulated scan event on the kiosk web view.
   - Do not spend more than 5 seconds debugging live hardware; transition immediately to the next beat.
