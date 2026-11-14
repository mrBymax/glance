import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Spinner } from '@astryxdesign/core/Spinner';
import { VStack } from '@astryxdesign/core/VStack';
import { Glasses } from 'lucide-react';
import { useUi } from './bridge/BridgeContext';
import { BrowserBridge } from './bridge/browserBridge';
import { Mark } from './components/Mark';
import { DebugPanel } from './debug/DebugPanel';
import { SessionScreen } from './screens/SessionScreen';
import { SetupScreen } from './screens/SetupScreen';
import { screenOf, type Screen } from './state/selectors';

function ScreenView(props: { screen: Screen }) {
  const { strings } = useUi();
  if (props.screen === 'setup') return <SetupScreen />;
  if (props.screen === 'session') return <SessionScreen />;
  return (
    <VStack as="main" className="glance-page" paddingBlock={4} gap={6}>
      <HStack gap={3} vAlign="center">
        <Mark icon={Glasses} />
        <Heading level={1}>{strings.appTitle}</Heading>
      </HStack>
      <Spinner size="lg" label={strings.loading} />
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
  // The theme element of Astryx has no box, so this stack paints the canvas behind each screen.
  return (
    <VStack className="glance-app">
      <ScreenView screen={screenOf(state)} />
      {showsDebug ? <DebugPanel /> : null}
    </VStack>
  );
}
