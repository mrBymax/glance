# Speaker notes of the pitch deck

These notes go with `Meta-Glance-pitch.pdf`. The spoken text of each page is the text of `script.md`, the script of the owner, word for word. These notes add only the cues for the footage of the video, marked **Footage**, and short pointers for the backup pages.

The pages of the PDF:

- Pages 1 to 12: the pitch pages of the script.
- Page 13: Team. Page 14: Recap. The script leaves both as TODO.
- Page 15: Backup. Pages B1 to B9 after it, for the questions of the judges.

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

I pick up the next product and look at it. "Rye bread, two sixty." A look only tells me. Nothing enters my cart until I nod.

Nod.

**Footage.** First person: two hands hold the rye bread; the voice says "Rye bread, two sixty. Nod to add." Then the nod.

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

The script leaves this part as TODO, so these two pages have no spoken text yet.

### Page 13: Team

The four people in alphabetical order, with their titles: Alessandro De Biasi, Federico Bertossi, Marco Ceccon, Michele Lizzit.

### Page 14: Recap

The page shows the logo of the project, the tagline "Look. Nod. Done.", the punchline of the script ("Glance tells, nod buys: a protocol for paying with your glasses.") under it, and the ask: "Our ask: we want to keep building Glance, full time, with Meta."

**Footage.** The last nod at the kiosk and the "Paid" screen, before the recap page.

## Backup pages, for questions

These pages are not part of the timed pitch.

- **B1, the protocol.** The parts: glasses, phone, Glance server, recognition, and a place. The dashed path is the code that the camera sees.
- **B2, Glance for stores.** The seven points of the script, as written.
- **B3, under the hood.** The paragraph of the script, and three numbers: 7 frames each second, 30 Hz head motion, and 1.2 s for one recognition call (the median of 146 frames, 14 November 2026).
- **B4, when a nod counts.** The head window opens 300 ms after the line of each prompt starts, for a product and for a payment, and a nod or a shake during the line stops the voice at once. The nod while the voice speaks and the session with the phone locked in a pocket ran on the real glasses on 14 November 2026.
- **B5, consent and privacy.** A nod counts only for the line you hear, and at a checkout only while its code is in view. Faces are pixelated on the phone. The server writes no frame to disk.
- **B6, why it matters to Meta, and the ask.**
- **B7, competition.** Each row has its source in the footer.
- **B8, go-to-market.** A roadmap: a store pilot, more places, the loop in the glasses.
- **B9, Glance beyond stores.** The vision of the script. Only the checkout is built.
