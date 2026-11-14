import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useState } from 'react';
import { ASK_MESSAGE } from '../bridge/askMessage';
import { useUi } from '../bridge/BridgeContext';
import { CaptionList } from '../components/CaptionList';
import { CartList } from '../components/CartList';
import { CheckoutSheet } from '../components/CheckoutSheet';
import { LookAlikeNotice } from '../components/LookAlikeNotice';
import { PocketMode } from '../components/PocketMode';
import { PromptCard } from '../components/PromptCard';
import { SettingsSheet } from '../components/SettingsSheet';
import { StateBanner } from '../components/StateBanner';
import { StatusRow } from '../components/StatusRow';

export function SessionScreen() {
  const { state, strings, send } = useUi();
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isEndOpen, setEndOpen] = useState(false);
  const [isPocket, setPocket] = useState(false);
  const enterPocket = () => {
    send({ t: 'pocket.set', on: true });
    setPocket(true);
  };
  const endShop = () => {
    send({ t: 'session.end' });
    setEndOpen(false);
  };
  // The server takes a question only while the shop is open.
  const canAsk = state.phase === 'shopping' || state.phase === 'checkout';
  if (isPocket) return <PocketMode onLeave={() => setPocket(false)} />;
  const promptArea = () => {
    if (state.prompt?.kind === 'product') return <PromptCard prompt={state.prompt} />;
    if (state.lookAlikes) return <LookAlikeNotice candidates={state.lookAlikes} />;
    // During a spot check the banner above says what to do.
    return state.spotCheck ? null : <Text>{strings.idleHint}</Text>;
  };
  return (
    <VStack as="main" padding={4} gap={4}>
      <StateBanner />
      <Heading level={1}>{strings.appTitle}</Heading>
      <StatusRow />
      {state.spotCheck ? <Banner status="info" title={strings.spotCheckTitle} description={strings.spotCheckText(state.spotCheck.name)} /> : null}
      {promptArea()}
      <CaptionList />
      <CartList />
      <HStack gap={2} wrap="wrap">
        {canAsk ? <Button label={strings.ask} icon={<Icon icon="microphone" />} onClick={() => send(ASK_MESSAGE)}>{strings.askShort}</Button> : null}
        {state.cart.items.length > 0 ? <Button label={strings.undo} onClick={() => send({ t: 'intent', kind: 'undo' })} /> : null}
        <Button label={strings.pocketMode} onClick={enterPocket} />
        <Button label={strings.settings} onClick={() => setSettingsOpen(true)} />
        <Button label={strings.end} onClick={() => setEndOpen(true)} />
      </HStack>
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
