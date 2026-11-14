# Design of the phone UI

This file holds the design direction of `@glance/phone-ui`: the references, the reference lock, the decision ledger, and the tokens. `README.md` holds the behavior.

## Brief

The phone is the companion screen of a shopper who wears the glasses. The voice in the glasses does the work: it says the name and the price, and a nod adds the product. The phone shows the same facts as text, gives a button for each head and voice action, and holds the setup, the checkout sheet, the receipt, and the settings.

- Many shoppers are blind or have low vision. TalkBack, a font scale of 200 percent, and a 360 px screen are the normal case, not an edge case.
- The same screen shows on a projector in a live demo. A person in the room must read the price and the state from 3 meters.
- The phone can be offline from the internet. The page loads no remote file.

## Research

Refero research on 2026-11-14: 5 style searches, 2 full styles, 11 screen searches, 1 flow search, 8 screenshots inspected. `docs/research/2026-11-13-ui-references.md` holds the research of the day before, and this direction keeps its screen notes.

| Reference | Refero ID | What it shows | What Glance takes |
|---|---|---|---|
| Uber Eats product detail | screen `c9c922b1-3388-4212-9909-b0cf8ab55367` | Heavy black product name, price under it, pack facts in gray, one black full-width action | The product card: name, pack size, price, then the actions. Black is the color of the action that commits. |
| Uber Eats allergies | screen `53086772-cb2a-4552-8ca4-ad113ea76d45` | One allergen on each row, the control at the end of the row, a black Done | Allergens as full-width rows with a check box, not chips |
| Voicenotes live transcript | screen `97f2df3c-8378-4f3a-9b06-addd30a0d83a`, flow `14264` | Transcript lines in a fixed sheet, the line in progress in gray, Pause and End in a fixed footer | Captions as a transcript window of fixed height. Old lines in gray, the newest line in full ink. |
| Brink walking mode | screen `301b336d-a044-40e6-8df3-60898ebda1a7`, flow `10923` | A status pill over a row of live facts, two equal session actions | The status row of the session: one pill for each fact, an icon and a word in each |
| App Store purchase sheet | screen `bc846f90-b753-4b84-a69a-706b0ac8714c` | A bottom sheet that names the seller, the price, and the physical confirm step with its glyph | The checkout sheet: payee, amount, and the fingerprint step as one row with a fingerprint glyph |
| ElevenReader reading speed | screen `8298c61b-2a82-4802-9e6e-ea19114d1a6c` | The sheet title states the live value, a large selected state | Each setting shows its options as full rows, and the selected row is plain to see |
| Target shopping list, dark | screen `054f1b58-e2b9-4b10-a423-9bcfc97ffdee` | Long product names wrap over three lines, the quantity line sits under the name | Cart rows: the name wraps in full, the quantity and the unit price sit on their own line |
| The Outsiders readiness | screen `bad04d5d-93d3-4244-a586-065dff2199dd` | One huge numeral owns the top of the screen | The price and the total are the largest text on their screen |
| shadcn | style `200b455f-0b23-459c-99dc-421439de886b` | Monochrome shell, black primary and pale gray secondary actions, white panels with a hairline, color only in data | The shell: ink on a light gray canvas, white cards, color only for a state |
| Nothing | style `ef592ebd-48db-497b-935f-e0fdd0ef40ec` | Achromatic stages, one signal color kept for small active marks | Color is a signal, never decoration. Rejected: its 11 px mono labels and its serif headlines. |

## Reference lock

- Primary direction: a monochrome utility shell in the manner of Uber and shadcn, built from the stock Neutral theme of Astryx. Ink on a light gray canvas, white cards, black actions.
- Preserve: (1) one large numeral on each screen: the price, the total, the amount to pay; (2) black is the action that commits (Add, Pay, Start shopping, Done), pale gray is the other choice; (3) color only for a state, and each state also has a word and an icon; (4) full-width rows for lists and choices, never chips that cut a word; (5) captions in a dark transcript window, like subtitles.
- Borrow only: the status pills of Brink, and the fixed transcript window of Voicenotes.
- Role rules: the Neutral yellow fill means a warning (allergen, diet, budget) and nothing else. Green means paid. Red means a failure. Blue means information (look-alike notice, spot check, fingerprint step). The accent ink is for the one action that commits.
- Media: no photography and no illustration. Lucide line icons, the icon set of the Neutral theme, mark each fact. The glasses glyph in an ink disc is the only mark of identity.
- Reject: chat bubbles for the captions, a lilac or blue gradient, a glowing voice orb, cards with soft shadows for each list row, segmented controls with five options, text under 14 px, a color as the only signal.

## Decision ledger

| Decision | Source | Role kept | Why |
|---|---|---|---|
| Stock Neutral theme, no custom theme | `README.md`, spec section 4.3 and 10 | Neutral token roles | Team rule. The monochrome Neutral palette also gives the highest contrast for low vision. |
| Figtree from a file in the build, not from Google Fonts | Task constraint: no remote file | Neutral typography | The phone can be offline. A Vite alias swaps the import of `fonts.css` of the theme for `src/styles/fonts.css`. |
| Product name 26 px bold, price 42 px bold with tabular digits | Uber Eats product detail, The Outsiders | Display size of Neutral | The price is the fact that a shopper needs first, and it reads from a distance on stage. |
| Add and Skip side by side, and stacked when they do not fit | Uber Eats, Brink | Primary and secondary Button | At 100 percent both actions fit in one row above the fold. At 200 percent the row wraps and no label is cut. |
| Warnings as yellow banners with a warning glyph and "Warning:" | Prior research, Neutral warning role | Yellow = warning | A warning has a word, a glyph, and a color, so no shopper depends on the color. |
| Captions in a dark transcript window of fixed height, newest line last and in full ink | Voicenotes, TV subtitles | Dark surface of Neutral | The window keeps its height, so a new caption moves no other content. The window scrolls and keeps the last 4 lines. |
| Status as four pills with an icon and a word | Brink | Neutral muted surface | A problem state gets a warning glyph and its word, not only a color. |
| Cart rows: name in full, then "pack, qty x unit" and Remove on the next line | Target list, Square ledger | List with dividers | A name of 80 characters wraps in full and never pushes the button out of the screen. |
| Total as a large numeral at the end of the cart | Square Virtual Terminal (prior research) | Display size | The total is the second fact that a shopper asks for. |
| Ask and Undo in a dock that sticks to the bottom | Voicenotes footer, Brink actions | Primary and secondary Button | The two fast actions stay under the thumb while the cart scrolls. |
| Settings as one icon button in the header | Uber, iOS convention | IconButton | It frees the action rows for actions of the shop. |
| Choices of the settings as radio rows, not segments | ElevenReader, Uber allergies | RadioList | A segment of 62 px cut "While in view" and "Phone" at 360 px. A row holds a label of each length at 200 percent. |
| Checkout sheet: store glyph, payee, item count, amount, fingerprint row, Pay, Cancel | App Store purchase sheet | BottomSheet, primary Button | The sheet states who gets paid and how much before the only commit. |
| Receipt: a green check, "Paid", the amount, the lines, order and time, the demo line | Square receipt (prior research) | Green = paid | The paid state reads in one look and the details follow as a ledger. |
| Pocket mode: black screen, lock glyph, the total, Unlock | Prior research | Black = pocket | Unchanged in function. The total is the only content. |

## Tokens

All colors are Neutral tokens of Astryx. The values are the computed values in Chrome on 2026-11-14.

| Role | Token | Light | Dark |
|---|---|---|---|
| Canvas | `--color-background-body` | `#f1f1f1` | `#1b1b1b` |
| Card, sheet | `--color-background-card`, `--color-background-surface` | `#ffffff` | `#1b1b1b`, `#262626` |
| Text | `--color-text-primary` | `#000000` | `#ffffff` |
| Secondary text | `--color-text-secondary` | `#474747` | `#9e9e9e` |
| Commit action | `--color-accent` on `--color-on-accent` | `#1b1b1b` on `#ffffff` | `#f1f1f1` on `#111111` |
| Hairline | `--color-border` | black at 8 percent | white at 10 percent |
| Warning fill and text | `--color-warning-muted`, `--color-on-warning-muted` | `#fae19e`, `#4b3900` | yellow at 24 percent, `#eec448` |
| Paid | `--color-success`, `--color-text-success` | `#198100`, `#2f7d33` | `#64af4c`, `#90ca90` |
| Failure | `--color-text-error` | `#c0262c` | `#ffaea7` |
| Information | `--color-info` | `#0074e2` | `#6d9cfe` |
| Captions window | `--color-background-body` and `--color-text-primary` of the dark mode | `#1b1b1b`, `#ffffff` | same, with a `#525252` border |

Type scale (Neutral on a touch screen: base 16 px, ratio 1.1736). Each size is in `rem`, so it grows with the font scale of the system.

| Role | Size | Weight |
|---|---|---|
| Price, total, amount to pay | 2.625 rem (42 px) | 700, tabular digits |
| Screen title (h1), product name | 1.625 rem (26 px) | 700 |
| Section title (h2) | 1.1875 rem (19 px) | 700 |
| Newest caption | 1.1875 rem (19 px) | 500 |
| Body, older captions | 1 rem (16 px) | 400 |
| Supporting text, status pills | 0.875 rem (14 px) | 500 |

Spacing uses the Astryx steps of 4 px: 16 px page inset, 20 px card padding, 24 px between sections, 8 and 12 px inside a group. Radius: 12 px for a card (`--radius-container`), 10 px for a control (`--radius-element`), 28 px for a sheet (`--radius-page`), full for a pill.

## Components

- Each control is 48 x 48 CSS px or more: `src/styles/touch.css` raises the Astryx sizes, and `src/test/touchTargets.ts` checks each control in each test scene.
- Every Astryx component that exists is used as is: Button, IconButton, Banner, Card, BottomSheet, AlertDialog, Stepper, List, RadioList, CheckboxList, NumberInput, ScrollableArea, Divider, Icon, Theme.
- `src/styles/glance.css` holds the few app classes that Astryx has no prop for: the size of the numerals, the transcript window, the status pills, the dock, and the identity disc. Each value in it is an Astryx token or a `rem` value.

## Motion

- A new caption fades in over `--duration-medium` (300 ms). Nothing else in the page moves by itself.
- The sheets and dialogs use the motion of Astryx, which caps each move at 200 ms with reduced motion.
- With `prefers-reduced-motion: reduce`, the caption has no fade.

## Accessibility rules of the design

- Contrast of 4.5:1 or more for each text, and 3:1 for each large text and each control border that carries meaning, in light and in dark mode.
- No text is cut and no element ends right of the screen at 360 px with a root font of 200 percent, in English and in Italian.
- One `main`, one `h1`, headings in order, a name for each control, and the order of focus follows the order of reading.
- One polite live region (`useSpokenText`) speaks each caption and each cart change. No other part of the page is a live region for the same text.
