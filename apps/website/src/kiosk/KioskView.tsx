import './kiosk.css';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import { Theme } from '@astryxdesign/core/theme';
import { VStack } from '@astryxdesign/core/VStack';
import type { CartItem, KioskEvent } from '@glance/shared';
import { defaultThemeSlug, themes } from '../astryx-themes';
import { eur } from '../lib/format';
import { KioskCode } from './KioskCode';
import { kioskRows } from './kioskModel';

/**
 * `registering` and `unreachable`: no kiosk exists yet. `open`: the stream is up.
 * `lost`: a kiosk exists, and the page has no connection to the server.
 */
export type KioskLink = 'registering' | 'unreachable' | 'open' | 'lost';

const HEADINGS: Record<KioskEvent['state'], string> = {
  idle: 'Look at this code to pay',
  connected: 'Waiting for your nod',
  // The event does not name the product of a spot check, so the kiosk shows the cart.
  spotcheck: 'Waiting for your nod',
  paid: 'Paid',
  failed: 'Payment failed. Nothing was charged.',
};

function Line(props: { children: string }) {
  return <Text as="p" className="kiosk-row">{props.children}</Text>;
}

function Rows(props: { items: CartItem[] }) {
  const { rows, hiddenCount } = kioskRows({ items: props.items });
  if (rows.length === 0) return null;
  return (
    <>
      <List density="compact" edge="flush">
        {rows.map((item) => (
          <ListItem
            key={item.productId}
            label={<Text className="kiosk-row">{item.name}</Text>}
            endContent={<Text className="kiosk-row" textWrap="nowrap">{`${item.qty} x ${eur(item.unitPriceCents)}`}</Text>}
          />
        ))}
      </List>
      {hiddenCount > 0 ? <Line>{hiddenCount === 1 ? 'and 1 more item' : `and ${hiddenCount} more items`}</Line> : null}
    </>
  );
}

// The total is the total of the server. The page never adds prices.
function Total(props: { cents: number | null }) {
  return props.cents === null ? null : <Text as="p" className="kiosk-total">{eur(props.cents)}</Text>;
}

function StateContent(props: { event: KioskEvent }) {
  const { event } = props;
  switch (event.state) {
    case 'idle':
      return <Line>No glasses? Use a staffed checkout.</Line>;
    case 'connected':
    case 'spotcheck':
      return (
        <>
          <Total cents={event.totalCents} />
          <Rows items={event.cart?.items ?? []} />
        </>
      );
    case 'paid':
      return (
        <>
          <Total cents={event.totalCents ?? event.receipt?.totalCents ?? null} />
          <Rows items={event.receipt?.items ?? []} />
          <Line>Demo payment. No money moved.</Line>
        </>
      );
    case 'failed':
      return <Line>Look at the code to try again.</Line>;
  }
}

function Panel(props: { event: KioskEvent | null; link: KioskLink }) {
  const { event, link } = props;
  if (!event) {
    return link === 'unreachable' ? (
      <>
        <Heading level={1}>The store server does not answer</Heading>
        <Line>The page tries again every 3 seconds.</Line>
      </>
    ) : <Heading level={1}>Connecting to the store</Heading>;
  }
  return (
    <>
      <Line>{`${event.kiosk.name}, ${event.kiosk.store}`}</Line>
      <Heading level={1}>{HEADINGS[event.state]}</Heading>
      <StateContent event={event} />
      {link === 'lost' ? <Line>Connection lost. Reconnecting.</Line> : null}
    </>
  );
}

/** One layout for each kiosk state. The code is the first child, and it keeps its place and its size. */
export function KioskView(props: { event: KioskEvent | null; link: KioskLink }) {
  const { event, link } = props;
  return (
    <Theme theme={themes[defaultThemeSlug]} mode="light">
      <HStack as="main" className="kiosk" padding={6} gap={8} vAlign="center">
        {event ? <KioskCode code={event.code} /> : null}
        <VStack className="kiosk-panel" gap={3}>
          <Panel event={event} link={link} />
        </VStack>
      </HStack>
    </Theme>
  );
}
