# Meta Glance: Judge Q&A Defense and Objection Handling

This handbook provides direct, authoritative answers to critical technical, privacy, and business questions during the HackJunction 2026 judging panel.

---

## 1. Interaction and False-Trigger Objections

### Q1: What prevents accidental head nods from adding unwanted items to the cart or triggering payments while the user is talking?
**Answer:**
A nod is never evaluated in a vacuum. Two strict preconditions must be met before the system listens for head motion:
1. **Active Optical Gaze Lock:** The item (or kiosk QR code) must be centered in the camera frame and recognized within the last 3.0 seconds.
2. **Synchronous Prompt State:** The nod only counts as consent within a 15-second response window immediately following an active audio announcement (e.g. "Honeycrisp Apple, 1.20 EUR").
If the shopper turns their head to converse with someone, the product leaves the field of view, the state immediately resets, and any head motion is ignored. Furthermore, the nod detector requires a distinct pitch acceleration profile (2.0 to 4.5 rad/s downwards followed by a damped return) that distinguishes deliberate affirmation from natural conversational cadence.

### Q2: What prevents the neural wristband from mistaking a fist bump, high-five, or picking up a bag for a payment handshake?
**Answer:**
Handshake authorization requires three simultaneous signals across different physical layers:
1. **BLE Proximity Bounding:** The recipient's encrypted BLE beacon must register an RSSI stronger than -65 dBm (strictly within 1.0 meter).
2. **Gaze Vector Alignment:** The glasses forward camera must confirm the peer's face in the center visual cone.
3. **Multi-Channel sEMG Profile:** The classifier detects the specific muscular signature of an extended-hand grasp: Extensor Digitorum activation followed by sustained co-contraction of the flexor muscle groups (350 ms to 900 ms) paired with subtle vertical acceleration (0.3g to 0.8g).
A fist bump produces an instant high-g shock without sustained isometric grip; a high-five lacks grip co-contraction; and carrying a bag lacks the preceding finger-extension and handshake cadence.

---

## 2. Technical Performance and Vision Objections

### Q3: Ray-Ban Meta video streaming is capped at 720p with compression. Can computer vision reliably recognize grocery items without barcodes?
**Answer:**
Yes. Meta Glance does not attempt to read tiny barcode stripes from compressed 720p video frames. Instead, we use a hybrid multi-modal recognition pipeline:
1. **Macro Visual Packaging:** Gemini 2.0 Flash recognizes packaging color schemes, typography, logos, and container silhouettes.
2. **Edge Crop Optimization:** When an item is held steadily in view, the Android client extracts an uncompressed native crop centered on the product, filtering out background aisle clutter before network transmission.
3. **Store Catalog Constraining:** Vision embeddings are matched against the local store catalog inventory for that specific aisle, reducing the candidate search space from millions of SKUs to several dozen.
4. **Honest Doubt Reporting:** If recognition confidence is below 85 percent, the voice prompt explicitly asks for clarification rather than guessing (e.g. "Is that 1.5 percent or whole milk?").

### Q4: How does the system handle dark aisles, motion blur, or reflective packaging?
**Answer:**
If the camera detects low illumination (< 50 lux) or high motion blur, the system:
1. Pauses processing and guides the user via private audio: "Hold steady for a moment" or "Adjust toward light".
2. Increases camera sensor gain dynamically via the DAT SDK camera parameters.
3. Provides an instant fallback: the user can tap the glasses temple touchpad or swipe the phone screen to scan via the phone's native flash camera or enter a numeric PLU code.

---

## 3. Privacy, Trust, and Bystander Protection

### Q5: Doesn't wearing live camera glasses in a supermarket violate customer privacy and Meta's acceptable use policies?
**Answer:**
Meta Glance is designed around Meta's explicit wearable policy ("Deliberate, not ambient; narrow purpose, short retention, obvious to bystanders"):
1. **On-Device Face Blurring:** The Android client runs an on-device lightweight face detector that blurs bystander faces in volatile memory before any frame leaves the device.
2. **Zero Cloud Video Retention:** Our backend server stores zero camera frames or video streams. Once the vision model extracts product identification and price, the image bytes are discarded from RAM.
3. **Bystander Transparency:** The Ray-Ban Meta hardware capture LED remains illuminated continuously during active vision sessions, signaling recording status to bystanders.
4. **Deliberate Session Activation:** The camera does not stream continuously throughout the day; it streams only during an active shopping session initiated deliberately by the user.

---

## 4. Security, Fraud, and Relaying

### Q6: Can an attacker stand near a user in a crowded subway and steal 50 EUR via BLE proximity?
**Answer:**
No. Proximity alone cannot trigger a transfer. A transaction requires:
1. **Physical Gaze Lock:** The sender must look directly at the recipient's face to trigger the in-lens payment prompt.
2. **Physical Neuromuscular Handshake:** Both participants must physically shake hands, generating reciprocal sEMG activation signatures within 150 ms of each other.
3. **Time-Bounded Nonce Exchange:** Both devices negotiate mutual cryptographic nonces that expire within 2 seconds. An attacker eavesdropping or standing nearby cannot generate the reciprocal muscular handshake clasp.
4. **Regulatory Contactless Cap:** Payments are hard-capped at 50.00 EUR per transaction, with cumulative limits requiring phone biometric confirmation per EU PSD2 standards.

---

## 5. Business Feasibility and Retail Adoption

### Q7: Why would a supermarket chain partner with Meta Glance instead of building their own phone app?
**Answer:**
Supermarkets already built phone apps (e.g. S Group "Kerää ja skannaa", Coop Salvatempo), but phone apps suffer from inherent physical friction:
1. **Shoppers hate holding phones:** Holding a basket, checking items, and holding a phone leads to dropped groceries and slower shopping trips.
2. **Zero Store Retrofit:** Retailers do not need to install ceiling cameras, shelf sensors, or new hardware. They only render a dynamic QR code on existing NCR or Diebold Nixdorf checkout monitors.
3. **Accessibility Compliance:** European retailers face strict mandates under the European Accessibility Act by 2025/2026 to make self-service terminals accessible. Meta Glance offers supermarkets an immediate software path to compliance without replacing multimillion-dollar checkout hardware.
