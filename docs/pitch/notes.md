# Speaker notes of the pitch deck

These notes go with `Meta-Glance-pitch.pdf` (18 slides). The deck is the base of the video pitch: each slide has the words to say, about 20 to 40 seconds of speech, and the places where the video cuts to real footage.

Rules for the speaker:

- Say only what the slide and the repository support. The payment is a mock. No store, bus, or partner uses Glance today.
- "Footage" means a cut to a real recording with the glasses. Each footage slot on a slide is a frame for that cut. Do not show the saved test frames of `logs/frames`: they show a venue and people.
- A slide number in brackets is the slide on screen while you speak.

Total: about 8 to 9 minutes at a calm pace. For a 3-minute cut, keep slides 1, 2, 3, 6, 7, 8, 9, 12, 13, 18, and say one sentence for each of the others.

## 1. Title: "Look. Nod. Done."

**Footage, before the title.** Five seconds, first person: a hand holds a product, a voice in the ear says the name and the price, the head nods. Then cut to the title.

> This is Meta Glance. A protocol for AI glasses. You look at a code, you hear what it is and what it costs, and you nod. That is the whole interface. We built it at Junction for the Meta challenge, on Ray-Ban Meta glasses. We are an independent team, and this is not a Meta product.

About 20 seconds.

## 2. Problem: "Checkouts, tickets, and gates ask for your hands and your eyes."

> Every small transaction of the day asks for a screen. Take the phone out, unlock it, open an app, aim, read, tap. That is hard with bags in both hands, a child, a cane, or a stroller. And it is harder still if you cannot read the screen. The World Health Organization counts at least 2.2 billion people with a near or distance vision impairment. Small print and touchscreens shut many of them out.

About 30 seconds. The number is from the WHO fact sheet of 10 February 2026. Do not add other statistics.

## 3. Solution: "Meta Glance: look at a code, hear the offer, nod to confirm."

> Glance is one loop for every place that can show a code. One: look at a Glance code. Two: the voice says what it is and what a nod will do. Three: nod to confirm, or shake to say no. Four: the place gets the answer and acts on it. Two rules make it safe. You always hear what a nod does before it counts. And a nod counts only while you look at the code.

About 30 seconds. Optional cut: a person looks at the kiosk code, the phone stays in the pocket.

## 4. Why now? "Meta asks for an everyday use of a first-person view."

> Meta asked for exactly this: the best everyday use case for AI glasses, where a first-person view enables new or better interactions, hands-free and in the moment, beyond mirroring a phone. The timing is right. EssilorLuxottica reported AI glasses almost doubling in revenue in the second quarter of 2026. And Meta's Wearables Device Access Toolkit now gives a phone app the camera, the motion sensor, and the touchpad of the glasses. Everything Glance needs.

About 30 seconds. Both quotes on the slide are word for word from the challenge text (CHALLENGE.md). The revenue quote is from the EssilorLuxottica Q2 and H1 2026 results, 28 July 2026.

## 5. Our protocol (1 of 8): "The Glance protocol links a person, a place, and a nod."

> Four parts. The glasses: their camera sees the code, their speakers play the voice, their motion sensor feels the nod. The phone app reads the code and pixelates faces. The Glance server links the wearer to the place, writes each spoken line, and decides if a nod counts. And the place: anything that shows a Glance code and acts on the result. A place registers once, shows its code, and follows one event stream. That is all a business has to build.

About 35 seconds.

## 6. Our protocol (2 of 8): "Our use case: shop a store with your eyes, pay with a nod."

> Our first use case is a store. In the aisle, you hold up a product and hear "Oat drink, one litre, one eighty-nine. Nod to add." You nod. At the checkout you look at the code on the screen and hear the store and the total. You nod, and it is paid. The phone stays locked in your pocket the whole time.

About 25 seconds. The four lines on the slide are the lines of the recorded demo run of the app.

## 7. Our protocol (3 of 8): "Hold a product up. Hear its name and its price."

**Footage, in the slot.** First person through the glasses: a hand lifts the oat drink; the voice says its name and price. Keep the real audio.

> The glasses see what is in your hand. Glance knows the product by sight, from pictures of each item that the store sells, or by its barcode, from the list of the store. On the phone, the same line shows as text, with a warning when the product has an allergen from your profile. Here, gluten.

About 25 seconds.

## 8. Our protocol (4 of 8): "Nod to add. The nod counts while the voice still speaks."

**Footage, in the slot.** The wearer nods. The cart on the phone updates. Show the phone screen in the same shot, or as a split.

> You do not have to wait for the voice to finish. For a product, the nod counts from 1.2 seconds into the line, and the line stops as soon as you nod. For a payment it is stricter: the nod counts only after the whole line has played. On real Ray-Ban Meta glasses, the phone reported a nod 300 to 430 milliseconds after it started.

About 30 seconds. The 300 to 430 ms come from one wearer and three prompts on 14 November 2026 (`apps/mobile/android/README.md`, "The nods of the test of 2026-11-14"). Say it as one test, not as a benchmark.

## 9. Our protocol (5 of 8): "Look at the checkout code. Hear the total. Nod to pay."

**Footage, optional.** The wearer walks to the kiosk screen and looks at the code; the kiosk switches to "Waiting for your nod", then to "Paid".

> At the checkout, the kiosk shows a Glance code. You look at it, and the voice says: "Checkout 3 at Demo Market. Two items, four euros forty-nine. Nod to pay." You nod. The kiosk shows the result, and the receipt waits on your phone. In this demo the payment is a mock: no money moves.

About 25 seconds.

## 10. Our protocol (6 of 8): "Built for people with all abilities, not only for a demo."

> Glance works without sight: every name, price, and warning is spoken. It works with full hands. And if you cannot nod, you double tap the glasses or press a button on the phone. You can swap nod and shake, and take 15 seconds or all the time you need. Set your allergens, diet, and budget once, and you hear a warning before you nod. In English and Italian.

About 30 seconds. Do not claim a certification or a WCAG conformance level.

## 11. Our protocol (7 of 8): "Nothing happens by accident, and nobody nearby is exposed."

> Consent is built into the loop. A look alone changes nothing. A nod pays only while the code is in view, and only after you heard the amount. A shake cancels. A nod is consent, not identity, so the server can ask for a fingerprint above an amount. For the people around you, the phone pixelates every face before a frame leaves it. If face detection fails, the frame is dropped. The server writes no frame to disk.

About 35 seconds. The fingerprint check is a server setting that is off by default; say "can ask", not "asks".

## 12. Our protocol (8 of 8): "It runs on stock Ray-Ban Meta glasses, through Meta's own toolkit."

**Footage, optional.** The phone goes into a pocket with the screen off; the shop goes on.

> This is not a mockup. The phone takes the camera stream of the glasses at 7 frames a second and reads their head motion at 30 hertz. Naming a product by sight takes about 1.2 seconds per call. And we handled the hard parts the challenge asked for: permissions through the Meta AI app, a late nod after a stall of the link, the screen off in a pocket, lost glasses, and a spoken line for every error.

About 35 seconds. The 1.2 s is the median of one recognition call on 146 frames (`apps/server/README.md`). The screen-off session is built; the READMEs list what was not yet measured with the real glasses.

## 13. Business model: "For Meta: a reason to wear the glasses every day."

> Why is this good for Meta? It works today, on your glasses, with your toolkit. It is a platform, not an app: any place plugs in with a code and an event stream, and the loop stays one. It turns the glasses into something you use many times a day: to pay, to board, to open a door. And it is inclusive from the first step. Our ask is simple: we want to keep building Glance, full time, with Meta.

About 35 seconds. No price, fee, revenue, or partner exists. Do not invent one.

## 14. Competition: "Others solve one part. Glance closes the loop."

> Scan-and-go apps and self-checkouts still need your hands and your eyes. Amazon's Just Walk Out needs cameras across the store, and Amazon took it out of its US Fresh stores in 2024. Meta's own glasses can already describe a scene and call a volunteer, and Meta showed a "scan and pay" test in India. Glance is the piece in between: the place states its offer in your ear, and a nod counts only while you look at it. A protocol for any place, not one store system.

About 35 seconds. Each row has its source in the footer of the slide.

## 15. Go-to-market: "Start at one checkout. Grow to every place that can show a code."

> This is our plan, and nothing in it is agreed with a partner yet. First, a pilot at one store checkout, with a staffed lane beside it. We count the nods that pay, any yes by mistake, and the time to pay. That needs a payment provider. Second, places with a fixed offer: a bus fare, a gate, a vending machine. Third, the loop as a feature of the glasses themselves, with no phone app. The first wearers are the people who gain the most.

About 35 seconds.

## 16. Future vision: "Any code in the world, answered with a nod."

> The checkout is built. Everything around it is what the protocol enables: a bus ticket by the door, a ticket gate, a vending machine, an order at a restaurant table, the story of a painting. Same code, same rules, same nod. On glasses with a display, the same prompt appears in the lens; we have a mockup of that on the Display toolkit. The next part to build is a way for each place to state its own offer.

About 30 seconds. Say clearly that only the checkout exists.

## 17. Team: "Four builders who want to make this real."

> We are Alessandro, Federico, Marco, and Michele. Software engineers and researchers in AI and cybersecurity, from the University of Udine, Klagenfurt, and ETH Zurich. We built this loop end to end at Junction, and we want to keep going.

About 20 seconds. Names and titles are as the owner gave them; check them before recording.

## 18. End: "Look. Nod. Done."

**Footage, after the end card.** The last nod at the kiosk, the "Paid" screen, the wearer walks out.

> Look. Nod. Done. Let us build the loop into the glasses, together. Thank you.

About 10 seconds.
