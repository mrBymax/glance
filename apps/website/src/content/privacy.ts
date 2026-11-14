import type { Links } from './landing';
import type { Probe } from './probe';

export type PrivacyFacts = { geminiNoTrainingConfirmed: boolean; contactEmail: string | null; deleteBy: string };
// The team sets `geminiNoTrainingConfirmed` only after it reads the terms of its own Gemini tier.
export const PRIVACY_FACTS: PrivacyFacts = { geminiNoTrainingConfirmed: false, contactEmail: null, deleteBy: '30 November 2026' };

export type PrivacySection = { heading: string; lines: string[]; list?: string[]; after?: string[]; link?: { label: string; href: string } };
export type PrivacyCopy = { title: string; intro: string; sections: PrivacySection[]; footer: string };

const AUDIO: Record<Probe['speech'], string> = {
  glasses: 'No raw audio leaves the glasses. The glasses turn your speech into text, and the app gets the text.',
  phone: 'A microphone button on the phone starts the speech service of Android. That service turns your speech into text and can send audio to its provider.',
  none: 'Glance does not use a microphone.',
};

// The topics follow spec section 13. The Meta developer terms 5.5 and 6.1 require the deletion text.
export function privacyCopy(probe: Probe, facts: PrivacyFacts, links: Links): PrivacyCopy {
  const { contactEmail, deleteBy } = facts;
  return {
    title: 'Privacy',
    intro: 'Meta Glance is a hackathon prototype. This page says what data it uses, where the data goes, and how you delete it.',
    sections: [
      {
        heading: 'What you agree to',
        lines: ['Glance asks before each step.'],
        list: [
          'You link your glasses in the Meta AI app.',
          'You allow the camera in the Meta AI app.',
          'You start each session. The voice says "Camera on".',
          'You confirm each product before it enters the cart.',
          'You confirm each payment.',
        ],
      },
      {
        heading: 'Camera frames',
        lines: [
          'The camera runs from the start of a session to its end.',
          'The phone picks at most two frames each second.',
          'The phone pixelates faces and crops each frame. If that step fails, the phone drops the frame.',
          'The phone sends each frame to the Glance server over TLS.',
          'The server holds a frame in memory for one recognition call. It never writes a frame to a disk, a database, or a log.',
          'The server sends the frame to the paid tier of the Google Gemini API for that call.',
          ...(facts.geminiNoTrainingConfirmed ? ['Google states that it does not use paid tier data to train its models.'] : []),
          'Face detection is best effort at this image size. A frame can still show a person in the background.',
        ],
      },
      {
        heading: 'Audio',
        lines: [
          AUDIO[probe.speech],
          'The voice of Glance plays speech clips. ElevenLabs makes each clip from the text of the line.',
        ],
      },
      {
        heading: 'What the server stores',
        lines: [
          'Your session: the cart and your preferences.',
          'Your order, after a demo payment.',
          'Speech clips with product names and prices. They hold no voice of yours.',
          'The server stores no name, no account, and no camera frame.',
          `The team deletes all sessions and orders by ${deleteBy}.`,
        ],
      },
      {
        heading: 'Who gets data',
        lines: [
          'Google gets one camera frame for each recognition call.',
          'ElevenLabs gets the text of each spoken line.',
          'MongoDB Atlas holds the sessions and the orders.',
          'Vultr runs the server in Stockholm.',
          'Glance sells no data.',
        ],
      },
      {
        heading: 'People near you',
        lines: [
          'The capture LED on the glasses stays on while the camera runs. Glance cannot turn it off.',
          'The voice says "Camera on" and "Camera off".',
          'Glance does not identify people. It looks for one product in your hand.',
          'If a person objects, end the session.',
          'In a store pilot, the store shows a notice at the entrance.',
        ],
      },
      {
        heading: 'Camera time',
        lines: [
          'You start and stop each session.',
          'The camera also stops after 3 minutes with no product and no checkout code in view.',
          'The camera stops after each payment.',
        ],
      },
      {
        heading: 'Payment',
        lines: [
          'The payment is a demo. No money moves, and Glance asks for no card.',
          'Your yes is consent. It is not proof of who you are.',
        ],
      },
      {
        heading: 'Known gap',
        lines: [
          'Each purchase is deliberate, but the camera runs for the whole session.',
          'The Meta guidance for glasses apps says: "Deliberate, not ambient."',
          'Glance does not meet that guidance yet. A product needs a wake signal on the glasses, so that the camera runs only for a glance.',
        ],
      },
      {
        heading: 'Delete your data',
        lines: ['During a session, you can delete your data in the app.'],
        // The quoted words are the labels of the Settings sheet in the phone UI.
        list: ['Open Glance on your phone.', 'Tap "Settings".', 'Tap "Delete my data".', 'Tap "Delete" to confirm.'],
        after: [
          'Glance then deletes your session, your cart, and your order from the server.',
          contactEmail === null
            ? 'After a session, open an issue on GitHub with the order number from your receipt.'
            : `After a session, send the order number from your receipt to ${contactEmail}.`,
          `In each case, the team deletes all sessions and orders by ${deleteBy}.`,
        ],
        link: contactEmail === null
          ? { label: 'Open an issue on GitHub', href: `${links.repoUrl}/issues` }
          : { label: `Write to ${contactEmail}`, href: `mailto:${contactEmail}` },
      },
      {
        heading: 'This website',
        lines: [
          'This website sets no cookie and runs no analytics.',
          'The demo video plays from YouTube. YouTube can set cookies when you start the video.',
        ],
      },
    ],
    footer: 'Meta Glance is a hackathon prototype by a team at Junction 2026. It is not a product of Meta.',
  };
}

// Each string of the copy that a reader sees, for the copy guard.
export function privacyText(copy: PrivacyCopy): string[] {
  return [
    copy.title, copy.intro,
    ...copy.sections.flatMap((section) => [
      section.heading, ...section.lines, ...(section.list ?? []), ...(section.after ?? []),
      ...(section.link ? [section.link.label] : []),
    ]),
    copy.footer,
  ];
}
