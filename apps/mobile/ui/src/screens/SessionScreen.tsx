import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useState } from 'react';
import { useUi } from '../bridge/BridgeContext';
import { CaptionList } from '../components/CaptionList';
import { CartList } from '../components/CartList';
import { CheckoutSheet } from '../components/CheckoutSheet';
import { PromptCard } from '../components/PromptCard';
import { SettingsSheet } from '../components/SettingsSheet';
import { StateBanner } from '../components/StateBanner';
import { StatusRow } from '../components/StatusRow';

export function SessionScreen() {
  const { state, strings } = useUi();
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  return (
    <VStack as="main" padding={4} gap={4}>
      <StateBanner />
      <Heading level={1}>{strings.appTitle}</Heading>
      <StatusRow />
      {state.prompt?.kind === 'product' ? <PromptCard prompt={state.prompt} /> : <Text>{strings.idleHint}</Text>}
      <CaptionList />
      <CartList />
      <HStack gap={2} wrap="wrap">
        <Button label={strings.settings} onClick={() => setSettingsOpen(true)} />
      </HStack>
      <CheckoutSheet />
      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
    </VStack>
  );
}
