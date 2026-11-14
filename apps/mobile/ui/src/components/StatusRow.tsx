import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { useUi } from '../bridge/BridgeContext';

/** The state of the glasses, the camera, and the network. Each status is a word, so no status shows by color alone. */
export function StatusRow() {
  const { state, strings } = useUi();
  const { native } = state;
  const text = strings.status;
  const device = native?.device ?? null;
  const isConnected = device?.link === 'connected';
  const battery = device?.battery ?? null;
  const camera = native?.stream === 'streaming' ? text.cameraOn : native?.stream === 'paused' ? text.cameraPaused : text.cameraOff;
  return (
    <HStack gap={3} wrap="wrap">
      <Text type="supporting">{text.glasses(isConnected ? text.connected : text.notConnected)}</Text>
      <Text type="supporting">{text.battery(battery === null ? text.unknown : text.percent(battery))}</Text>
      <Text type="supporting">{text.camera(camera)}</Text>
      <Text type="supporting">{text.network(native?.network === 'online' ? text.online : text.offline)}</Text>
    </HStack>
  );
}
