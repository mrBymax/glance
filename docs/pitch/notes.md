# Speaker notes of the pitch deck

These notes go with `Meta-Glance-pitch.pdf` (14 pitch slides) and `Meta-Glance-technical.pdf` (technical deep dive, ordered to follow each topic in the pitch). The spoken text of each page is the text of `script.md`, the script of the owner, word for word. One change: the second product is a Fanta at 2.60, not a rye bread (owner's decision, 15 November). These notes add only the cues for the footage of the video, marked **Footage**, and pointers for the technical slides.

The pages of the pitch deck (`Meta-Glance-pitch.pdf`):

- Pages 1 to 12: the pitch pages of the script.
- Page 13: Team. Page 14: Recap.

## Project name and tagline

The name is Meta Glance, and the tagline is "Look. Nod. Done.", as on the website. The recap page shows the logo of the project and the tagline. This settles the four name lines of the script (Glance, Nod, Go; Look, Nod, Paid; Look, Nod, Done; Pay with a Nod).

## 0:00 Cold open: the first wow (10 s)

No greeting, no names. Hold the carton up and look at it.

**Footage.** First person through the glasses: the hand lifts the oat drink carton. Keep the real voice of the glasses on the audio track.

### Page 1

"Oat drink, one litre, one eighty-nine."

Nod once, clearly.

**Footage.** The nod, from the side: the head moves, the phone stays in the pocket.

### Page 2

"Added. That carton is in my cart, and I never touched a phone."

## 0:10 The problem (50 s)

### Page 3

Think about your last trip to the supermarket. You had two options, and both were bad.

Option one: the classic checkout. You queue. You take everything out of your basket, put it on the belt, and pack it all again.

Option two: self-scanning. It is faster, but now you shop with one hand, because the other one holds a scanner or your phone. And at the end a touchscreen still waits for you.

**Footage.** The two photos of the page, or a short shot of each: a queue at a checkout belt, and a shopper with a basket in one hand and a phone in the other.

### Page 4

If you are blind or have low vision, neither option works. 83 percent of visually impaired shoppers cannot easily get the information on a package, and a touchscreen tells them nothing.

Stores tried to fix this with cameras in the ceiling. Every store needed a refit. Amazon took the system out of its Fresh stores in 2024.

## 1:00 The solution: the second wow (70 s)

### Page 5

So we moved the camera. It sits on the shopper.

I pick up the next product and look at it. "Fanta, two sixty." A look only tells me. Nothing enters my cart until I nod.

Nod.

**Footage.** First person: a hand holds the Fanta, and the voice says "Fanta, two sixty. Nod to add." Then the nod.

### Page 6

"Added. Total four forty-nine." Both hands stayed on my shopping. Now I am done, so I walk to the checkout and look at the code on its screen.

**Footage.** The walk to the checkout screen, first person, ending on the Glance code.

### Page 7

"Checkout 3 at Demo Market. Two items, four euros forty-nine. Nod to pay."

Nod.

**Footage.** First person on the kiosk code while the voice plays, then the nod.

### Page 8

Paid. I unloaded nothing, I scanned nothing, I touched nothing.

And the store installed nothing. It shared its price list, and it showed one code on a screen that it already had.

Stop. Count two seconds. Let the room react.

**Footage.** The kiosk screen turns to "Paid. 4.49 EUR".

## 2:10 The turn (15 s)

### Page 9

Cool? Good. Now forget the supermarket.

Glance is not a shopping app. Glance is a protocol.

## 2:25 The protocol (75 s)

### Page 10

Look again at what happened at that checkout. A place showed a code. The glasses read it. A voice said what a nod would do. A nod confirmed, and the place got the answer.

Look, hear, nod, done. Not one of those steps is about groceries.

### Page 11

This is a Glance code. It is a QR code. It goes on a screen, or on a sticker.

Put it by the door of a bus. You board, you look at it, and you hear: "Line 4 to the harbor. Single ticket. Nod to buy." You nod and you sit down. No app to open, no card to tap.

**Footage.** The printed sticker (`assets/media/glance-sticker.png`, the code `GL1 BUS4`) by a door, first person. The bus is a vision: no bus uses Glance, and today's server speaks no offer of a place other than the store checkout.

### Page 12

Put it on a ticket gate, and a nod opens the gate. Put it on a vending machine or a parking meter, and a nod pays. Put it on a restaurant table, and it reads you the menu.

Any place that can show a code can take a nod. The place registers with the Glance server and gets the result when you nod. That is the whole integration.

This is a vision that we have, where you can leave the phone at home.

## Team presentation and recap

### Page 13: Team

We are four engineers from Udine, Klagenfurt, and Zurich who tested and tuned this on real Ray-Ban Meta hardware in this arena tonight.

### Page 14: Recap

Your phone stays in your pocket. Keep your hands for life. Look. Nod. Done.

**Footage.** The last nod at the kiosk and the "Paid" screen, before the recap page.

## Technical deep-dive deck (`Meta-Glance-technical.pdf`)

Organized to mirror the order topics appear in the pitch:

- **01, head gestures and screen-off sessions (Pitch 1-2).** The head window opens 300 ms after the line of each prompt starts, for a product and for a payment, and a nod or a shake during the line stops the voice at once. Both barge-in nods and screen-off pocket sessions ran on real glasses on 14 November 2026.
- **02, store workflow and accessibility (Pitch 3-4).** Full hands, blind and low-vision access, no ceiling refit, catalog-grounded prices and allergens, and redundant input controls.
- **03, existing store and wearable systems (Pitch 4).** Comparison against S Group scan-and-go, self-checkout kiosks, Amazon Just Walk Out, phone tap/QR, India UPI test, and Meta AI + Be My Eyes.
- **04, hardware, recognition, and scale (Pitch 5-6).** 7 fps stream, 30 Hz head motion, 1.2 s median recognition call (146 frames, 14 November 2026), and the observe + verify pipeline (0 wrong names across 644 calls, 27% prompt tokens).
- **05, consent rules and local privacy (Pitch 7-8).** A nod counts only for the line you hear, and at a checkout only while its code stays in view. Faces are pixelated on the phone before upload, and no frame is written to disk.
- **06, the Glance protocol (Pitch 9-10).** The parts: glasses, phone, Glance server, recognition, and a place showing a GL1 code.
- **07, beyond stores and Display HUD (Pitch 11-12).** Protocol extensions for transit, gates, vending, parking, and tables, plus the Display HUD mockup.
- **08, platform fit for Meta AI glasses.** Hardware readiness, reusable interaction layer, daily habits, and audio-first accessibility.
- **09, rollout path.** Store checkout pilot first, then expansion to other code-based places.
