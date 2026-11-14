# Meta Glance: Master Pitch Deck (3-Minute Presentation)

- Event: HackJunction 2026, Meta Challenge ("AI Glasses for Everyone, Everyday")
- Duration: Strictly 3 minutes (180 seconds)
- Format: 5 presentation slides, high-contrast typography, clear visual hierarchy
- Aligned Script: [`00-master-script.md`](00-master-script.md)

---

## Slide 1: Everyday Friction: Hands Are Full, Tech Is Not Helping

- **Timing:** 0:00 - 0:30 (30 seconds)
- **Primary Visual:** Split-screen contrast. Left: First-person photo of a shopper struggling to pull a smartphone from a pocket while holding a grocery basket. Right: High-contrast callout boxes detailing retail friction.

### Slide Content
- **Headline:** Physical tasks demand our hands. Our devices demand them too.
- **The Retail Strain:**
  - Juggling baskets, dropped items, and smartphone barcode alignment.
  - Scan-as-you-shop requires 4 manual actions per product.
- **The Accessibility Barrier:**
  - 83 percent of visually impaired consumers cannot read food packaging labels.
  - Self-checkout kiosks feature flat touchscreens without tactile or speech guidance.
- **The Infrastructure Dead End:**
  - Overhead ceiling cameras (Amazon Just Walk Out) cost hundreds of thousands of dollars per store and suffer high error rates.
- **Core Takeaway:** Wearables must free our hands, not mirror our phone screens.

### Presenter Notes
"Welcome. We all know the physical frustration of grocery shopping with our hands full: holding a basket, balancing items, and fumbling for a phone to scan a barcode. For millions of blind and motor-impaired people, this is not an inconvenience; it is total exclusion. Retailers spent fortunes trying to solve this with ceiling camera grids, but the economics collapsed. Today, we show how smart glasses solve this without rebuilding the store."

---

## Slide 2: The Meta Glance Protocol: Glance Tells, Nod Buys

- **Timing:** 0:30 - 1:15 (45 seconds)
- **Primary Visual:** 3-beat circular product loop diagram (Glance, Tell, Nod) flanked by live screenshots of the kiosk screen and the phone companion mirror.

### Slide Content
- **Headline:** Hands-free shopping on Ray-Ban Meta glasses: Glance tells, nod buys.
- **The 3-Beat Interaction Loop:**
  1. **Glance:** First-person computer vision identifies the held product.
  2. **Tell:** Private spatial audio announces the product name and price.
  3. **Nod:** A natural head nod adds the item to the digital cart.
- **Zero-Friction Checkout:**
  - Walk to any self-checkout monitor.
  - Glance at the dynamic session QR code and nod once to settle payment.
- **Hardware Integration:**
  - Native Android app using Meta Device Access Toolkit (DAT SDK).
  - Open-ear spatial audio via Ray-Ban Meta Gen 2.
  - Fast vision recognition via Gemini and ElevenLabs voice synthesis.
- **Visual Callout:** *(Graphic overlays are audience visualizations; the Gen 2 experience is private spatial audio).*

### Presenter Notes
"This is Meta Glance. Our protocol is anchored by one rule: glance tells, nod buys. You look at an item. Your glasses instantly whisper the name and price in your ear. A natural head nod adds it to your cart. Your hands never leave your groceries. When you finish, you walk to a self-checkout monitor, look at the screen QR code, and nod once more. Payment settles instantly. No barcode hunting, no touchscreens, no dropped groceries."

---

## Slide 3: Why Meta Wins: 0 to 1 in Days, Zero Store Retrofits

- **Timing:** 1:15 - 1:55 (40 seconds)
- **Primary Visual:** Side-by-side comparison table contrasting Amazon Just Walk Out ceiling cameras with Meta Glance's software-only deployment.

### Slide Content
- **Headline:** Immediate retail rollout without physical store modifications.
- **Deployment Comparison:**

| Metric | Store Ceiling Cameras (Amazon) | Meta Glance |
|---|---|---|
| Infrastructure Cost | 100k+ USD per store | Zero hardware cost for the retailer |
| Installation Time | 3 to 6 months per store | Under 1 day (web or API kiosk integration) |
| Compute Model | Centralized heavy servers | Distributed edge (wearable + smartphone) |
| Store Maintenance | Continuous sensor calibration | Standard existing POS monitor maintenance |
| Customer Privacy | Overhead tracking of all patrons | Local face blurring, zero stored camera frames |

- **Key Takeaway:** Amazon tried to make the store smart. Meta makes the shopper empowered.

### Presenter Notes
"Why does Meta win this space? Velocity. Supermarkets operate on 1 to 3 percent margins. They cannot afford to spend six figures outfitting ceiling cameras in every aisle. Meta Glance requires zero store modifications. Retailers already have self-checkout monitors: they simply render our dynamic QR code. Customers already own Ray-Ban Meta glasses. By putting the perspective on the shopper, Meta can turn every supermarket into a cashierless experience in a matter of days."

---

## Slide 4: The Future Horizon: Social Hands-Free Commerce

- **Timing:** 1:55 - 2:35 (40 seconds)
- **Primary Visual:** Three-tier architectural diagram: BLE proximity field, Meta Display in-lens HUD, and neural wristband sEMG forearm clasp visualization.

### Slide Content
- **Headline:** Scaling beyond retail: Peer money exchange with neural band micro-gestures.
- **The Peer Handshake Protocol:**
  - **Proximity:** Encrypted BLE beacons discover mutual presence at under 1 meter.
  - **Intent:** Gaze orientation locks recipient identity in the Meta Display in-lens HUD.
  - **Confirmation:** Meta Display neural wristband detects the neuromuscular sEMG signature of a physical handshake clasp to authorize payment.
- **Everyday Applications:**
  - Splitting bills with friends via a natural greeting handshake.
  - Glance-to-pay at transit turnstiles and coffee counters.
  - Micro-gestures replacing touchscreen taps across daily life.

### Presenter Notes
"Grocery shopping is only the beginning. Meta Glance provides a foundational hands-free interaction language for spatial computing. Consider peer payments. You step up to a friend; Bluetooth beacons detect mutual proximity. Looking at them highlights their name in your Meta Display in-lens HUD. Then, as you shake hands, Meta's neural wristband detects the muscular clasp of your handshake, confirming the transfer. We take humanity's oldest social agreement gesture and turn it into secure, hands-free commerce."

---

## Slide 5: Inclusive by Design: Trusted, Accessible, and Pilot-Ready

- **Timing:** 2:35 - 3:00 (25 seconds)
- **Primary Visual:** Three core pillars: Universal Accessibility, Privacy Architecture, and Team Retail Pilot Roadmap.

### Slide Content
- **Headline:** Built for everyone: WCAG 2.2 compliant and ready for store pilots.
- **Accessibility Guarantee:**
  - Exceeds WCAG 2.5.4: Every head nod has redundant voice, temple tap, and smartphone inputs.
  - Enables fully independent shopping for blind and low-vision customers.
  - Aligned with the mandatory European Accessibility Act (EAA).
- **Privacy Architecture:**
  - On-device real-time face blurring for bystander protection.
  - Zero raw video frames stored on cloud servers; strict ephemeral processing.
- **The Ask:**
  - Seeking a live retail pilot with Meta and European supermarket chains.
  - Functional prototype ready for testing at the Meta Developer Forum.

### Presenter Notes
"Meta Glance was designed from day one to be accessible. Every single gesture has redundant voice, touch, and phone inputs, complying fully with WCAG 2.2 and the European Accessibility Act. We blur bystander faces in real time and store zero video frames. We have built a working prototype in 36 hours. We are ready to pilot Meta Glance in European stores. Let us make wearable AI hands-free, natural, and built for everyone."
