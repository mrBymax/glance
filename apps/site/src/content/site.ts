/*
 * The copy of the page. Each claim comes from the documentation of the repository:
 * README.md, docs/architecture.md, and the design spec in docs/superpowers/specs.
 * Keep the copy true to the build. The status section says what is a demo.
 */

export const PRODUCT = {
  name: 'Meta Glance',
  shortName: 'Glance',
  tagline: 'Glance tells. Nod buys.',
  sentence: 'Look at a product to hear its name and price. Nod to add it to the cart. Nod at the kiosk to pay.',
  origin: 'A prototype for Ray-Ban Meta glasses, built at Junction 2026.',
};

/** The sections in page order. The sticky navigation lists the ones with a `nav` label. */
export const SECTIONS = [
  { id: 'how-it-works', nav: 'How it works' },
  { id: 'features', nav: 'Features' },
  { id: 'technology', nav: 'Technology' },
  { id: 'status', nav: 'Status' },
  { id: 'team', nav: 'Team' },
  { id: 'faq', nav: 'FAQ' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export const HERO = {
  eyebrow: 'Scan as you shop, with your eyes and your voice',
  primaryAction: { label: 'See how it works', href: '#how-it-works' },
  secondaryAction: { label: 'What works today', href: '#status' },
  animationCaption: 'The kiosk shows a code like this one. You look at it, and a nod pays.',
};

export const INTRO = {
  heading: 'The glasses are the scanner.',
  body:
    'In scan-as-you-shop, a shopper scans each product with a handheld scanner or a phone. ' +
    'With Meta Glance, the shopper looks at the product instead. The voice in the glasses does the rest, and the phone can stay in a pocket.',
};

export const STEPS = {
  heading: 'Four moves, from the shelf to the exit.',
  lead: 'A glance never changes the cart. Only a nod does.',
  items: [
    { title: 'Look', body: 'Hold a product up and look at it. The glasses see it, and the cart stays as it is.' },
    { title: 'Hear', body: 'The voice says the name and the price, and a warning when a product does not suit your profile.' },
    { title: 'Nod', body: 'A nod adds the product. A shake skips it. You can answer while the voice still speaks.' },
    { title: 'Pay', body: 'Look at the code on the kiosk screen. The voice says the store and the total, and a nod pays.' },
  ],
};

export type Chapter = {
  id: string;
  eyebrow: string;
  heading: string;
  body: string;
  points: readonly { title: string; body: string }[];
  media: 'voice' | 'prompt' | 'phones' | 'privacy' | 'kiosk';
  mediaCaption: string;
};

/** Two lines of the recorded demo shop of the phone app (DEMO_RUN), in the order the voice says them. */
export const VOICE_LINES = {
  title: 'Captions',
  older: 'Camera on. Hold a product up to hear its price.',
  newest: 'Oat drink, one litre, one eighty-nine. Nod to add.',
};

export const FEATURES_INTRO = {
  heading: 'Built for the shopper who cannot see the label.',
  body:
    'Small print, a price on the shelf edge, an allergen list on the back of the pack. ' +
    'Meta Glance reads these out loud, so a blind or low-vision shopper can shop without help, and any shopper can shop with full hands.',
};

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'hands-free',
    eyebrow: 'Hands free, eyes free',
    heading: 'The voice does the work.',
    body: 'Each answer comes as a short spoken line in the glasses. The phone shows the same facts in large text, for a shopper who wants to read them.',
    points: [
      { title: 'By sight', body: 'The server names the product in your hand. It compares the frame with reference pictures of each item that the store sells.' },
      { title: 'By barcode', body: 'The phone reads the barcode, or the digits under it. The store list gives the name and the price.' },
      { title: 'Repeat and undo', body: 'Swipe the touchpad of the glasses to hear the last line again. A shake soon after an add undoes it.' },
    ],
    media: 'voice',
    mediaCaption: 'Two spoken lines of a recorded demo shop, as the phone app shows them in its captions.',
  },
  {
    id: 'allergens',
    eyebrow: 'Allergens and budget',
    heading: 'A warning before the nod, not after.',
    body: 'Set your allergens, your diet, and a budget once. The voice warns you before you add a product, and the phone shows the same warning.',
    points: [
      { title: 'Allergens and diets', body: 'The 14 allergens of EU law, and vegan and vegetarian diets, with the data of Open Food Facts.' },
      { title: 'Missing data', body: 'When a product has no allergen data, the voice says so. No message ever says that a product is safe.' },
      { title: 'Budget', body: 'When an add takes the total over your budget, you hear it before the nod.' },
    ],
    media: 'prompt',
    mediaCaption: 'The phone app during a demo shop: the product, its price, and a warning before the nod.',
  },
  {
    id: 'pocket',
    eyebrow: 'Phone in the pocket',
    heading: 'Lock the phone. Keep shopping.',
    body: 'The phone app runs the shop as a foreground service. The camera frames, the head answers, and the voice do not need the screen, so the phone can stay locked in a pocket.',
    points: [
      { title: 'One notification', body: 'It shows your total, and a button that stops the camera.' },
      { title: 'A button for each move', body: 'Every nod, shake, and question also has a button in the app, for a shopper who prefers to tap.' },
      { title: 'Large text', body: 'The app keeps each label whole at twice the normal font size, on a 360 pixel screen.' },
    ],
    media: 'phones',
    mediaCaption: 'The checkout and the receipt in the phone app, after a demo payment.',
  },
  {
    id: 'privacy',
    eyebrow: 'Privacy',
    heading: 'Faces stay on the phone.',
    body: 'The phone pixelates each face in a frame before the frame leaves the phone. When face detection fails, the phone drops the frame.',
    points: [
      { title: 'In memory only', body: 'The server keeps a frame in memory for one recognition call. It writes no frame to a disk, a database, or a log.' },
      { title: 'Best effort', body: 'Face detection can miss a face. The camera runs only during a shop, and you can stop it at any time.' },
      { title: 'No saved frames', body: 'The server option that saves frames for a test is off by default.' },
    ],
    media: 'privacy',
    mediaCaption: 'Each face is pixelated on the phone before a frame goes to the server.',
  },
  {
    id: 'kiosk',
    eyebrow: 'For stores and for an audience',
    heading: 'Pay with a look and a nod.',
    body: 'The kiosk page shows a code on a screen at the exit. When you look at it, the voice names the kiosk, the store, and the total. A nod pays only while you look at the code.',
    points: [
      { title: 'The kiosk page', body: 'A code, then the cart and the total, then the result, in large type.' },
      { title: 'The mirror page', body: 'For a demo on stage: it shows the spoken lines in large text and plays the voice for the room.' },
      { title: 'A staffed checkout', body: 'The kiosk tells a shopper without glasses to use a staffed checkout.' },
    ],
    media: 'kiosk',
    mediaCaption: 'The kiosk page waits for a nod. The voice has just said the total.',
  },
];

/** The kiosk page of the recorded demo run, while it waits for the nod (apps/website on the app branch). */
export const KIOSK_SCREEN = {
  place: 'Checkout 3, Demo Market',
  state: 'Waiting for your nod',
  amount: '4.49 EUR',
  lines: [
    { name: 'Rye bread', detail: '1 x 2.60 EUR' },
    { name: 'Oat drink', detail: '1 x 1.89 EUR' },
  ],
};

export const CONTROL = {
  heading: 'You stay in control.',
  items: [
    { title: 'Nothing changes without a nod', body: 'A glance only tells. The cart changes when you nod, and a shake within eight seconds undoes an add.' },
    { title: 'Stop the camera', body: 'The notification of the phone has a button that stops the camera, also with the screen locked.' },
    { title: 'English and Italian', body: 'The phone app and the voice speak English and Italian.' },
  ],
};

/** The diagram of the technology section, after docs/architecture.md of the app branch. */
export const DIAGRAM = {
  title: 'The parts of Meta Glance and what flows between them',
  description:
    'Data flows from the glasses through the phone to the server, which asks a model and the product data, speaks back through the phone, and updates the kiosk and the mirror.',
  parts: {
    glasses: { title: 'Glasses', lines: ['Ray-Ban Meta', 'Camera', 'Speakers', 'Motion sensor'] },
    phone: { title: 'Phone', lines: ['Android app', 'Camera stream', 'Barcode reading', 'Face pixelation', 'Works screen off'] },
    server: { title: 'Server', lines: ['Node.js', 'Recognition', 'Cart rules', 'Spoken lines', 'Kiosk checkout'] },
    model: { title: 'Model', lines: ['Gemini'] },
    storeList: { title: 'Store list', lines: ['Names and prices'] },
    openFoodFacts: { title: 'Open Food Facts', lines: ['Allergens, diets'] },
    sources: { title: 'Model and data', lines: ['The server asks', 'Gemini, the model', 'The store list', 'Open Food Facts'] },
    kiosk: { title: 'Kiosk page', lines: ['Shows the QR code'] },
    mirror: { title: 'Mirror page', lines: ['Lines for the room'] },
  },
  flows: {
    glassesToPhone: 'Frames, motion',
    phoneToGlasses: 'Spoken lines',
    frames: 'Pixelated frames',
    answers: 'Nods, codes',
    serverToPhone: 'Lines, cart',
    toModel: 'Frames',
    toStoreList: 'Barcode',
    toOpenFoodFacts: 'Barcode',
    toSources: 'Frames, barcodes',
    toKiosk: 'Cart, result',
    toMirror: 'Lines, cart',
    qr: 'QR code',
  },
  legend: [
    { label: 'Data over the network', isFocal: false },
    { label: 'Seen by the camera', isFocal: true },
  ],
  textAlternative: [
    'The glasses send camera frames and the motion of the head to the phone. The phone plays the spoken lines in the glasses.',
    'The phone reads barcodes, pixelates each face, and keeps the shop running with the screen off.',
    'The phone sends the pixelated frames to the server, with the nods and shakes and each barcode and QR code that it reads.',
    'The server sends the spoken lines and the cart back to the phone.',
    'The server asks the Gemini model to name the product in a frame, and looks up a barcode in the store list and in Open Food Facts.',
    'The server sends the cart and the result of the payment to the kiosk page, and the lines and the cart to the mirror page.',
    'The kiosk page shows a QR code. The camera of the glasses sees it, and that starts the payment.',
  ],
};

export const TECHNOLOGY = {
  heading: 'How the parts talk.',
  lead: 'The glasses see and speak, the phone connects, the server decides, and a model names the product. The kiosk and the mirror show the result.',
  specs: [
    { term: 'Glasses', detail: "Ray-Ban Meta glasses, through Meta's Wearables Device Access Toolkit" },
    { term: 'Phone', detail: 'Android 10 or later' },
    { term: 'Server', detail: 'Node.js 22, TypeScript, Fastify' },
    { term: 'Recognition', detail: 'Gemini, with up to three reference pictures for each store item' },
    { term: 'Voice', detail: 'ElevenLabs' },
    { term: 'Product data', detail: 'A store list file, and Open Food Facts for allergens and diets' },
    { term: 'Languages', detail: 'English and Italian' },
  ],
};

export const STATUS = {
  eyebrow: 'Status',
  heading: 'A prototype, said plainly.',
  lead: 'Meta Glance is a hackathon prototype. Some parts run end to end, and some parts are a demo.',
  real: {
    title: 'Works today',
    items: [
      'One shop runs from the first glance to the payment, against the server in test mode.',
      'Barcode lookup in the store list, with allergens and diets from Open Food Facts.',
      'The phone app, the kiosk page, and the mirror page.',
    ],
  },
  demo: {
    title: 'A demo today',
    items: [
      'The payment is a mock. No money moves.',
      'The store list is a file in place of the stock system of a supermarket. Its prices are invented.',
      'One test with real glasses ran on 14 November 2026. In it, the phone read no barcode at arm length.',
      'The head gestures were rebuilt after that test. Since then, only synthetic test motion has checked them.',
      'Spoken questions and voice commands work only in the mock mode of the app, without real glasses.',
      'Blind and low-vision shoppers have not tested Meta Glance yet.',
    ],
  },
};

export const TEAM_COPY = {
  heading: 'The team',
  lead: 'Four people built Meta Glance at Junction 2026 in Espoo, for the Meta challenge "AI Glasses for Everyone, Everyday".',
};

export const FAQ = {
  heading: 'Questions',
  items: [
    {
      question: 'Is Meta Glance a product of Meta?',
      answer: "No. Meta Glance is an independent prototype, built at a hackathon. It works with Ray-Ban Meta glasses through Meta's Wearables Device Access Toolkit.",
    },
    {
      question: 'Can I use it in a store today?',
      answer: 'No. The payment is a demo, and the store list is a file that stands in for the stock system of a supermarket. The store list sits behind one interface, so the system of a real store can take its place.',
    },
    {
      question: 'What do I need?',
      answer: 'Ray-Ban Meta glasses, an Android phone with Android 10 or later, and the Meta AI app and the Meta Glance app on the phone.',
    },
    {
      question: 'Does the camera record the people around me?',
      answer: 'The phone pixelates each face before a frame leaves the phone, and drops the frame when face detection fails. The server keeps a frame in memory for one recognition call only. Face detection is best effort, so it can miss a face.',
    },
    {
      question: 'What if Glance names the wrong product?',
      answer: 'You hear the name and the price before the cart changes. Shake your head to skip the product, or undo the last add. A barcode that the store list does not hold gets the line "This product is not in this store."',
    },
    {
      question: 'What if I cannot nod or shake my head?',
      answer: 'Each move also has a button in the phone app: add, skip, undo, and repeat.',
    },
    {
      question: 'Which languages does it speak?',
      answer: 'English and Italian, in the phone app and in the voice. Voice commands are in English only.',
    },
  ],
};

export const CLOSING = {
  heading: PRODUCT.tagline,
  body: 'A look tells you the name and the price. Your nod is the only thing that changes the cart.',
  primaryAction: { label: 'See how it works', href: '#how-it-works' },
  secondaryAction: { label: 'Read the questions', href: '#faq' },
};

export const FOOTER = {
  independence:
    "Meta Glance is an independent prototype, built at Junction 2026. It is not a product of Meta, and Meta does not endorse it. It works with Ray-Ban Meta glasses through Meta's Wearables Device Access Toolkit. Meta and Ray-Ban are trademarks of their owners.",
  openFoodFacts: {
    before: 'Product data from ',
    name: 'Open Food Facts',
    href: 'https://world.openfoodfacts.org',
    middle: ', available under the ',
    licence: 'Open Database License',
    licenceHref: 'https://opendatacommons.org/licenses/odbl/1-0/',
    after: '.',
  },
};
