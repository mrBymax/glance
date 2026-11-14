# Accessibility and trust requirements for Meta Glance

Research on 2026-11-13 by a research agent. Each requirement has its source. "Unverified" means that no primary source confirmed the claim.

## Consequences for the design

- A yes counts only for the thing in view. The shopper nods while the product is in view, and pays while the kiosk code is in view. No countdown decides for the shopper.
- A nod is consent, not authentication. Above a cap (50 EUR, the EU contactless limit), the phone asks for a fingerprint.
- Each action has four inputs: nod or shake, voice, touchpad, and phone. A switch turns motion input off. A setting swaps the meaning of nod and shake.
- Each spoken line also shows as text on the phone, with a haptic for key events.
- The voice reports doubt and guides the aim. It never states a guess as a fact, and it never guesses a price.
- The shopper sets speech speed, detail level, and a discreet mode.
- The phone blurs faces, the server stores no frame, and the camera stops when the session is idle.

## 1. Standards

- Give each nod or shake action a voice, tap, or phone equivalent, and a switch that disables motion input. [WCAG 2.5.4](https://www.w3.org/WAI/WCAG22/Understanding/motion-actuation.html). EN 301 549 applies this rule to native apps. [ETSI](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf)
- Let the user turn off, adjust, or extend each response window. To extend, warn first and give 20 seconds. [WCAG 2.2.1](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)
- Use 48 x 48 dp touch targets. The WCAG minimum is 24 x 24 CSS pixels. [Android](https://developer.android.com/guide/topics/ui/accessibility/apps), [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- Reach 4.5:1 contrast for text and 3:1 for large text, controls, and icons, on the phone and the display. [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- Announce cart changes through a polite live region. Do not use `announceForAccessibility`, which Android 16 deprecates. [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), [Compose](https://developer.android.com/develop/ui/compose/accessibility/semantics), [Android 16](https://developer.android.com/about/versions/16/behavior-changes-all)
- Give a stop control or a separate volume control for audio longer than 3 seconds. [WCAG 1.4.2](https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html)
- Let the user review, confirm, and correct before payment, or make payment reversible. [WCAG 3.3.4](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html)
- Label controls with `contentDescription`, size text in sp, and test at 200 percent font scale. [Android](https://developer.android.com/guide/topics/ui/accessibility/apps)
- The European Accessibility Act applies from 28 June 2025 to payment terminals, self-service terminals, and e-commerce services. [Art. 2](https://www.legislation.gov.uk/eudr/2019/882/article/2), [Art. 31](https://www.legislation.gov.uk/eudr/2019/882/article/31). Terminals already in use may stay up to 20 years. [Art. 32](https://www.legislation.gov.uk/eudr/2019/882/article/32)
- EN 301 549 V4.1.1 (WCAG 2.2) was published on 2 September 2026. [Deque](https://www.deque.com/blog/en-301-549-v4-1-1-is-final-what-changed-what-it-means-and-what-you-should-do/)

## 2. Blind and low-vision grocery shopping

- GS1 UK research: 83 percent of visually impaired shoppers cannot easily access packaging information, and 37 percent had allergic reactions. [Packaging Europe](https://packagingeurope.com/news/seven-in-ten-visually-impaired-consumers-struggle-to-read-food-labels/13795.article)
- Users ask Be My Eyes volunteers to read labels and expiration dates and to operate kiosks. [Listing](https://apps.apple.com/us/app/be-my-eyes/id905177575)
- Low-vision shoppers struggle to locate products on shelves, with their hands on a cart or cane. [CueSee](https://par.nsf.gov/servlets/purl/10100347)
- Touchscreen kiosks without speech are unusable for many blind people. [Access Board](https://www.access-board.gov/news/2022/09/27/u-s-access-board-seeks-public-comment-on-accessibility-guidelines-for-self-service-transaction-machines/). In NFB v. Walmart (2021), a US court accepted staff help as sufficient. [Summary](https://www.lflegal.com/2021/10/kiosk-maryland-opinion/)
- Complete checkout through the glasses and the phone, without the kiosk touchscreen. Researchers propose this pairing. [Waterloo](https://uwaterloo.ca/public-health-sciences/news/atms-and-other-digital-self-serve-devices-fail-meet)
- Existing tools: Meta AI describes scenes and reads text, and Be My Eyes adds volunteer calls. [Meta](https://www.meta.com/ai-glasses/blind-visually-impaired/). Seeing AI guides the camera to barcodes with beeps. [Listing](https://apps.apple.com/us/app/seeing-ai/id999062298). Envision, OrCam, and Aira read text or add human help. [Envision](https://www.letsenvision.com/glasses/home), [OrCam](https://orcam.com/en-us/for-people-who-are-blind-or-partially-sighted), [Aira](https://aira.io/meta-ray-bans-public-beta-open-to-all)
- Reported gaps: Meta AI summarizes text and invents details, and the off-center camera cuts the frame. [AFB](https://afb.org/aw/fall2025/meta-glasses-review). It needs voice and cannot route audio to hearing aids. [HKNC](https://www.helenkeller.org/meta-ray-ban-smart-glasses-deafblind-accessibility-review/)
- Report blurred or cut-off frames. Such flaws cut model accuracy on product photos by blind users from 98 to 75 percent. [Garg](https://arxiv.org/abs/2511.08917)
- Guide the aim with the hand as anchor, with short speech or tones. [Lee](https://par.nsf.gov/biblio/10180846), [ReCog](https://publications.ri.cmu.edu/recog-supporting-blind-people-in-recognizing-personal-objects)
- Do not present a guess as fact. Blind users cannot easily verify AI errors. [Alharbi](https://arxiv.org/abs/2408.06546)

## 3. Audio-first and voice interface design

- Prefer speech. Use few sounds, each short, consistent, and clear without a lesson. [Google](https://developers.google.com/assistant/conversation-design/earcons), [Brewster](https://www.dcs.gla.ac.uk/~stephen/earcon_guidelines.shtml)
- Do not send important information by sound alone. [Apple](https://developer.apple.com/design/human-interface-guidelines/playing-audio)
- Confirm cart additions implicitly ("Added oat milk, 2.49"). Confirm explicitly before a transaction. [Google](https://developers.google.com/assistant/conversation-design/confirmations), [W3C](https://www.w3.org/TR/naur/)
- Keep each response to one or two breaths. Send long details to the phone. [Alexa](https://developer.amazon.com/en-US/alexa/alexa-haus/design-principles/be-brief)
- Let the user set speech rate and detail level, and interrupt or repeat speech. [VERSE](https://cs.uwaterloo.ca/~avtyurin/papers/VERSEVtyurinaASSETS2019.pdf). Mean listening rate is 309 words per minute, and 334 for visually impaired listeners. [Bragg](https://wildlab.cs.washington.edu/Publications_files/Bragg_CHI2018.pdf)
- Offer a discreet mode. Blind users report that assistants speak private details aloud in public. [Abdolrahmani](https://userpages.umbc.edu/~rkuber/pubs/assets2018.pdf)
- Ask the user to repeat when the speech confidence score is low. [Meta](https://wearables.developer.meta.com/docs/develop/dat/speech)

## 4. Other disabilities and situations

- Provide a mode that needs no hearing: synchronized text on the phone or the display, and phone haptics. [ETSI](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf). Over 25 percent of people older than 60 have disabling hearing loss. [WHO](https://www.who.int/news-room/fact-sheets/detail/deafness-and-hearing-loss)
- Provide a mode that needs no speech (EN 301 549 clause 4.2.6). One recognizer had a 25.4 percent word error rate for people who stutter. [Lea](https://arxiv.org/abs/2302.09044)
- Provide a mode that needs no head movement (clause 4.2.7). Tremor can trigger motion input. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/motion-actuation.html)
- Make the kiosk QR code readable from a seated position. US rules place operable parts 15 to 48 inches high. [Access Board](https://www.access-board.gov/ada/guides/chapter-3-operable-parts/)
- State charges at the start, let users go back, avoid timeouts, and offer human help. [COGA](https://www.w3.org/TR/coga-usable/)
- Expect noise: large stores measured 52 to 76 dBA. [Study](https://www.jstage.jst.go.jp/article/aije/70/591/70_KJ00004359171/_article/-char/en). Keep tap as a fallback for voice.
- Touchpad operation with gloves: unverified.

## 5. Head gestures as input

- Listen for a nod only in a short window after a prompt. AirPods use head gestures to answer Siri announcements. [Apple](https://support.apple.com/guide/airpods/devb2c431317/web)
- Do not trust lab accuracy. Unintentional movement is the main challenge. [HeadGesture](https://doi.org/10.1145/3287076). Google Glass sensors reached about 96 percent. [GlassGesture](https://www.cs.wm.edu/~liqun/paper/infocom16_glass.pdf). False-positive rates for walking shoppers: unverified.
- Keep nods small and rare. Neck muscle load rises with head rotation angle. [Frontiers](https://www.frontiersin.org/articles/10.3389/frvir.2025.1682866/full)
- Do not assume that a nod means yes. State the mapping in each prompt and allow a remap. Bulgarians shake the head for yes, and Greek speakers nod upward for no. [Language Log](https://languagelog.ldc.upenn.edu/nll/?p=39877). The Indian head bobble can mean yes or maybe. [Wikipedia](https://en.wikipedia.org/wiki/Head_bobble)
- DAT Motion, Inputs, and Speech are beta capabilities, outside production channels. [Motion](https://wearables.developer.meta.com/docs/develop/dat/motion), [Inputs](https://wearables.developer.meta.com/docs/develop/dat/inputs)

## 6. Privacy, consent, and trust

- GDPR: the app provider can be a controller even if the wearer has the household exemption. The provider should not rely on the wearer to inform bystanders. [EDPB Statement 01/2026](https://www.edpb.europa.eu/system/files/2026-10/20261310_edpb_statement_smart-glasses_en.pdf)
- Limit continuous capture and retention, blur bystanders, process on the device where possible, and store no frames by default. [EDPB](https://www.edpb.europa.eu/system/files/2026-10/20261310_edpb_statement_smart-glasses_en.pdf). Meta asks for "narrow purpose, short retention, obvious to bystanders". [Meta](https://wearables.developer.meta.com/docs/develop/dat/acceptable-use)
- Do not identify people by face or voice, record covertly, or obscure the capture LED. [Meta policy](https://wearables.developer.meta.com/acceptable-use-policy/)
- Use glasses data only to run the app. Do not sell it. Delete data on request. [Meta terms](https://wearables.developer.meta.com/terms/)
- Explain the purpose before the Meta AI camera permission prompt. [Meta](https://wearables.developer.meta.com/docs/develop/dat/permissions-requests)
- Add an audible capture cue and a camera status on the phone. Regulators doubt that a LED alone gives notice. [Irish DPC](https://techcrunch.com/2021/09/20/facebook-warned-over-very-small-indicator-led-on-smart-glasses-as-eu-dpas-flag-privacy-concerns/)
- Stop capture when a person objects, and in medical or school settings. [Meta](https://www.meta.com/ai-glasses/privacy/)

## 7. Hands-free payment confirmation

- Speak the payee and the total before confirmation. EU rules require that the payer knows both. [Art. 5](https://www.legislation.gov.uk/eur/2018/389/article/5)
- Add a phone biometric or a spoken code above a set amount. Alexa skills must offer a 4-digit voice code from 100 dollars. [Amazon](https://developer.amazon.com/en-US/docs/alexa/custom-skills/requirements-for-skills-that-allow-purchases.html)
- Do not use a nod or a voice as the only factor. Google warned that a recording could confirm purchases. [9to5Google](https://9to5google.com/2020/05/25/google-assistant-voice-match-payments/). Strong authentication needs two independent elements. [PSD2](https://www.legislation.gov.uk/eudr/2015/2366/article/4)
- EU contactless payments can skip strong authentication up to 50 EUR, within 150 EUR cumulative or five consecutive payments. [Art. 11](https://www.legislation.gov.uk/eur/2018/389/article/11)
- Require a deliberate action, like the double-click of the Apple Watch. [Apple](https://support.apple.com/guide/watch/wake-and-unlock-apd0e1e73b6f/watchos)
- Give a spoken and a text receipt (EN 301 549 clause 5.1.3.16). [ETSI](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf)
- Default to no payment on silence or an unclear gesture. Blind users fear accidental purchases from false activations. [Abdolrahmani](https://userpages.umbc.edu/~rkuber/pubs/assets2018.pdf)

## Top 12 requirements

1. Each action works by nod, voice, tap, or phone. Motion input has an off switch.
2. All speech also shows as text, with haptics for key events.
3. Payment needs a spoken payee and total, then explicit confirmation. Silence means no payment.
4. A nod never authenticates. Amounts above a cap need a phone biometric or a spoken code.
5. Nod detection runs only after a prompt. The team measures false positives with shoppers who walk.
6. The app reports uncertain recognition, guides the aim, and never guesses a price.
7. The app captures on demand, stores no frames by default, and trains no model on them.
8. The capture LED stays visible, with an audible cue and a one-step camera off.
9. Cart actions are reversible, and the user gets a spoken and a text receipt.
10. The user controls speech rate, detail, interruption, and a discreet mode.
11. Each response window is adjustable, with a warning before the end.
12. The phone app meets the Android rules in section 1. Gesture meaning is configurable.
