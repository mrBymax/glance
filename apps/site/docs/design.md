# Design of the product site

This file holds the design direction of `@glance/site`: the brief, the research, the reference lock, the decision ledger, the tokens, and the standards that the page meets. `README.md` holds how to run, build, and edit it.

## Brief

The site presents Meta Glance to a jury, to the people at a demo table, and to anyone who gets the link after the hackathon. It has one page and no store.

- The page shows what Meta Glance does, for whom, how it works, and what is real today.
- It uses the visual language of the phone app: the stock Neutral theme of Astryx, ink on a light gray canvas, white cards, black for the one action that commits, one large numeral, Lucide icons, and color only for a state. The owner asked for the Optimistic font in place of the Figtree of the app.
- The owner asked for the structure and the pacing of the product page of Meta Ray-Ban Display (meta.com, Finnish English edition). The site takes the rhythm of that page, not its copy, images, fonts, or brand.
- Meta Glance is not a product of Meta. The page says so in the footer and in the questions.

## The reference page

On 2026-11-14 a plain fetch of the page returned only the cookie dialog. Headless Chrome rendered it after "Decline optional cookies", and a script read its outline and took viewport pictures at 1440 x 900. The pictures stayed in a scratch folder. Nothing from the page is in this repository.

What the outline and the pictures showed, from the top:

| Order | Section on the reference page | Section on this site |
|---|---|---|
| 1 | Global navigation, then a full-viewport film with a small label, a 64 px headline, and two pill actions at the bottom center | Sticky bar, then the hero: a dark rounded stage with the animation, the product name, one sentence, two actions |
| 2 | A pinned, scroll-driven product reveal of about five screens | Not copied. A scroll-jacked reveal works against keyboard and screen reader use. The animation plays once in the hero instead. |
| 3 | A sticky product bar from here on: product name on the left, one action on the right | The sticky bar holds the product name, the section links, and one action from the first screen |
| 4 | A centered 48 px statement, then large rounded media cards with a 64 px chapter title on the picture | "The glasses are the scanner.", then the four steps |
| 5 | Feature chapters: a centered heading and lead, then a feature list beside a rounded film | Five feature chapters: text beside a rounded stage, the side alternating |
| 6 | Two media cards side by side, with a 36 px title under each | The checkout and receipt pair, and the privacy pair |
| 7 | A three-column block about the app, privacy, and accessibility | "You stay in control.": three unboxed items |
| 8 | A comparison of two products | "How the parts talk.": the diagram and the specification list |
| 9 | Questions in groups, as an accordion | "Questions": heading on the left, rows on the right |
| 10 | A large footer | Closing statement with two actions, then the footer |

The type of the reference is one grotesk at weight 500: 64 px for chapter openers, 48 px for section heads, 36, 28, and 24 px below. Sections sit about 120 px apart. Media cards have a radius of about 32 px and a 32 px margin from the window edge.

## Research

Refero research on 2026-11-14: 4 style searches (monochrome hardware landing page, wearable product page on a light canvas, accessibility-first product site, editorial hardware brands), 2 full styles, 4 screen searches, 1 screenshot. The phone app research of the same day (`apps/mobile/ui/docs/design.md` on the app branch) also counts, because the site keeps the app language.

| Reference | Refero ID | What it shows | What the site takes |
|---|---|---|---|
| 1X | style `55fdc160-3aec-4a0f-9e32-cc652570c077` | A light product page: a full-bleed opening with a small product identity, centered chapter headings, demonstrations in very large rounded frames, unboxed feature rows, a persistent product rail, a closing object that fades into the canvas | The page grammar: the hero, the rounded stages, the unboxed points and control items, the closing object (the last frame of the animation) |
| Peloton | style `1137b9b3-e670-4e4a-9292-84589dbb3ec4` | A connected-product page that ends practical: a charcoal reassurance band, a FAQ with the heading on the left and ruled rows on the right, a quiet service footer | The status band in the dark theme, the layout of the questions, the plain footer |
| shadcn | style `200b455f-0b23-459c-99dc-421439de886b` (from the app research) | Monochrome shell, black primary action, hairline panels, color only in data | Kept from the app: the shell and the role of black |
| Nothing | style `ef592ebd-48db-497b-935f-e0fdd0ef40ec` (from the app research) | Achromatic stages, one signal color for small marks | Kept from the app: color as a signal only |
| Peak Performance "Friends" | screen `7b497d5e-1870-4556-8fea-84bbdb2e651e` | A four-column grid of people under a centered intro | The team grid: four portraits of one ratio, the name under each |
| Buy Me a Coffee FAQ | screen `d55332c0-440b-4b7b-8624-7dc286609dc4` | A single list of questions with hairline dividers | Questions as ruled rows, not cards |
| Voicenotes live transcript | screen `97f2df3c-8378-4f3a-9b06-addd30a0d83a` (from the app research) | Transcript lines in a dark window, the newest line in full ink | The captions window of the first feature chapter |
| The Outsiders readiness | screen `bad04d5d-93d3-4244-a586-065dff2199dd` (from the app research) | One huge numeral owns the screen | The numerals of the four steps |

## Reference lock

- Primary direction: the phone app itself, the stock Neutral theme of Astryx, laid out with the product-page grammar of 1X and the pacing of the reference page.
- Preserve: (1) ink on the light gray canvas, white stages, black for the one action that commits; (2) one large numeral per step, as the app shows one large number per screen; (3) color only for a state: the yellow warning and the green paid state come from the real app screens, the green check marks what works today; (4) dark stages for the hero, the captions, and the status, like the captions window of the app; (5) real product frames, never a drawn imitation of the app.
- Borrow only: the rounded demonstration stage of 1X, and the practical ending of Peloton (status band, FAQ rows, quiet footer).
- Role rules: black (`--color-accent`) is the primary action and the bezel of a device. Neutral yellow means a warning. Green means paid or done. The blue of the card frame in the hero belongs to the animation asset and appears nowhere else.
- Media: the Three.js animation of the team for the hero, with a poster of its last frame; screenshots of the phone app taken from its replay mode; the kiosk page drawn with the page tokens; the four team photos; one team photo pixelated by the build script to show what face pixelation does; the logo files of the project. No stock photo, no generated image, no product photo of Meta.
- Reject: a scroll-jacked reveal, autoplaying films, pill buttons that the app does not have, a blue or violet accent, gradient cards, a giant footer logo, text under 14 px, a light picture with a hard edge on a dark page.

## Decision ledger

| Decision | Source | Role kept | Why |
|---|---|---|---|
| Stock Neutral theme, Lucide icons | App `README.md` and `docs/design.md`, owner request | Neutral token roles | The owner asked for the style of the app. |
| Optimistic VF for each text, from the build, with a metric-matched Arial fallback | Owner request (the owner supplied the file) | `--font-family-body` and `--font-family-heading` of each theme scope | No remote request and no line moves at the swap. The `DRKM` axis of the font is 1 on dark grounds, so a weight looks the same in both schemes. The licence must be confirmed before publication. |
| The project logo (`assets/Glance.svg`, `Glance Dark.svg`) in the header, footer, favicon, and social preview | Owner request | Logo | The light file has a dark word mark, the dark file a white one: each scheme gets its own. The build script slims each file from 357 KB to 24 KB without a change to its drawing. |
| Hero as a dark rounded stage inset from the window edge, exactly one viewport high with the header | Reference page (full-bleed film), 1X (huge media radii), app captions window, owner review | Dark Neutral surface with a soft light spot | The animation needs a dark stage, as in `assets/animation/example.html`. The height is `100dvh` less the measured header and the margin: the bottom of the hero is the bottom of the viewport at 360 x 800, 1366 x 768, 1440 x 900, and 1920 x 1080. |
| The clip ends on the kiosk QR card, which then sways slowly and tilts toward the pointer | Reference page (the product turns slowly after its reveal), owner review | Media role of the asset | The card is the code that a nod pays, so it is the right last image. A freeze looked broken; a soft hold looks finished. The repository is private, so the QR holds the code of the demo kiosk, not a link. |
| Studio light: a room environment for reflections, neutral tone mapping, a closer camera, a pixel ratio of 2 at most | Owner review, `example.html` as the start | Media | ACES tone mapping greyed the blue frame and the white card, and the card filled a fifth of the frame. |
| Animation after the load event and an idle moment, poster first | Core Web Vitals, owner request | Media role of the asset | The poster is the largest paint (448 to 508 ms locally). Three.js and the GLB never compete with it. |
| No animation with reduced motion or Save-Data; a play button in each case | WCAG 2.3.3 and 2.2.2, `prefers-reduced-motion` | Media | The clip lasts 6 s, more than 5 s, so it gets a pause and a replay control. |
| Sticky bar with the section links from the first screen, a pill that slides to the current section | Reference page (sticky product bar), owner review | Neutral body canvas with a hairline; card pill | One bar instead of two: the site has no global navigation to keep. On a phone the row of links scrolls the current link into view. |
| Steps as four huge numerals with a short title and one sentence | App rule "one large numeral", The Outsiders | Display size, bold, tabular digits | The four steps are the whole product, and they read in one look. |
| Feature chapters: copy beside a rounded stage, alternating sides | Reference page chapters, 1X capability chapters | White card stage on the gray canvas | The same rhythm as the reference, with real product frames as the media. |
| Real screenshots of the phone app | Refero rule on imagery: real assets over imitations | App screens in light and dark | The frames come from the replay mode of the app branch build, so each one is true. Each phone frame has a dark-scheme twin in a dark bezel. |
| The kiosk page drawn with the page tokens, in a bezel | Owner review: the light screenshot had a hard edge on the dark page | Canvas and text tokens; the QR stays black on white | The kiosk page has only a light scheme, so a screenshot cannot follow the page. The drawing uses the text and amounts of the demo run. The QR code keeps its quiet zone, so it still scans in the dark scheme. |
| Privacy shown with a pixelated team photo | Spec: the phone pixelates each face before upload | Photography | The effect is shown, not described. The photo is of a team member, not of a stranger. |
| Status as a dark band with two lists | Peloton reassurance band, owner request for honesty | Dark Neutral surface, green check only for "works today" | The limits of a hackathon prototype are part of the story, not small print. |
| Team as four 4:5 portraits in alphabetical order of the first name, the title under each name | Peak Performance screen, owner review | Photography | The owner gave the names and the titles. A subgrid keeps the names and the titles of a row on one line, whatever the length of a title. |
| Questions with the heading left, rows right, the first one open; each answer opens with an animated height and a turning chevron | Peloton FAQ, Buy Me a Coffee screen, WAI-ARIA disclosure pattern, owner review | Hairline rows | The first answer, "not a product of Meta", is too important to hide. A button inside a heading gives each question a name and a state. |
| The diagram of the parts as a designed piece: two SVG drawings of one content, orthogonal connectors, one focal path | The `diagram-design` skill (architecture type), `docs/architecture.md` of the app branch, owner review | Card stage; the focal path is ink and dashed, the network paths are the secondary icon color | Eight parts and eleven flows, within the budget of the skill. The focal path is the QR code that the camera sees, because it is the one flow that is not a network message. Text is never under 14 px: the wide drawing shows from a 70 rem figure, the tall one below. |
| Motion: a reveal on scroll, staggered in grids; numerals that rise into place; lines of the diagram that draw in; a lift on hover for the primary actions and the cards | Owner review, Motion docs (`LazyMotion`, `MotionConfig reducedMotion="user"`) | Opacity and transform only | Nothing moves layout, and nothing waits for the script: the server HTML shows each element, and only an element below the viewport hides until it scrolls in. With reduced motion, Motion keeps the fades and drops each move. |
| Closing: the last frame of the animation, the tagline, two actions | 1X sculptural conversion | Poster asset | The page ends on the kiosk code that a nod pays. |
| Footer: independence notice and Open Food Facts credit with ODbL link | Owner instruction, Open Food Facts licence | Secondary text | Required notices, in plain words. |

## Tokens

All colors are Neutral tokens. The site adds no color. The dark stages nest a `Theme` of Astryx with `mode="dark"`, so their tokens are the dark tokens in both schemes. In the dark scheme, where the canvas is dark as well, those stages use `--color-background-surface`.

| Role | Token |
|---|---|
| Canvas | `--color-background-body` |
| Stage, diagram, card | `--color-background-card` |
| Text | `--color-text-primary` |
| Secondary text | `--color-text-secondary` |
| Primary action, mark disc | `--color-accent` on `--color-on-accent` |
| Hairline | `--color-border`, `--color-border-emphasized` |
| Done | `--color-icon-success` |

The typeface is Optimistic VF (weights 300 to 800). The type scale is larger than the app scale, because a landing page is read at arm length on a desktop. Each size is a `clamp()` in `rem`, so it grows with the font size of the browser.

| Role | Size at 360 px | Size at 1440 px | Weight |
|---|---|---|---|
| Product name (h1) | 45 px | 80 px | 700 |
| Statement (intro and closing h2) | 33 px | 60 px | 600 |
| Section title (h2) | 30 px | 52 px | 600 |
| Step numeral | 72 px | 128 px | 700, tabular |
| Chapter title (h3) | 26 px | 40 px | 600 |
| Lead | 18 px | 22 px | 400 |
| Body | 17 px | 17 px | 400 |
| Small text (captions, labels, team titles) | 15 px | 15 px | 400 to 600 |
| Text of the diagram | 14 px or more | 14 to 16 px | 500 to 600 |

Space: a section gap of `clamp(4rem, 2.5rem + 6vw, 8rem)`, a gutter of `clamp(1rem, 0.5rem + 2.5vw, 2rem)`, a content width of 82 rem, and a text measure of 40 rem (about 70 characters). Radius: `--radius-page` (28 px) for stages, `--radius-container` (12 px) for cards and photos.

## Standards

| Standard | What the page does | How it was checked |
|---|---|---|
| WCAG 2.2 AA contrast (1.4.3, 1.4.11) | Lowest text contrast 6.43:1 in light and 5.65:1 in dark | Computed colors in Chrome, each text role; axe `color-contrast` at 4 viewports and 2 schemes |
| 2.4.1 Bypass blocks | Skip link to `main` | Keyboard pass |
| 2.4.7 and 2.4.11 Focus visible, not obscured | Astryx focus rings, a 2 px outline on page links, `scroll-padding-top` the height of the sticky bar | Keyboard pass in `scripts/check-page.mjs` |
| 2.5.8 Target size | 24 px or more for each target, 44 px for the section links, the footer links, and the action of the sticky bar, 48 px for the actions of the hero and the closing | `scripts/check-page.mjs` |
| 1.3.1 and 2.4.6 Structure | One `h1`, headings in order, landmarks: header, two named navs, main, footer; each section labeled by its heading | axe, outline print in `scripts/check-page.mjs`, `src/App.test.tsx` |
| 2.2.2 and 2.3.3 Motion | No autoplay with reduced motion; a pause and replay button; smooth scroll only without reduced motion | `src/App.test.tsx`, code |
| 1.1.1 Text alternatives | Each app screen has an alt text that states its content; the team photos are decorative next to the names | axe |
| Core Web Vitals (LCP 2.5 s or less, CLS 0.1 or less, INP 200 ms or less) | Prerendered HTML, the poster with a high fetch priority, reserved sizes for each image and for the animation | LCP 448 to 508 ms and CLS 0 locally, without throttling. INP was not measured. |
| Responsive | Breakpoints at 37.5 rem (600 px), 56.25 rem (900 px), and 64 rem (1024 px); no sideways scroll from 360 px to 1920 px | Screenshots and an overflow check at 360, 768, 1440, 1920 |
| Performance budget | 500 KB or less until the load event, raised from 300 KB for the supplied font (179 KB, which its licence forbids to subset); the 3D files only after it | 303 to 482 KB at the load event over two runs |
