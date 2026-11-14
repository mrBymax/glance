import { BottomSheet } from '@astryxdesign/core/BottomSheet';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import type { NativeToPage } from '@glance/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useUi } from '../bridge/BridgeContext';
import { BrowserBridge } from '../bridge/browserBridge';
import { NATIVE_PRESETS, type NativePresetKey } from '../bridge/fakeNative';
import { DEMO_RUN, playRecording } from './demoRun';
import { EVENT_TYPES, eventMessage } from './fixtures';

const SENT_LINES = 10;
const NATIVE_KEYS = Object.keys(NATIVE_PRESETS) as NativePresetKey[];

function Part(props: { title: string; children: ReactNode }) {
  return (
    <VStack as="section" gap={2}>
      <Heading level={3}>{props.title}</Heading>
      {props.children}
    </VStack>
  );
}

/** A development tool that sends events and native states into the page. Its text is English only. */
export function DebugPanel() {
  const { bridge, dispatch } = useUi();
  const [isOpen, setOpen] = useState(false);
  const stopRun = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRun.current?.(), []);

  const browser = bridge instanceof BrowserBridge ? bridge : null;
  // A message through the browser bridge takes the path of a message of the app, so it also gives its haptic message.
  const deliver = (message: NativeToPage) => {
    if (browser) browser.inject(message);
    else dispatch(message);
  };
  const playRun = () => {
    stopRun.current?.();
    stopRun.current = playRecording(DEMO_RUN, deliver);
  };
  const reset = () => {
    stopRun.current?.();
    dispatch({ t: 'local.reset' });
  };
  const query = browser?.sessionQuery() ?? null;

  return (
    <>
      <Button label="Debug" onClick={() => setOpen(true)} />
      <BottomSheet isOpen={isOpen} onOpenChange={setOpen} label="Debug" height="tall">
        <VStack gap={5}>
          <Heading level={2}>Debug</Heading>
          <Part title="Events">
            <HStack gap={2} wrap="wrap">
              {EVENT_TYPES.map((type) => <Button key={type} label={type} onClick={() => deliver(eventMessage(type))} />)}
            </HStack>
          </Part>
          <Part title="Native state">
            <HStack gap={2} wrap="wrap">
              {NATIVE_KEYS.map((key) => (
                <Button key={key} label={key} onClick={() => deliver({ t: 'native.state', state: NATIVE_PRESETS[key] })} />
              ))}
            </HStack>
          </Part>
          <Part title="Run">
            <HStack gap={2} wrap="wrap">
              <Button label="Play the demo run" onClick={playRun} />
              <Button label="Reset" onClick={reset} />
            </HStack>
          </Part>
          {browser ? (
            <Part title="Sent">
              {browser.sent.slice(-SENT_LINES).map((message, index) => (
                // The list only grows at its end, and two messages can be equal, so the place in the list is the key.
                <Text key={index} type="code">{JSON.stringify(message)}</Text>
              ))}
              {query ? <Text type="code">{`Session query: ${query}`}</Text> : null}
            </Part>
          ) : null}
        </VStack>
      </BottomSheet>
    </>
  );
}
