# Context and prior art for Meta Glance

Checked on 2026-11-13 by research agents. Each fact has its source. "Nothing found" means that a search found nothing, not that nothing exists.

## Consequences for the pitch

- Parts of the idea exist. Meta announced product and price recognition for its own assistant, and Meta India tests payment by QR code. No source shows the full loop in a store: cart, consent rule, and self-checkout.
- The pitch must lead with the three new parts: the closed loop with the store catalog, the rule "glance tells, nod buys", and a checkout that needs no touchscreen.
- Store-side camera systems lost ground. Amazon removed Just Walk Out from its Fresh stores in 2024. Glance puts the sensor on the shopper, so the store installs nothing.
- S Group runs "Kerää ja skannaa" in 67 Finnish stores. It is the local reference for scan-as-you-shop, and it includes re-scan checks.
- Battery is the hard limit. Meta states up to 30 minutes of live streaming.

## Junction 2026

- Dates: 13 to 15 November 2026, Hype Areena, Espoo. https://2026.hackjunction.com/
- Preliminary schedule: hacking starts Friday 19:30. Preliminary submission Friday 23:59 (the platform page says 23:55). Submissions open Saturday 12:00. Final submissions Sunday 10:00. https://2026.hackjunction.com/ and https://hackjunction.app/hackathons/junction-2026
- Submission contents (video, demo, deck, repository): nothing found on public pages. Submissions are open-sourced under the MIT license. https://2026.hackjunction.com/
- Judging: each partner picks its track winners by its own criteria. Peer review then picks 5 projects, which pitch to a grand jury. https://2026.hackjunction.com/
- MLH lists four prizes for Junction: Best Use of Gemini API, ElevenLabs, MongoDB Atlas, and Vultr. Each criterion is one line, for example "Build a hack using MongoDB Atlas". https://www.mlh.com/events/junction-40/prizes

## Prior art: smart glasses for shopping or checkout

| Project | What it does | Difference from Glance |
|---|---|---|
| ListLens, Meta Global AI Developer Hackathon, 2026. https://github.com/michaelcummingsofficial/listlens | On Meta Ray-Ban Display, a vision model checks off grocery-list items that enter the basket. | No price, no cart, no payment. |
| Cartify, HackHarvard 2025. https://github.com/ewang1027/cartify | Gemini names products in a Ray-Ban Meta livestream. The app finds online prices and keeps a budget cart. | Online prices, no store checkout. |
| AugmentedShopper, December 2025. https://github.com/akhan0251/AugmentedShopper | The wearer looks at a barcode through Ray-Ban Meta and DAT. The phone returns the price. | No cart, no payment. |
| AirWallet, November 2026. https://github.com/vyu-xr/AirWallet | The README claims QR decode with ML Kit and PayPal payment on Meta Ray-Ban Display. | Payment only. Claims unverified. |
| VisionClaw, April 2026. https://arxiv.org/abs/2604.03486 | Ray-Ban Meta with agents adds a seen object to an Amazon cart. | Online cart only. |
| Meta Connect, 23 September 2026. https://www.meta.com/blog/meta-connect-2026-everything-we-announced/ | Meta announced "shopping AI that identifies products, prices, and reviews" on its glasses. | The assistant of Meta. No self-checkout flow. |
| Meta India, October 2025. https://about.fb.com/news/2025/10/new-meta-ai-features-makes-ray-ban-glasses | UPI Lite payment test: the wearer looks at a QR code and says "Hey Meta, scan and pay". | Payment only. |
| Rokid and Alipay, June 2025. https://www.auganix.org/?p=17236 | After a voice command, Rokid glasses scan a merchant QR code. | Payment only. |
| Be My Eyes on Ray-Ban Meta, since November 2024. https://bemyeyes.com/blog/be-my-eyes-on-ray-ban-meta | A sighted volunteer sees through the glasses, for example to identify items on a shelf. | Human help, no cart. |
| Aira on Meta Ray-Bans, October 2024. https://aira.io/meta-ray-bans-public-beta-open-to-all | A paid interpreter sees through the glasses in a WhatsApp call. | Human help, no cart. |

Retailer pilot of scan and checkout by shoppers with glasses: nothing found.

## Retail facts

- Salvatempo (Coop Alleanza 3.0): members scan product barcodes with a store device, and a dedicated checkout issues the receipt. An algorithm sets the frequency of the re-scan ("rilettura") from the results of the earlier shops of the member. https://www.coopalleanza3-0.it/dam/relation/attachments/files/regolamento-salvatempo.pdf
- S Group "Kerää ja skannaa": 67 stores on 25 June 2026, 7 of them with phone scan through the S-ostoslista app. It includes random re-scans. https://www.sttinfo.fi/tiedote/72160887/ei-enaa-ostosten-nostelua-hihnalle-keraa-ja-skannaa-palvelun-kaytto-onnistuu-yha-useammassa-myymalassa-omalla-puhelimella?lang=fi
- K Group: no current service found. An earlier trial with the shopper's own device did not expand because of low use. https://yle.fi/a/74-20018589
- April 2024: Amazon confirmed that Dash Carts replace Just Walk Out in its Fresh stores in the US. Stated reason: customers wanted to find deals, "view their receipt as they shop", and see savings. https://www.retaildive.com/news/amazon-removes-just-walk-out-tech-amazon-fresh-stores-dash-carts/712150
- January 2026: Amazon announced that all 57 Amazon Fresh and 15 Amazon Go stores close. https://abc7.com/post/amazon-stores-closing-close-go-fresh-locations-concentrate-foods-grocery-delivery/18486641/
- GS1: retail scanners worldwide should read the GTIN from 2D barcodes "by the end of 2027". Linear barcodes "will not go away". https://ref.gs1.org/guidelines/2d-in-retail/

## Ray-Ban Meta Gen 2 hardware

- Camera: "12 MP ultra-wide", up to 3K video. https://www.meta.com/ai-glasses/camera-capture-photo-video/
- Field of view: no official figure. A developer measured about 53 by 83 degrees in the DAT stream. Meta staff confirmed the 9:16 crop. https://github.com/meta/meta-wearables-dat-android/issues/140
- Focus type and minimum focus distance: nothing found.
- Battery: up to 8 hours of "typical use". https://about.fb.com/news/2025/09/ray-ban-meta-gen-2-better-battery-life-video-capture/
- "Up to 30 minutes live streaming" at 720p and 30 frames per second. The page does not name the generation. https://www.meta.com/legal/ray-ban-meta/disclosures/
- Battery cost of a DAT stream: nothing found. Meta staff: "We don't publish a per-feature battery cost ranking". https://github.com/meta/meta-wearables-dat-ios/discussions/75
- The capture LED lights during photo and video capture and "has no off switch". A blocked LED disables the camera. https://about.fb.com/news/2026/07/metas-ai-glasses-your-questions-answered/
- The LED stays on during a DAT camera stream. DAT has no LED control. https://github.com/meta/meta-wearables-dat-ios/issues/318

## Codes and text in the stream

- ML Kit: the smallest unit of a barcode needs at least 2 pixels, so an EAN-13 "should be at least 190 pixels wide". https://developers.google.com/ml-kit/vision/barcode-scanning/android
- EAN-13 at 100 percent: narrowest bar 0.33 mm, 37.29 mm wide with quiet zones. https://www.gs1ca.org/gs1ca-components/documents/EAN-UPC-Symbol-Reference.pdf
- Arithmetic from these figures: with 720 pixels across 53 degrees, an EAN-13 gets 2 pixels for each bar only within about 12 cm.
- A developer reports that 15 mm QR codes are "challenging to detect" live in the DAT stream. A reply: "I only have had luck with bar codes which are very big and well lit". https://github.com/meta/meta-wearables-dat-ios/discussions/38
- Gen 1, Android, DAT 0.9.0: a developer measured 652 kbps, and OCR could not read text on a screen. Meta staff: iOS has a Wi-Fi transport, and Android did not. https://github.com/meta/meta-wearables-dat-android/issues/174
- A still taken during a stream arrived at 1440 x 1080 in about 1 second in one iOS test. https://github.com/meta/meta-wearables-dat-ios/issues/363
- A standalone full-resolution photo takes more than 40 seconds and cannot run with the stream. https://github.com/meta/meta-wearables-dat-android/issues/199

Consequence: the app cannot read a price tag, an ingredient list, or a small barcode from the stream. It must recognize the product from the look of the package and take every fact from the store catalog.

## Meta policy for DAT apps

Sources: the acceptable-use guidance (`https://wearables.developer.meta.com/docs/develop/dat/acceptable-use`), the Acceptable Use Policy (`https://wearables.developer.meta.com/acceptable-use-policy`, updated 22 September 2026), and the developer terms (`https://wearables.developer.meta.com/terms`, updated 6 October 2025).

Encouraged, in Meta's words:

- "Assistive and accessibility - scene description, captioning, live translation, navigation aid."
- "Context on demand - the wearer points at something and asks; you answer. Deliberate, not ambient."
- "Motion and input - gesture control, activity and form tracking, coaching."
- Design principle: "narrow purpose, short retention, obvious to bystanders."

Prohibited or restricted:

- "Surreptitiously collect recognizable audio or video content of the user or others, or promote or enable bypassing, tampering with, or obscuring hardware-level recording indicators (such as the capture LED)."
- "analyzing people in a user's surroundings to facilitate unwanted approaches or interactions."
- "Use device sensors for unique identification of people based on physical characteristics, such as voices and faces".
- "Encourage the use of device sensors or recording in sensitive locations." The policy does not define the term and does not name retail.
- Terms 5.1 to 5.4: the app may use the data only for "the experience requested by the end user". It may share data only with consent of the end user or with service providers that use it only on behalf of the app.
- Terms 5.5 and 6.1: delete data when the user asks, and explain in the privacy policy how to ask.
- Terms 2(h): "Experimental Features can only be used for experimental or testing purposes and cannot be incorporated into any production build unless permitted by Meta in writing."

Fit of Glance:

- Satisfied: it recognizes products, not people. It sells no data. The cart and the payment are the experience that the wearer requested.
- At risk: a stream that runs for the whole shop reads as ambient capture. Frames with other shoppers reach a cloud model.
- Mitigation: the wearer starts and stops the session. The phone blurs faces and crops the frame before upload. The server keeps no frame. The app uses the paid Gemini tier. The app never hides the capture LED. A pilot store shows a notice at the entrance.
- Not addressed by any page: payments, retail premises, and fixed retention periods.
