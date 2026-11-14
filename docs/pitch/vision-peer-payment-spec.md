# Specification: Peer-to-Peer Money Exchange via BLE Proximity and Neural Wristband Handshake

- Document Status: Engineering Vision Specification
- Systems Affected: Meta Ray-Ban Display (`apps/display-pow`), Meta Neural Wristband, Companion Android App (`apps/mobile`), Backend Relay (`apps/server`)
- Compliance Scope: PSD2 / European Banking Authority contactless transaction guidelines, WCAG 2.2 accessibility standards

---

## 1. Executive Summary

This document defines the technical architecture for hands-free peer-to-peer money exchange. The system combines:
1. **Bluetooth Low Energy (BLE) proximity beacons** to bound mutual physical presence within arm's reach (< 1.0 meter).
2. **First-person gaze alignment and in-lens HUD rendering** on Meta Ray-Ban Display to resolve and visually confirm the intended recipient.
3. **Surface Electromyography (sEMG) neuromuscular gesture detection** via the Meta Display neural wristband to verify the physical handshake clasp as the cryptographic authorization token.

---

## 2. Multi-Layer Interaction Architecture

```text
[ Sender: Meta Glasses + Phone ]                [ Recipient: Meta Glasses + Phone ]
               |                                               |
               |--- 1. BLE Ephemeral Advertising Beacon ------>|
               |<-- 2. BLE Proximity Handshake (RSSI > -65dBm)-|
               |                                               |
   [ Gaze Vector Locks on Peer ]                               |
   [ In-Lens HUD: "Alex - 20 EUR" ]                            |
               |                                               |
   [ Physical Handshake Clasp Occurs between Sender & Recipient ]
               |                                               |
   [ Neural Wristband detects sEMG ]               [ Neural Wristband detects sEMG ]
   [ Co-contraction signature ]                    [ Reciprocal clasp signature ]
               |                                               |
               |--- 3. Mutual Cryptographic Clasp Token ------>|
               |<-- 4. Signed Session Acknowledgment ---------|
               |                                               |
   [ Audio Chime + HUD Update ]                    [ Audio Chime + HUD Update ]
   [ "20.00 EUR Sent" ]                            [ "20.00 EUR Received" ]
```

---

## 3. Subsystem Specifications

### 3.1 Proximity Layer (BLE Beacon Protocol)
- **Peripheral Advertising & Central Scanning:**
  - Both devices continuously advertise a standardized 128-bit Meta Glance Exchange Service UUID (`7b2e9c10-0a3f-4e8b-b6d2-9f3a1e4c7d01`).
  - The advertising payload contains an ephemeral 16-byte rotating token derived from the user's payment identifier using HMAC-SHA256, regenerated every 15 minutes to prevent tracking by third-party sniffers.
- **Distance Bounding via Calibrated RSSI:**
  - Raw RSSI samples are captured at 10 Hz and processed through a 5-sample rolling median filter to suppress multipath fading.
  - **Proximity Gate:** A session initializes only when the filtered RSSI exceeds `-65 dBm`, corresponding to physical proximity within 1.0 meter. If RSSI drops below `-72 dBm`, the transaction session aborts immediately.

### 3.2 Intent Layer (Gaze Alignment and In-Lens MRBD HUD)
- **Gaze and Head Vector Tracking:**
  - The glasses forward camera and IMU verify that the user's head orientation vector points toward the peer's torso/face within a cone of +/- 15 degrees.
  - A person-presence detector on the smartphone confirms human presence in the center frame.
- **In-Lens MRBD Display Interface (`apps/display-pow`):**
  - Built using `@wearables-ui-toolkit/mrbd`.
  - State Progression:
    - *Proximity Detected:* A subtle pill anchors in the upper peripheral visual field: `Alex Rivera (Nearby)`.
    - *Amount Set:* Spoken via voice or pre-set in settings: `Send 20.00 EUR`.
    - *Action Prompt:* `Ready: Shake hands to confirm`.
    - *Success State:* Green confirmation checkmark with text `20.00 EUR Sent`.

### 3.3 Gesture Layer (Meta Display Neural Wristband sEMG Sensing)
- **Sensor Array:** 8-channel surface electromyography (sEMG) sensor array encircling the distal forearm, sampling at 100 Hz.
- **Target Musculature:**
  - *Extensor Digitorum Communis:* Fires during finger extension as the hand opens to initiate a handshake.
  - *Flexor Carpi Radialis & Flexor Digitorum Superficialis:* Co-contract during the isometric grasp and pressure phase of the handshake clasp.
- **Signal Processing & Feature Extraction:**
  - 100 Hz raw differential signals pass through a 20 Hz to 450 Hz digital bandpass filter and a 50 Hz notch filter (mains hum suppression).
  - Sliding 50 ms Root-Mean-Square (RMS) energy envelopes are computed across all 8 channels.
- **Gesture Classification Profile:**
  - A handshake gesture is confirmed when:
    1. Channel RMS energy across flexor groups rises above the 3.5x resting baseline threshold within a 150 ms rise-time window.
    2. The co-contraction state sustains between 350 ms and 900 ms (the natural duration of an intentional handshake clasp).
    3. Concurrently, the IMU on the wristband detects 2 to 3 vertical acceleration oscillations (1.5 Hz to 3.0 Hz, peak amplitude between 0.3g and 0.8g).
  - *Distinction from other gestures:*
    - *Fist bump:* Produces an abrupt axial impact shock (> 2.0g) without sustained flexor co-contraction.
    - *High-five:* Exhibits high-velocity open-palm deceleration without subsequent isometric grasp.
    - *Typing or drinking:* Lacks simultaneous multi-channel flexor recruitment and vertical periodic oscillation.

---

## 4. Security, Fraud Prevention, and Regulatory Bounds

### 4.1 Contactless Payment Regulatory Cap
Under European Union PSD2 contactless payment standards:
- **Unauthenticated Cap:** Transactions executed purely via proximity and handshake gesture are capped at **50.00 EUR**.
- **Cumulative Threshold:** If cumulative contactless transactions exceed 150.00 EUR or 5 consecutive transactions without strong customer authentication (SCA), the phone companion app requires biometric authorization (fingerprint or facial scan) before the next gesture authorizes payment.
- **Amounts above 50.00 EUR:** The in-lens HUD instructs: `Confirm on phone (Biometric Required)`.

### 4.2 Anti-Relay and Replay Protections
- **Mutual Nonce Exchange:** When BLE proximity is established, both devices exchange cryptographically random 32-byte nonces.
- **Time-Bounded Window:** The signed transaction package must be submitted within 2.0 seconds of the neural band clasp event. Late packages are rejected by the backend relay.
- **Dual-Party Mutual Detection:** The transaction requires reciprocal detection: Sender's band registers an outgoing handshake clasp while Recipient's band registers an incoming handshake clasp within a +/- 150 ms synchronization window.

### 4.3 Cancellation and Fallback Mechanisms
- **Timeout:** If no handshake occurs within 15 seconds of gaze lock, the transaction session terminates automatically.
- **Manual Abort:** A quick double head-shake or a single tap on the glasses temple touchpad cancels the pending exchange.
- **WCAG Accessibility Fallback:** Users with motor or upper-limb differences can confirm the transaction via spoken voice phrase ("Confirm 20 EUR") or via a single swipe on the smartphone companion app.

---

## 5. Implementation Roadmap for Hackathon Testbed

| Phase | Milestone | Component |
|---|---|---|
| Phase 1 (Today) | BLE advertising and RSSI proximity bounding demo | `apps/mobile` (Android BLE scanner) |
| Phase 2 (Today) | In-lens confirmation HUD interface | `apps/display-pow` (MRBD UI components) |
| Phase 3 (Next) | sEMG classifier integration on Meta Display neural band | Wearables Developer Kit neural stream |
| Phase 4 (Pilot) | End-to-end banking relay settlement | Mock PSD2 open-banking sandbox |
