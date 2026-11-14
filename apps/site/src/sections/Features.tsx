import { Icon } from '@astryxdesign/core/Icon';
import { Theme } from '@astryxdesign/core/theme';
import { defaultThemeSlug, themes } from '../astryx-themes';
import { Captions, Hand, ShieldCheck, Languages, type LucideIcon } from 'lucide-react';
import { Picture } from '../components/Picture';
import { CHAPTERS, CONTROL, FEATURES_INTRO, VOICE_LINES, type Chapter } from '../content/site';
import { TEAM } from '../content/team';

const PHONE = { widths: [390, 780], width: 780, height: 1688, sizes: '(min-width: 64rem) 18rem, (min-width: 37.5rem) 16rem, 70vw' } as const;

function PhoneShot(props: { name: string; alt: string }) {
  return (
    <div className="phone">
      <Picture
        className="phone__screen"
        name={`phone-${props.name}-light`}
        darkName={`phone-${props.name}-dark`}
        widths={PHONE.widths}
        sizes={PHONE.sizes}
        width={PHONE.width}
        height={PHONE.height}
        alt={props.alt}
      />
    </div>
  );
}

function VoiceLines() {
  return (
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
    <div className="voice">
      <p className="voice__title">
        <Icon icon={Captions} size="sm" />
        <span>{VOICE_LINES.title}</span>
      </p>
      <p className="voice__line voice__line--older">{VOICE_LINES.older}</p>
      <p className="voice__line">{VOICE_LINES.newest}</p>
    </div>
    </Theme>
  );
}

function PrivacyPair() {
  const person = TEAM.find((member) => member.id === 'fb');
  if (!person) throw new Error('src/content/team.ts has no member with the photo fb');
  const sizes = '(min-width: 64rem) 16rem, 40vw';
  return (
    <div className="privacy-pair">
      <figure className="privacy-pair__item">
        <Picture className="privacy-pair__image" name="team-fb" widths={[320, 480, 640]} sizes={sizes} width={640} height={800} alt={`A photo of ${person.name}, as a camera sees it.`} />
        <figcaption>In the camera</figcaption>
      </figure>
      <figure className="privacy-pair__item">
        <Picture className="privacy-pair__image" name="privacy-face" widths={[320, 480, 640]} sizes={sizes} width={640} height={800} alt="The same photo with the face pixelated in large blocks." />
        <figcaption>What leaves the phone</figcaption>
      </figure>
    </div>
  );
}

function ChapterMedia(props: { media: Chapter['media'] }) {
  switch (props.media) {
    case 'voice':
      return <VoiceLines />;
    case 'prompt':
      return <PhoneShot name="prompt" alt="The phone app shows Oat drink, 1 litre, 1.89 euros, a yellow warning that it contains gluten, and the buttons Add and Skip." />;
    case 'phones':
      return (
        <div className="phone-pair">
          <PhoneShot name="checkout" alt="The checkout sheet: Checkout 3 at Demo Market, 2 items, 4.49 euros, and the buttons Pay and Cancel." />
          <PhoneShot name="paid" alt="The receipt: a green check, Paid, 4.49 euros, the two items, and the note Demo payment, no money moved." />
        </div>
      );
    case 'privacy':
      return <PrivacyPair />;
    case 'kiosk':
      return (
        <Picture
          className="kiosk-shot"
          name="kiosk-waiting"
          widths={[800, 1600]}
          sizes="(min-width: 75rem) 44rem, 90vw"
          width={1600}
          height={1000}
          alt="The kiosk page: a large code, Checkout 3, Demo Market, Waiting for your nod, 4.49 euros, and the two items of the cart."
        />
      );
  }
}

function ChapterBlock(props: { chapter: Chapter; index: number }) {
  const { chapter, index } = props;
  const titleId = `${chapter.id}-title`;
  return (
    <article id={chapter.id} className={index % 2 === 1 ? 'chapter chapter--reverse' : 'chapter'} aria-labelledby={titleId}>
      <div className="chapter__copy">
        <p className="eyebrow">{chapter.eyebrow}</p>
        <h3 id={titleId} className="chapter__title">
          {chapter.heading}
        </h3>
        <p className="chapter__body">{chapter.body}</p>
        <ul className="points">
          {chapter.points.map((point) => (
            <li key={point.title}>
              <span className="points__title">{point.title}</span>
              <span className="points__body">{point.body}</span>
            </li>
          ))}
        </ul>
      </div>
      <figure className={`stage stage--${chapter.media}`}>
        <div className="stage__media">
          <ChapterMedia media={chapter.media} />
        </div>
        <figcaption className="stage__caption">{chapter.mediaCaption}</figcaption>
      </figure>
    </article>
  );
}

const CONTROL_GLYPHS: readonly LucideIcon[] = [Hand, ShieldCheck, Languages];

export function Features() {
  return (
    <section id="features" className="section" aria-labelledby="features-title">
      <div className="container">
        <div className="section-head section-head--center">
          <h2 id="features-title" className="section-title">
            {FEATURES_INTRO.heading}
          </h2>
          <p className="lead">{FEATURES_INTRO.body}</p>
        </div>
        <div className="chapters">
          {CHAPTERS.map((chapter, index) => (
            <ChapterBlock key={chapter.id} chapter={chapter} index={index} />
          ))}
        </div>
        <section className="control" aria-labelledby="control-title">
          <h3 id="control-title" className="control__title">
            {CONTROL.heading}
          </h3>
          <ul className="control__list">
            {CONTROL.items.map((item, index) => (
              <li key={item.title} className="control__item">
                <span className="control__glyph" aria-hidden="true">
                  <Icon icon={CONTROL_GLYPHS[index] ?? Hand} size="lg" />
                </span>
                <span className="control__item-title">{item.title}</span>
                <span className="control__item-body">{item.body}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
