import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { Glasses, Mic, Power, ScanLine, Settings, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { ASK_MESSAGE } from '../bridge/askMessage';
import { useUi } from '../bridge/BridgeContext';
import { CaptionList } from '../components/CaptionList';
import { CartList } from '../components/CartList';
import { CheckoutSheet } from '../components/CheckoutSheet';
import { LookAlikeNotice } from '../components/LookAlikeNotice';
import { Mark } from '../components/Mark';
import { PromptCard } from '../components/PromptCard';
import { SettingsSheet } from '../components/SettingsSheet';
import { StateBanner } from '../components/StateBanner';
import { StatusRow } from '../components/StatusRow';

/**
 * The screen of a shop. From the top: the state banner, the title and the status, the current prompt, the captions,
 * the cart, then the actions. Ask and Undo stick to the bottom of the screen while the page scrolls.
 */
export function SessionScreen() {
  const { state, strings, send } = useUi();
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isEndOpen, setEndOpen] = useState(false);
  const endShop = () => {
    send({ t: 'session.end' });
    setEndOpen(false);
  };
  // The server takes a question only while the shop is open.
  const canAsk = state.phase === 'shopping' || state.phase === 'checkout';
  const canUndo = state.cart.items.length > 0;
  const promptArea = () => {
    if (state.prompt?.kind === 'product') return <PromptCard prompt={state.prompt} />;
    if (state.lookAlikes) return <LookAlikeNotice candidates={state.lookAlikes} />;
    // During a spot check the banner above says what to do.
    if (state.spotCheck) return null;
    return (
      <Card className="glance-card glance-idle">
        <HStack gap={4} vAlign="center">
          <Mark icon={ScanLine} tone="muted" />
          <Text type="large" weight="medium">{strings.idleHint}</Text>
        </HStack>
      </Card>
    );
  };
  return (
    <VStack as="main" className="glance-page" paddingBlock={4} gap={6}>
      <StateBanner />
      <VStack gap={3}>
        <HStack hAlign="between" vAlign="center" gap={3}>
          <HStack gap={3} vAlign="center">
            <Mark icon={Glasses} />
            <Heading level={1}>{strings.appTitle}</Heading>
          </HStack>
          <IconButton label={strings.settings} icon={<Icon icon={Settings} />} size="lg" variant="ghost" onClick={() => setSettingsOpen(true)} />
        </HStack>
        <StatusRow />
      </VStack>
      {state.spotCheck ? <Banner status="info" title={strings.spotCheckTitle} description={strings.spotCheckText(state.spotCheck.name)} /> : null}
      {promptArea()}
      <CaptionList />
      <CartList />
      <Button label={strings.end} icon={<Icon icon={Power} />} size="lg" width="100%" onClick={() => setEndOpen(true)} />
      {canAsk || canUndo ? (
        <HStack className="glance-dock glance-pair" gap={2} wrap="wrap">
          {canAsk ? <Button label={strings.ask} icon={<Icon icon={Mic} />} size="lg" onClick={() => send(ASK_MESSAGE)}>{strings.askShort}</Button> : null}
          {canUndo ? <Button label={strings.undo} icon={<Icon icon={Undo2} />} size="lg" onClick={() => send({ t: 'intent', kind: 'undo' })} /> : null}
        </HStack>
      ) : null}
      <CheckoutSheet />
      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
      <AlertDialog
        isOpen={isEndOpen}
        onOpenChange={setEndOpen}
        title={strings.endTitle}
        description={strings.endText}
        actionLabel={strings.endConfirm}
        cancelLabel={strings.endCancel}
        onAction={endShop}
      />
    </VStack>
  );
}
