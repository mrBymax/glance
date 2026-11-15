import { Heading } from '@astryxdesign/core/Heading';
import { Spinner } from '@astryxdesign/core/Spinner';
import { VStack } from '@astryxdesign/core/VStack';
import { useUi } from './bridge/BridgeContext';
import { BrowserBridge } from './bridge/browserBridge';
import { Logo } from './components/Logo';
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
      <Heading level={1} className="glance-hero">
        <Logo size="hero" alt={strings.logoName} hasEntrance />
      </Heading>
      <Spinner size="lg" label={strings.loading} className="glance-start" />
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
