import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useUi } from './bridge/BridgeContext';
import { BrowserBridge } from './bridge/browserBridge';
import { DebugPanel } from './debug/DebugPanel';
import { SessionScreen } from './screens/SessionScreen';
import { SetupScreen } from './screens/SetupScreen';
import { screenOf, type Screen } from './state/selectors';

function ScreenView(props: { screen: Screen }) {
  const { strings } = useUi();
  if (props.screen === 'setup') return <SetupScreen />;
  if (props.screen === 'session') return <SessionScreen />;
  return (
    <VStack as="main" padding={4} gap={4}>
      <Heading level={1}>{strings.appTitle}</Heading>
      <Text>{strings.loading}</Text>
    </VStack>
  );
}

/** Reads the flag `debug`, which shows the debug panel inside the WebView. */
function hasDebugFlag(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

export function App() {
  const { state, bridge } = useUi();
  const showsDebug = bridge instanceof BrowserBridge || hasDebugFlag(location.search);
  return (
    <>
      <ScreenView screen={screenOf(state)} />
      {showsDebug ? <DebugPanel /> : null}
    </>
  );
}
