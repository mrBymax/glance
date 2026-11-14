import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useUi } from './bridge/BridgeContext';
import { SessionScreen } from './screens/SessionScreen';
import { SetupScreen } from './screens/SetupScreen';
import { screenOf } from './state/selectors';

export function App() {
  const { state, strings } = useUi();
  const screen = screenOf(state);
  if (screen === 'setup') return <SetupScreen />;
  if (screen === 'session') return <SessionScreen />;
  return (
    <VStack as="main" padding={4} gap={4}>
      <Heading level={1}>{strings.appTitle}</Heading>
      <Text>{strings.loading}</Text>
    </VStack>
  );
}
