# UI reference research for Meta Glance

Research on Refero on 2026-11-13: 6 style searches, 35 screen searches, 4 full styles, 4 full flows, 28 screenshots. URL paths: `refero.design/screens/ID`, `refero.design/pages/ID` for web pages, `refero.design/flows/ID`.

Gaps: the searches found no Oura, Meta AI, or Cash App screens, no true kiosk display, no companion app with battery status, and no undo snackbar. Items 5, 13, 15, and 16 are proxies.

Status: direction A is the recommendation of the research. The team has not chosen a direction yet.

## Reference lock

Styles:

1. Yellowbird, style `17c67636-cb35-4cfc-899a-78f7dcda6e9c`. Yellow as page architecture, 3px black rules in place of shadows, mono labels for short facts.
2. ON.energy, style `469b0e84-99bd-4c4f-9019-b244968a2d7e`. A full yellow field marks the resolved state. A large numeral sits high right, its label low left. Dashed focus outline.
3. Bee, style `7ec275d0-6462-433f-a068-c4ce248ccf0f`. A human moment as hero, a word-by-word reveal for one thesis, copy that leads with the benefit.
4. Augen, style `91a29339-e98b-4169-9d0d-1db906d69170`. Black stage, one signal color, numbered index footer.

Phone app:

5. Brink walking mode, flow `10923`, screens `301b336d-a044-40e6-8df3-60898ebda1a7` and `f7c0ebc8-f5cc-42df-88f4-d6f63caabb2a`. A status pill above a three-column metric row and two equal actions. A priming sheet: icon, title, one sentence, three fact rows, "Continue", "Not Now", then "Connecting...".
6. Dropbox connect a computer, flow `2420`, screen `64cf737d-5371-4d43-a8cf-baa6e2460876`. A readiness question before the jump, one numbered instruction on each screen, a three-step tracker.
7. pushr counter, screen `58a34bca-d87b-4236-8ace-1096fa2e55d3`. One wide numeral that owns the screen, a small label above, controls in the thumb zone.
8. Voicenotes live transcript, flow `14264`, screen `97f2df3c-8378-4f3a-9b06-addd30a0d83a`. Timestamp, speaker dot, then the line. Text in progress stays gray. Footer: pause, level meter, end.
9. ElevenReader reading speed, screen `8298c61b-2a82-4802-9e6e-ea19114d1a6c`. The title states the live value. A slider with preset chips. A highlight on the spoken word.
10. Matter audio settings, screen `491bfc42-62f3-40bb-8dc4-fd44d403c75b`. Grouped rows with the value at the right. One row maps one gesture to one action.
11. Uber Eats allergies, screen `53086772-cb2a-4552-8ca4-ad113ea76d45`. Rows with glyph, label, and checkbox, "Clear all", a free-text allergen.
12. ten ten lock, screen `2b31f533-2c2c-40eb-941b-49e674435582`. A slide on a vertical track with one instruction line.
13. Endel device not found, screen `9f00f761-2b07-4937-b76d-c2834635c06b`. A device glyph in rings with a cross badge, one cause sentence, "Try Again", "Cancel".
14. World App scan confirm, screen `0ab82b16-34e7-4dfc-b8f1-b6a4ec03a051`. A sheet that names what the camera scanned and states the consequence before "Continue".

Kiosk:

15. Wise QR verification, web page `64637ef4-3330-499b-9756-807be4301cc8`. An instruction headline, the QR code alone, a fallback link, a step tracker.
16. Square Virtual Terminal, web flow `1942`, pages `28af7ab2-6227-471e-93a1-b0e11b2a6309`, `37d87de4-55ad-4cf9-a7ec-06198eca054c`, `9d861019-5ea2-46b3-b60f-d8bd4422f09f`. The total pinned top center, ledger rows with right-aligned amounts, "Payment recorded" with receipt actions, a receipt with heavy rules.

## Visual directions

Google Fonts serves all six families. Ratios are WCAG contrast against the theme canvas, rounded down.

### A. Shelf Edge (recommended by the research)

- Mood: the phone and the kiosk look like the shelf label and the receipt of the store.
- Type: Archivo (width 110 to 125, weight 800) for prices and headlines. Atkinson Hyperlegible Next for body. Atkinson Hyperlegible Mono for labels and ledger rows.
- Light: paper `#F7F6F1`, ink `#0B0B0C` (18.1:1), label yellow `#FFD91A` under ink (14.2:1), secondary `#4A4A46` (8.2:1), alert `#B3170F` (6.3:1).
- Dark: canvas `#0B0B0C`, text `#F4F2E8` (17.5:1), yellow `#FFD91A` (14.2:1), secondary `#B5B3A8` (9.3:1), alert `#FF8A7A` (8.5:1).
- Roles: a yellow field means live or confirmed. Paper means setup. A black field means pocket mode or paid.
- Shape: 3px ink rules (6px on the kiosk), 6dp radius, no shadows, no gradients, 56dp touch targets.
- Motion: a state change is a 200 ms full-field wipe. The total rolls in 250 ms. Spoken text reveals word by word. Reduced motion removes all three.
- Sources: 1, 2, 7, 16.

Why A: the product speaks, so the screen must work as signage. A full-field color change reads in one second, from 2 meters, and in a video shot at an angle. No state depends on red against green. Flat fills and rules are fast to build in 33 hours.

### B. Daylight

- Mood: a friendly companion in daylight, led by photography of people.
- Type: Bricolage Grotesque 700, Lexend body.
- Light: canvas `#FCFCFA`, ink `#0A0A0A` (19.2:1), sky field `#9CC2F5` under ink (10.7:1), sun action `#F5C400` under ink (12.0:1), muted `#5E5E66` (6.2:1).
- Dark: canvas `#060606`, text `#FEFEFE` (20.0:1), sky `#9CC2F5` (11.0:1), muted `#C9C9D4` (12.3:1).
- Shape and motion: 40dp radius, pill actions, 1px outlines, no shadows, 300 ms eases.
- Source: 3. Risk: it needs real photography, and pastel fields fade on a filmed screen.

### C. Night Instrument

- Mood: a dark instrument with one signal light.
- Type: Geist 300 and 400.
- Dark: canvas `#0F1012`, text `#F2F2F4` (17.0:1), signal `#FF5A1F` (6.1:1), secondary `#A8A8AD` (8.0:1).
- Light: porcelain `#F2F2F4`, ink `#0F1012` (17.0:1), signal text `#C43E00` (4.6:1), secondary `#55565C` (6.5:1).
- Shape and motion: 4dp radius, hairlines, small capsule controls, slow fades.
- Sources: 4, 5. Risk: thin type and small controls fail low-vision and motor needs. A dark default matches the common look of AI apps.

## Screen notes

Copy tone: short, literal, verb first. TalkBack and the glasses voice speak every string (3).

Phone app:

- First run. One idea on each screen. Headline of three to six words (3).
- Meta AI handoff. A three-step tracker: Link glasses, Allow camera, Ready (6). Before each jump, a priming sheet with three fact rows: what opens, what to tap, how to return (5). On return, "Connecting..." then the status pill (5).
- Accessibility profile. One question on each screen. Speech rate: slider with preset chips, value in the title (9). Voice detail and confirm method: value rows (10). Diet and allergens: glyph rows with checkboxes (11). Play a voice sample after each change.
- Session screen. Top: status pill for glasses, battery, and camera (5). Middle: the last product as a label, price in the wide numeral (7). Below: each spoken message as text, current line in ink, older lines gray (8). Bottom: cart ledger with the total (16), then a full-width "Undo" bar (7).
- Pocket mode. A black field shows the total only. A slide on a vertical track unlocks it (12), with a two-second hold as the alternative.
- Errors. Glasses glyph in rings with a cross badge, one cause sentence, one action (13). The status pill stays visible (5). The voice speaks every error.
- Checkout. After the QR scan, a sheet names the kiosk and the total, then asks for the nod (14). The paid state turns the field black, with the amount and receipt actions (16).
- Settings. Grouped value rows (10).

Kiosk:

- Idle. Headline "Look at this code to pay", the QR code alone, a fallback line for shoppers without glasses (15).
- Cart connected. Yellow field, total pinned top center, ledger rows below (16).
- Waiting. Text names the state: "Waiting for your nod". No spinner alone.
- Paid. Black field, amount, "Paid", receipt with heavy rules (16).
- Start sizes on a 1080p display: total 160px, rows 48px.

## Landing page

1. Hero: a human moment in a real store, two small actions (3).
2. Spoken thesis: one statement reveals word by word, with captions (3).
3. Three steps as ledger rows: Look, Nod, Pay, each with a clip and a large numeral (2).
4. Accessibility chapter with real screen excerpts (3).
5. The film in a ruled frame (1).
6. Black closing field with the download link (4).

One strong idea: the page is a receipt that prints as the visitor scrolls. Each section is a line item. The page ends with a total and the download.

Media: real footage from the pitch video, or a labeled 16:9 slot.

## Anti-patterns

- Lilac gradient with a glowing voice orb. Use flat fields and a caption line.
- Card grid with soft shadows. Use rules and ledger rows (1).
- Green check against red cross as the only signal. Add a field change, a word, a haptic, and a sound.
- Thin gray text. Use weight 600 or more for prices and states.
- Chat bubbles for the spoken message. Use a timestamped caption list (8).
- Hero, three feature cards, FAQ. Use the receipt structure.

## Decision ledger of the research

- A over B: B needs photography and fades on a filmed screen.
- A over C: C depends on thin type and small controls.
- Yellow is a state field, not an accent: sources 1 and 2 define that role.
- New hex values, not a source palette: the result must not pass for a source site.
- Atkinson Hyperlegible over Inter: made for low-vision readers.
- Caption list over chat bubbles: the app must not look like a chatbot (8).
- Slide to unlock over tap: a pocket can cause a tap (12).
- One priming sheet for each jump over one explainer: sources 5 and 6 show one decision on each screen.
- Rejected: the pixel type of Weather Terminal (`fd053444-725a-4d06-9f1b-5b860f13582b`) for the nod prompt. Its legibility is low.
