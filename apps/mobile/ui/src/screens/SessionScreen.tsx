import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useUi } from '../bridge/BridgeContext';
import { CaptionList } from '../components/CaptionList';
import { CartList } from '../components/CartList';
import { CheckoutSheet } from '../components/CheckoutSheet';
import { PromptCard } from '../components/PromptCard';

export function SessionScreen() {
  const { state, strings } = useUi();
  return (
    <VStack as="main" padding={4} gap={4}>
      <Heading level={1}>{strings.appTitle}</Heading>
      {state.prompt?.kind === 'product' ? <PromptCard prompt={state.prompt} /> : <Text>{strings.idleHint}</Text>}
      <CaptionList />
      <CartList />
      <CheckoutSheet />
    </VStack>
  );
}
