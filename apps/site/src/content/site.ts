/*
 * The copy of the page. Meta Glance is a protocol: a place shows a Glance code, the glasses read it, the voice says
 * what a nod will do, and a nod confirms. The store is the first demo of that loop.
 * The mechanics come from docs/architecture.md and apps/website/README.md of the app branch. Use cases other than the
 * checkout are what the protocol enables; the page states no availability, price, partner, or certification.
 */

export const PRODUCT = {
  name: 'Meta Glance',
  claim: 'Look. Nod. Done.',
  sentence: 'Meta Glance is a protocol for AI glasses. Look at a Glance code, hear what it is and what it costs, and nod to confirm.',
};

/** The sections in page order. The sticky navigation lists the ones with a `nav` label. */
export const SECTIONS = [
  { id: 'how-it-works', nav: 'How it works' },
  { id: 'use-cases', nav: 'Use cases' },
  { id: 'demo', nav: 'The demo' },
  { id: 'builders', nav: 'For builders' },
  { id: 'team', nav: 'Team' },
  { id: 'faq', nav: 'FAQ' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export const HERO = {
  primaryAction: { label: 'See how it works', href: '#how-it-works' },
  secondaryAction: { label: 'See what you can build', href: '#use-cases' },
};

export const INTRO = {
  heading: 'A code you look at.',
  body:
    'A Glance code is a QR code with a short code inside. Any place can show one, on a screen or on a sticker. ' +
    'Your glasses read it while you look, so your hands and your phone stay free.',
};

export const LOOP = {
  heading: 'One loop for every place.',
  lead: 'The same four steps buy a ticket, open a gate, or pay for groceries.',
  steps: [
    { title: 'Look', body: 'Look at a Glance code, or at a product that the glasses know.' },
    { title: 'Hear', body: 'The voice says what it is, and what it costs or what it does.' },
    { title: 'Nod', body: 'A nod confirms. A shake says no. A look alone changes nothing.' },
    { title: 'Done', body: 'The place gets the answer: the payment goes through, the ticket is valid, the gate opens.' },
  ],
};

export type UseCase = {
  id: string;
  icon: 'checkout' | 'bus' | 'gate' | 'machine' | 'table' | 'exhibit';
  title: string;
  body: string;
  isDemo?: boolean;
};

export const USE_CASES = {
  heading: 'What you can build with it.',
  lead: 'Any place that can show a code can take a nod.',
  demoTag: 'Demo',
  /** The line that the voice says on the bus, shown in the captions window of the bus card. */
  busLine: 'Line 4 to the harbor. Single ticket. Nod to buy.',
  items: [
    {
      id: 'bus',
      icon: 'bus',
      title: 'Buy a bus ticket',
      body: 'A code by the door sells the ticket. Look at it as you board, hear the line and the fare, and nod. No app to open, no card to tap.',
    },
    {
      id: 'checkout',
      icon: 'checkout',
      title: 'Pay at a checkout',
      body: 'Look at the code on the kiosk. The voice says the store and the total. A nod pays.',
      isDemo: true,
    },
    { id: 'gate', icon: 'gate', title: 'Open a gate', body: 'At a ticket gate or a door, the voice says what the code opens. A nod lets you through.' },
    { id: 'machine', icon: 'machine', title: 'Pay a machine', body: 'A vending machine or a parking meter shows a code. Hear the item or the time and the price, and nod.' },
    { id: 'table', icon: 'table', title: 'Order at a table', body: 'The code on the table reads the menu out loud. A nod orders, a shake moves on.' },
    { id: 'exhibit', icon: 'exhibit', title: 'Hear about an exhibit', body: 'Look at the code next to a painting and hear its story. No nod needed.' },
  ] satisfies UseCase[],
};

export type Chapter = {
  id: string;
  heading: string;
  body: string;
  points: readonly { title: string; body: string }[];
  media: 'voice' | 'prompt' | 'phones' | 'privacy' | 'kiosk';
};

export const DEMO = {
  heading: 'The first demo: a store you shop with your eyes.',
  lead: 'The demo runs the whole loop in a supermarket, from the product in your hand to the payment at the exit.',
};

/** Two lines of the recorded demo shop of the phone app (DEMO_RUN), in the order the voice says them. */
export const VOICE_LINES = {
  title: 'Captions',
  older: 'Camera on. Hold a product up to hear its price.',
  newest: 'Oat drink, one litre, one eighty-nine. Nod to add.',
};

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'hear',
    heading: 'Hear what is in your hand.',
    body: 'Hold a product up. Meta Glance knows it by sight or by its barcode, and the voice says the name and the price.',
    points: [
      { title: 'By sight', body: 'The server compares the frame with reference pictures of each item that the store sells.' },
      { title: 'By barcode', body: 'The phone reads the barcode, and the store list gives the name and the price.' },
      { title: 'Undo', body: 'A shake soon after an add takes the product back out of the cart.' },
    ],
    media: 'voice',
  },
  {
    id: 'allergens',
    heading: 'A warning before the nod.',
    body: 'Set your allergens, your diet, and a budget once. You hear a warning before you add a product, and the phone shows it too.',
    points: [
      { title: 'Allergens and diets', body: 'The 14 allergens of EU law, and vegan and vegetarian diets, with the data of Open Food Facts.' },
      { title: 'Missing data', body: 'When a product has no allergen data, the voice says so. No message ever says that a product is safe.' },
      { title: 'Budget', body: 'When an add takes the total over your budget, you hear it before the nod.' },
    ],
    media: 'prompt',
  },
  {
    id: 'pocket',
    heading: 'Lock the phone. Keep shopping.',
    body: 'The phone runs the shop in the background. The camera, the voice, and the nods do not need the screen.',
    points: [
      { title: 'One notification', body: 'It shows your total, and a button that stops the camera.' },
      { title: 'A button for each move', body: 'Every nod and shake also has a button in the app.' },
      { title: 'Large text', body: 'Every label stays whole at twice the normal font size.' },
    ],
    media: 'phones',
  },
  {
    id: 'privacy',
    heading: 'Faces are pixelated on the phone.',
    body: 'The phone pixelates each face in a frame before the frame leaves the phone. When face detection fails, the phone drops the frame.',
    points: [
      { title: 'In memory only', body: 'The server keeps a frame in memory for one recognition call. It writes no frame to a disk, a database, or a log.' },
      { title: 'No saved frames', body: 'The server option that saves frames for a test is off by default.' },
    ],
    media: 'privacy',
  },
  {
    id: 'kiosk',
    heading: 'Pay with a look and a nod.',
    body: 'The kiosk shows a Glance code. Look at it, and the voice says the store and the total. A nod pays, and only while you look at the code.',
    points: [
      { title: 'The kiosk page', body: 'The code, then the cart and the total, then the result, in large type.' },
      { title: 'The mirror page', body: 'For a room: the spoken lines in large text, with the voice.' },
    ],
    media: 'kiosk',
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

export const WHY = {
  heading: 'Why a look and a nod.',
  lead: 'A screen asks for your hands and your eyes. Meta Glance asks for neither.',
  items: [
    { title: 'Hands free', body: 'Bags, a child, a cane, a stroller: you answer with your head.' },
    { title: 'Eyes free', body: 'Blind and low-vision people hear every name, price, and warning. There is no screen to read.' },
    { title: 'Phone in the pocket', body: 'The phone can stay locked. The glasses see, speak, and feel the nod.' },
    { title: 'Nothing by accident', body: 'A look only tells. You hear what a nod will do before you nod.' },
  ],
};

export const BUILDERS = {
  heading: 'Built to be built on.',
  lead:
    'A place shows a code, the glasses read it, and a server ties the two together. ' +
    'Meta could build the loop into the glasses, and any place could plug in.',
  integration: [
    { term: 'Glance code', detail: 'A plain QR code with a short code inside, such as GL1 K3X7' },
    { term: 'A place', detail: 'A screen or a sticker with the code. The place registers with the Glance server and gets each result as an event' },
    { term: 'Glance server', detail: 'Links a session to the place that the person looks at, writes what the voice says, and confirms the nod' },
    { term: 'Glasses', detail: "Ray-Ban Meta: the camera, the speakers, and the head-motion sensor that Meta's Wearables Device Access Toolkit gives an app" },
    { term: 'Phone', detail: 'An Android app that streams the camera, reads codes, and pixelates faces' },
    { term: 'Recognition', detail: 'Gemini, for products that carry no code' },
    { term: 'Voice', detail: 'ElevenLabs, in English and Italian' },
  ],
};

/** The diagram of the builders section: the protocol, after docs/architecture.md of the app branch. */
export const DIAGRAM = {
  title: 'How the Glance protocol works',
  description: 'A place shows a Glance code, the glasses see it, the phone sends the code and the nod to the Glance server, and the server confirms to the place.',
  parts: {
    glasses: { title: 'Glasses', lines: ['Ray-Ban Meta', 'Camera', 'Speakers', 'Motion sensor'] },
    phone: { title: 'Phone', lines: ['Glance app', 'Reads the code', 'Face pixelation', 'Works screen off'] },
    server: { title: 'Glance server', lines: ['Sessions', 'Places', 'Spoken lines', 'Confirmation'] },
    model: { title: 'Model and data', lines: ['Gemini', 'Store list', 'Open Food Facts'] },
    place: { title: 'Place', lines: ['Shows a Glance code', 'Checkout, bus, gate'] },
  },
  flows: {
    glassesToPhone: 'Frames, motion',
    phoneToGlasses: 'Voice',
    phoneToServer: 'Code, nod',
    serverToPhone: 'Spoken lines',
    toModel: 'Products',
    serverAndPlace: 'Register, result',
    code: 'Glance code',
  },
  legend: [
    { label: 'Data over the network', isFocal: false },
    { label: 'Seen by the camera', isFocal: true },
  ],
  textAlternative: [
    'A place, such as a checkout, a bus, or a gate, shows a Glance code. The camera of the glasses sees it.',
    'The glasses send camera frames and the motion of the head to the phone, and play the voice.',
    'The phone reads the code, pixelates each face, and sends the code and the nod to the Glance server.',
    'The Glance server sends the spoken lines back to the phone.',
    'The place registers with the Glance server and gets the result when the person nods.',
    'For a product without a code, the server asks the Gemini model, the store list, and Open Food Facts.',
  ],
};

export const TEAM_COPY = {
  heading: 'The team',
};

export const FAQ = {
  heading: 'Questions',
  items: [
    {
      question: 'What is a Glance code?',
      answer: 'A QR code with a short code inside, such as GL1 K3X7. A place shows it on a screen or a sticker, and the glasses read it when you look at it.',
    },
    {
      question: 'Do I need to take out my phone?',
      answer: 'No. The phone runs Meta Glance in the background and can stay locked in a pocket. The camera of the glasses sees, the speakers tell, and a nod answers.',
    },
    {
      question: 'What if I nod by mistake?',
      answer: 'A look alone changes nothing, and the voice says what a nod will do before you nod. At a checkout, a nod pays only while you look at its code. A shake soon after an add undoes it.',
    },
    {
      question: 'What about the people around me?',
      answer: 'The phone pixelates each face before a frame leaves the phone, and drops a frame when face detection fails. The server keeps a frame in memory for one recognition call only.',
    },
    {
      question: 'What can I build on it?',
      answer: 'Anything at a place that can show a code: a checkout, a bus, a gate, a vending machine, a table, an exhibit. The place registers with the Glance server and gets the result when the person nods.',
    },
    {
      question: 'What if I cannot nod or shake my head?',
      answer: 'Each move also has a button in the phone app.',
    },
    {
      question: 'Which languages does it speak?',
      answer: 'English and Italian, in the phone app and in the voice.',
    },
    {
      question: 'Is Meta Glance a product of Meta?',
      answer: "No. Meta Glance is a concept by an independent team, built at Junction 2026. It works with Ray-Ban Meta glasses through Meta's Wearables Device Access Toolkit.",
    },
  ],
};

export const CLOSING = {
  heading: PRODUCT.claim,
  body: 'Any code in the world, answered with a nod.',
  primaryAction: { label: 'See what you can build', href: '#use-cases' },
  secondaryAction: { label: 'Read the questions', href: '#faq' },
};

export const FOOTER = {
  independence:
    "Meta Glance is a concept by an independent team, built at Junction 2026. It is not a product of Meta, and Meta does not endorse it. It works with Ray-Ban Meta glasses through Meta's Wearables Device Access Toolkit. Meta and Ray-Ban are trademarks of their owners.",
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
