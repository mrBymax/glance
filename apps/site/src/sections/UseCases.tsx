import { Icon } from '@astryxdesign/core/Icon';
import { Theme } from '@astryxdesign/core/theme';
import { Bus, Captions, DoorOpen, Landmark, type LucideIcon, ParkingMeter, ShoppingBasket, UtensilsCrossed } from 'lucide-react';
import { defaultThemeSlug, themes } from '../astryx-themes';
import { assetUrl } from '../components/Picture';
import { USE_CASES, type UseCase } from '../content/site';
import { Reveal } from '../motion/Reveal';

const GLYPHS: Record<UseCase['icon'], LucideIcon> = {
  bus: Bus,
  checkout: ShoppingBasket,
  gate: DoorOpen,
  machine: ParkingMeter,
  table: UtensilsCrossed,
  exhibit: Landmark,
};

/** The bus card: a Glance code by the door and the line that the voice says, in the captions window of the app. */
function BusScene() {
  return (
    <div className="bus-scene" aria-hidden="true">
      <div className="bus-scene__plate">
        <img src={assetUrl('kiosk-code.png')} width={1024} height={1024} alt="" loading="lazy" decoding="async" />
      </div>
      <Theme theme={themes[defaultThemeSlug]} mode="dark">
        <div className="bus-scene__voice">
          <Icon icon={Captions} size="sm" />
          <span>{USE_CASES.busLine}</span>
        </div>
      </Theme>
    </div>
  );
}

function UseCaseCard(props: { item: UseCase; index: number }) {
  const { item, index } = props;
  const isFeature = item.id === 'bus';
  return (
    <Reveal as="li" className={isFeature ? 'use-case use-case--feature' : 'use-case'} index={index}>
      <div className="use-case__head">
        <span className="use-case__glyph" aria-hidden="true">
          <Icon icon={GLYPHS[item.icon]} size="lg" />
        </span>
        {item.isDemo ? <span className="use-case__tag">{USE_CASES.demoTag}</span> : null}
      </div>
      <h3 className="use-case__title">{item.title}</h3>
      <p className="use-case__body">{item.body}</p>
      {isFeature ? <BusScene /> : null}
    </Reveal>
  );
}

export function UseCases() {
  return (
    <section id="use-cases" className="section" aria-labelledby="use-cases-title">
      <div className="container">
        <Reveal className="section-head">
          <h2 id="use-cases-title" className="section-title">
            {USE_CASES.heading}
          </h2>
          <p className="lead">{USE_CASES.lead}</p>
        </Reveal>
        <ul className="use-cases">
          {USE_CASES.items.map((item, index) => (
            <UseCaseCard key={item.id} item={item} index={index} />
          ))}
        </ul>
      </div>
    </section>
  );
}
