import { mainYes, type MainYes, type Probe } from './probe';

// `research` is the file path, a comma, and the section name.
export type Source = { research: string; name: string; url: string | null };
export type Claim = { text: string; source?: Source };
export type Step = { title: string; text: string };
export type TeamMember = { name: string; role: string };
export type Links = { videoId: string | null; apkUrl: string | null; repoUrl: string };
export type LandingCopy = {
  brand: string; headline: string; lead: string;
  headings: { story: string; video: string; steps: string; accessibility: string; data: string; numbers: string; tryIt: string; team: string };
  story: Claim[]; videoCaption: string; videoMissing: string; steps: Step[]; rules: string[];
  accessibility: Claim[]; data: Claim[]; privacyLink: string; numbersMissing: string; tradeoff: string;
  trySetup: Claim; trySteps: string[]; tryNotes: Claim[]; apkLabel: string; apkMissing: string;
  event: Claim; builtWith: string; disclaimer: string; repoLabel: string;
};

export const LINKS: Links = { videoId: null, apkUrl: null, repoUrl: 'https://github.com/mrBymax/glance' };
export const TEAM: TeamMember[] = [];
// The number of entries in apps/server/catalog/catalog.json.
export const CATALOG_SIZE = 12;

const CONTEXT = 'docs/research/2026-11-13-context-and-prior-art.md';
const ACCESSIBILITY = 'docs/research/2026-11-13-accessibility-and-trust.md';
const FEASIBILITY = 'docs/research/2026-11-13-dat-feasibility.md';

const SOURCES = {
  sGroup: {
    research: `${CONTEXT}, Retail facts`,
    name: 'SOK press release, 25 June 2026',
    url: 'https://www.sttinfo.fi/tiedote/72160887/ei-enaa-ostosten-nostelua-hihnalle-keraa-ja-skannaa-palvelun-kaytto-onnistuu-yha-useammassa-myymalassa-omalla-puhelimella?lang=fi',
  },
  amazon: {
    research: `${CONTEXT}, Retail facts`,
    name: 'Retail Dive, 3 April 2024',
    url: 'https://www.retaildive.com/news/amazon-removes-just-walk-out-tech-amazon-fresh-stores-dash-carts/712150',
  },
  gs1: {
    research: `${ACCESSIBILITY}, section 2`,
    name: 'Packaging Europe, 12 January 2026',
    url: 'https://packagingeurope.com/news/seven-in-ten-visually-impaired-consumers-struggle-to-read-food-labels/13795.article',
  },
  accessBoard: {
    research: `${ACCESSIBILITY}, section 2`,
    name: 'US Access Board, 27 September 2022',
    url: 'https://www.access-board.gov/news/2022/09/27/u-s-access-board-seeks-public-comment-on-accessibility-guidelines-for-self-service-transaction-machines/',
  },
  eaaScope: {
    research: `${ACCESSIBILITY}, section 1`,
    name: 'Directive (EU) 2019/882, Article 2',
    url: 'https://www.legislation.gov.uk/eudr/2019/882/article/2',
  },
  eaaOld: {
    research: `${ACCESSIBILITY}, section 1`,
    name: 'Directive (EU) 2019/882, Article 32',
    url: 'https://www.legislation.gov.uk/eudr/2019/882/article/32',
  },
  metaUse: {
    research: `${CONTEXT}, Meta policy for DAT apps`,
    name: 'Meta acceptable use guidance',
    url: 'https://wearables.developer.meta.com/docs/develop/dat/acceptable-use',
  },
  led: {
    research: `${FEASIBILITY}, Camera`,
    name: 'Meta DAT issue 318',
    url: 'https://github.com/meta/meta-wearables-dat-ios/issues/318',
  },
  devMode: {
    research: `${FEASIBILITY}, Registration and distribution`,
    name: 'Meta DAT docs, getting started',
    url: 'https://wearables.developer.meta.com/docs/develop/dat/getting-started-toolkit',
  },
  oneApp: {
    research: `${FEASIBILITY}, Registration and distribution`,
    name: 'Meta DAT docs, permission requests',
    url: 'https://wearables.developer.meta.com/docs/develop/dat/permissions-requests',
  },
  devModeOff: {
    research: `${FEASIBILITY}, Registration and distribution`,
    name: 'Meta DAT skill, iOS debugging',
    url: null,
  },
  junction: {
    research: `${CONTEXT}, Junction 2026`,
    name: 'Junction 2026',
    url: 'https://2026.hackjunction.com/',
  },
} satisfies Record<string, Source>;

type YesCopy = { headline: string; stepTitle: string; add: string; skip: string; pay: string };

// The spec gives the lines for `head` and `touch`. The lines for `key` are a choice of Plan 4.
const YES_COPY: Record<MainYes, YesCopy> = {
  head: {
    headline: 'Glance tells. Nod buys.',
    stepTitle: 'Nod',
    add: 'Nod to add the product.',
    skip: 'Shake your head to skip it.',
    pay: 'Nod to pay.',
  },
  touch: {
    headline: 'Glance tells. Tap buys.',
    stepTitle: 'Tap',
    add: 'Double tap the side of the glasses to add the product.',
    skip: 'Press Skip on the phone to skip it.',
    pay: 'Double tap to pay.',
  },
  key: {
    headline: 'Glance tells. Press buys.',
    stepTitle: 'Press',
    add: 'Press volume up on the phone to add the product.',
    skip: 'Press volume down to skip it.',
    pay: 'Press volume up to pay.',
  },
};

// The list has two to four parts: the phone button, and one other input or more.
const COUNT_WORDS = ['two', 'three', 'four'];

function yesInputs(probe: Probe): string {
  const parts = [
    ...(probe.motion ? ['a nod'] : []),
    ...(probe.speech === 'glasses' ? ['a spoken word'] : []),
    ...(probe.inputs ? ['a double tap on the glasses'] : []),
    ...(!probe.motion && !probe.inputs ? ['the volume keys of the phone'] : []),
    'a button on the phone',
  ];
  const list = parts.length <= 2
    ? parts.join(' or ')
    : `${parts.slice(0, -1).join(', ')}, or ${parts.at(-1)}`;
  return `You can add a product or pay in ${COUNT_WORDS[parts.length - 2]} ways. Use ${list}.`;
}

const AUDIO: Record<Probe['speech'], string> = {
  glasses: 'No raw audio leaves the glasses. The glasses turn your speech into text.',
  phone: 'Voice input uses the speech service of your Android phone, after you press the microphone button.',
  none: 'Glance does not use a microphone.',
};

const RELEASE_CHANNEL_STEP = 'Ask the team for an invite to the Glance release channel. Accept it with your Meta account.';

export function landingCopy(probe: Probe): LandingCopy {
  const yes = YES_COPY[mainYes(probe)];
  const trySteps = [
    'In the Meta AI app, open Settings, then App Info.',
    'Tap the app version five times. A Developer Mode toggle appears.',
    'Turn Developer Mode on and confirm.',
    'Download the APK on the phone and install it. Android asks you to allow the install.',
    'Open Glance and follow the three setup steps: link glasses, allow camera, ready.',
  ];
  if (probe.access === 'releaseChannel') trySteps.splice(3, 0, RELEASE_CHANNEL_STEP);

  return {
    brand: 'Meta Glance',
    headline: yes.headline,
    lead: 'Meta Glance makes smart glasses the scanner for scan-as-you-shop. A glance tells you the name and the price. Only a deliberate yes changes your cart.',
    headings: {
      story: 'Why glasses',
      video: 'The demo',
      steps: 'Three steps',
      accessibility: 'Accessibility',
      data: 'What leaves the phone',
      numbers: 'Measured numbers',
      tryIt: 'Try it',
      team: 'Team',
    },
    story: [
      { text: 'Scan-as-you-shop exists. In June 2026, the Kerää ja skannaa service of S Group was in 67 stores.', source: SOURCES.sGroup },
      { text: 'That service still needs a hand for a scanner or a phone.' },
      { text: 'The camera of the glasses sees what your hand holds. Both hands stay free.' },
      { text: 'Ceiling cameras need an installation in each store. In 2024, Amazon removed Just Walk Out from its Amazon Fresh stores in the US.', source: SOURCES.amazon },
      { text: 'With Glance, the store adds no camera and no sensor. Its kiosk software shows one code and accepts the cart.' },
    ],
    videoCaption: 'One take of the full loop, from the first glance to the paid checkout.',
    videoMissing: 'The video is not online yet.',
    steps: [
      { title: 'Look', text: 'Hold a product up. The voice in the glasses says its name and its price. The cart does not change.' },
      { title: yes.stepTitle, text: `${yes.add} ${yes.skip} The voice names each product that it adds.` },
      { title: 'Pay', text: `Look at the code on the checkout screen. The voice names the store and the total. ${yes.pay} The payment is a demo. No money moves.` },
    ],
    rules: [
      'A glance never changes the cart.',
      'A yes answers only the prompt that you just heard.',
      'Silence never adds and never pays.',
    ],
    accessibility: [
      { text: yesInputs(probe) },
      { text: 'No action needs your head, your voice, or the touchpad alone. Each action has a button on the phone.' },
      { text: 'Each spoken line also shows as text on the phone. The phone vibrates for each key event.' },
      ...(probe.motion ? [{ text: 'You can turn head gestures off. You can swap the meaning of nod and shake.' }] : []),
      { text: 'You set the speech speed and the level of detail.' },
      { text: 'The voice says when it is not sure. It never guesses a price or an allergen.' },
      { text: 'At the checkout, you look at one code. You do not touch the screen.' },
      { text: 'In GS1 UK research, 83 percent of visually impaired consumers found the information on food packaging difficult or impossible to access.', source: SOURCES.gs1 },
      { text: 'The US Access Board states that self-service machines without tactile controls and without speech are unusable for many blind people.', source: SOURCES.accessBoard },
      // Article 2 lists payment terminals, not checkout kiosks in general. Keep this narrow text.
      { text: 'The European Accessibility Act covers payment terminals that enter the market after 28 June 2025.', source: SOURCES.eaaScope },
      { text: 'A member state can let self-service terminals in use before that date stay for up to 20 years.', source: SOURCES.eaaOld },
      { text: 'Blind and low-vision shoppers have not tested Glance yet. The next step is to ask the Finnish Federation of the Visually Impaired for a test.' },
    ],
    data: [
      { text: 'The phone picks at most two frames each second.' },
      { text: 'The phone pixelates faces and crops each frame before upload.' },
      { text: 'The server holds a frame in memory for one recognition call. It never stores a frame.' },
      { text: 'The Google Gemini API receives the frame for that call.' },
      { text: AUDIO[probe.speech] },
      { text: 'The server stores your cart, your preferences, and your order. It stores no name and no account.' },
      { text: 'The capture LED on the glasses stays on while the camera runs. The voice says "Camera on" and "Camera off".', source: SOURCES.led },
      { text: 'The camera runs for the whole session, not only for each glance. The Meta guidance for glasses apps says: "Deliberate, not ambient."', source: SOURCES.metaUse },
      { text: 'Glance does not meet that guidance yet. A product needs a wake signal on the glasses, and we ask Meta for that signal.' },
    ],
    privacyLink: 'Read the privacy page',
    numbersMissing: 'The team has not measured these numbers yet.',
    tradeoff: `A handheld scanner is faster for each item. Glance gives free hands and a checkout without touch. The demo catalog has ${CATALOG_SIZE} products.`,
    trySetup: {
      text: 'You need Ray-Ban Meta glasses, an Android phone with Android 10 or later, and the Meta AI app. Developer Mode lets an unpublished app connect to your glasses.',
      source: SOURCES.devMode,
    },
    trySteps,
    tryNotes: [
      { text: 'Developer Mode keeps one third-party app registered at a time.', source: SOURCES.oneApp },
      { text: 'An update of the Meta AI app or of the glasses can turn Developer Mode off.', source: SOURCES.devModeOff },
      { text: `The team tested Glance on Ray-Ban Meta Gen 2 glasses. The app works only with the demo server and its ${CATALOG_SIZE} products.` },
    ],
    apkLabel: 'Download the Android app (APK)',
    apkMissing: 'The APK is not online yet.',
    event: {
      text: 'The team built Glance at Junction 2026 in Espoo, from 13 to 15 November 2026. It answers the Meta challenge "AI Glasses for Everyone, Everyday".',
      source: SOURCES.junction,
    },
    builtWith: 'Gemini names the product. ElevenLabs speaks each line. MongoDB Atlas stores the cart and the order. The server runs on Vultr.',
    disclaimer: 'Meta Glance is a hackathon prototype. It is not a product of Meta.',
    repoLabel: 'Source code on GitHub',
  };
}

const claimText = (claim: Claim): string[] => (claim.source ? [claim.text, claim.source.name] : [claim.text]);

// Each string of the copy that a reader sees, for the copy guard.
export function landingText(copy: LandingCopy): string[] {
  return [
    copy.brand, copy.headline, copy.lead,
    ...Object.values(copy.headings),
    ...copy.story.flatMap(claimText),
    copy.videoCaption, copy.videoMissing,
    ...copy.steps.flatMap((step) => [step.title, step.text]),
    ...copy.rules,
    ...copy.accessibility.flatMap(claimText),
    ...copy.data.flatMap(claimText),
    copy.privacyLink, copy.numbersMissing, copy.tradeoff,
    ...claimText(copy.trySetup),
    ...copy.trySteps,
    ...copy.tryNotes.flatMap(claimText),
    copy.apkLabel, copy.apkMissing,
    ...claimText(copy.event),
    copy.builtWith, copy.disclaimer, copy.repoLabel,
  ];
}
