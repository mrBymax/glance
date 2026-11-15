# Demo and shoot run sheet

Owner: seat 4. Sources: sections 15, 17, and 18 of `docs/superpowers/specs/2026-11-13-meta-glance-design.md`.

## Times (Finnish time)

| Time | Step |
|---|---|
| Saturday 13:00 | M1: a glance speaks on the real glasses. Without M1 at 14:00, only extras 1 to 3 stay. |
| Saturday 17:00 | M2: the core works end to end, with the kiosk. |
| Saturday 18:00 | Feature freeze. The shoot starts. |
| Saturday 18:00 to 21:00 | Shoot the demo store at the venue first. Then shoot plain footage in a real store before it closes. |
| Sunday 02:00 | The video cut, the website, and the deck are done. |
| Sunday 07:00 | Submit. |
| Sunday 08:00 | Team deadline. |

## Demo store

- A table or a shelf with the products of `apps/server/catalog/catalog.json`. One shelf is low, for the put-back.
- The kiosk page on a laptop at seated eye height. The store name is Demo Market. The code is 15 cm wide or more.
- The mirror page on a second screen. Viewers hear and read the voice there.
- A phone hotspot for the phone and the kiosk laptop, if the venue network fails.

## Before each take

1. Charge the glasses. One charge gives about 30 minutes of stream. Keep the case near.
2. Make sure that Developer Mode is on in the Meta AI app. An update can turn it off.
3. Open the kiosk page at `/kiosk` of the site. Make sure that it shows its code.
4. Start a new session on the phone. On the second screen, open `https://<domain>/mirror?latest=<DEMO_KEY>` and press Start mirror. The page follows the newest session of the phone. `DEMO_KEY` is in `infra/.env` on the server (Plan 1 Task 22).
5. Make sure that the capture LED is in the frame of the video camera.
6. Do three clean runs in a row before the first take.

## Main take (about 90 seconds)

Prices and totals follow the catalog. The lines below use the example values of the design.

| Step | Action | The voice says | Check |
|---|---|---|---|
| 1 | Start the session on the phone. | "Camera on. Hold a product up to hear its price." | The capture LED is on. |
| 2 | Hold the oat drink up. Put it back on the low shelf. | "Oat drink, one litre, one eighty-nine. Nod to add." | The cart does not change. |
| 3 | Hold the rye bread up. Nod. | "Added rye bread. Total two sixty." | The mirror page shows one item. |
| 4 | Hold a third product up. Shake your head. | "Skipped." | With the allergen guard, the warning comes first. |
| 5 | Show the phone to the camera. | | The captions and the cart are on the screen. |
| 6 | Look at the kiosk code. Nod after the prompt. | "Checkout 3 at Demo Market. One item, two euros sixty. Nod to pay." Then: "Paid. Two euros sixty. Your receipt is on your phone. Camera off." | The kiosk shows "Paid". The LED goes dark. |

## Separate shots

Each shot uses real hardware.

1. Take the glasses off the face. The phone names the state. Then fold the glasses. The phone names the state. A fold ends the session, so the shot ends there.
2. If extra 3 is done: hold up the two look-alike products. The voice says: "I cannot tell which oat drink this is. Turn the front to me."
3. If extra 4 is done: add the HUD clip from the Display simulator. Label it "Simulation".

## Fallbacks

- The glasses fail: use mock mode with the phone camera. Label the shot "Simulation".
- The kiosk fails: use a screen recording of the kiosk.
- The venue network fails: use the phone hotspot.

## Lines for the pitch

Say each line:

- The payment is a demo.
- The catalog has 12 products.
- Blind and low-vision shoppers have not tested Glance yet. The next step is a test with the Finnish Federation of the Visually Impaired. If a blind or low-vision person tests Glance on Saturday, show that test and change this line.
- The camera runs for the whole session. A product needs a wake signal on the glasses.

Do not say:

- The store installs nothing.
- The store lends glasses.

## Numbers to measure

Each result goes into `apps/website/src/content/numbers.json`, with the test conditions in `context`. Do not write an estimate.

| ID in `numbers.json` | Measure | Method | Seat | Target |
|---|---|---|---|---|
| `accuracy-correct`, `accuracy-wrong` | Recognition on 100 frames over all products | Put the frames in `apps/server/testdata/frames/<product ID>/`. Run `npm run replay --workspace apps/server -- --frames testdata/frames`. Read the lines `accuracy:` and `wrong identified:`. | 2 | No wrong `identified` |
| `latency-median`, `latency-p95` | Time from glance to voice at the venue | Film 20 glances with the sound of the mirror page. In the video editor, read the time from the product at rest to the first sound of the line. Sort the 20 values. The median is the mean of values 10 and 11. The 95th percentile is value 19. | 4 | None. The design estimates 2 to 4 seconds. |
| `false-yes`, `false-no` | Walk test | Plan 2 Task 8: two people, 7.5 minutes each, walk, talk, look at shelves, and do 10 put-backs on a low shelf, with no nod and no shake. Each nod that the detector reports is a false yes. Each shake is a false no. | 1 | 0 and 0 |
| `battery` | Battery after 10 minutes | Plan 2 Task 4: the 10 minute endurance run of the probe. Read the battery level at the start and at the end. | 1 | None |
| `kiosk-distance` | Distance at which the kiosk code decodes | Plan 2 Task 4: the largest distance with a decode, measured from a chair. | 1 | 1.5 m or more |
| Pitch only | Nod on five heads | Five people nod after a prompt, five times each. Count the accepted nods. | 1 | None |

## Glasses log

One charge gives about 30 minutes of stream. Write each use here. Charge the glasses in each break.

| From | To | Who | Purpose | Battery at start | Battery at end |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## After the event

- Seat 2 deletes all sessions and orders by 30 November 2026. The privacy page states this date.
