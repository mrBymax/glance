import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Text } from '@astryxdesign/core/Text';
import { Theme } from '@astryxdesign/core/theme';
import { VStack } from '@astryxdesign/core/VStack';
import { LockOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { defaultThemeSlug, themes } from '../astryx-themes';
import { useUi } from '../bridge/BridgeContext';
import { eur, itemCount } from '../text/format';

/**
 * A black screen with the total, for a phone in a pocket.
 * Unlock and then Leave are two taps in two places, so a touch through cloth does not leave the mode.
 */
export function PocketMode(props: { onLeave(): void }) {
  const { state, strings, send } = useUi();
  const [isLeaveOpen, setLeaveOpen] = useState(false);
  // The page can also leave this screen with no tap, for example when the shop ends. The app must hear of each exit.
  useEffect(() => () => send({ t: 'pocket.set', on: false }), [send]);
  const leave = () => {
    setLeaveOpen(false);
    props.onLeave();
  };
  return (
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
      <VStack as="main" className="pocket-screen" padding={6} gap={8} hAlign="stretch" vAlign="between">
        <Heading level={1} color="secondary">{strings.pocketMode}</Heading>
        <VStack gap={2}>
          <Text className="glance-amount" display="block">{eur(state.cart.totalCents)}</Text>
          <Text type="large" color="secondary">{strings.items(itemCount(state.cart))}</Text>
        </VStack>
        <Button label={strings.unlock} icon={<Icon icon={LockOpen} />} size="lg" width="100%" onClick={() => setLeaveOpen(true)} />
      </VStack>
      <AlertDialog
        isOpen={isLeaveOpen}
        onOpenChange={setLeaveOpen}
        title={strings.leavePocketTitle}
        description={strings.leavePocketText}
        actionLabel={strings.leave}
        cancelLabel={strings.stay}
        actionVariant="primary"
        onAction={leave}
      />
    </Theme>
  );
}
