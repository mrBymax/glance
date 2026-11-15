import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Text } from '@astryxdesign/core/Text';
import {
  Battery, BatteryFull, BatteryLow, BatteryMedium, Camera, CameraOff, Glasses, TriangleAlert, Wifi, WifiOff, type LucideIcon,
} from 'lucide-react';
import { useUi } from '../bridge/BridgeContext';

const LOW_BATTERY = 20;

type Fact = { key: string; text: string; icon: LucideIcon; isProblem: boolean };

function batteryIcon(percent: number | null): LucideIcon {
  if (percent === null) return Battery;
  if (percent < 50) return BatteryLow;
  return percent < 80 ? BatteryMedium : BatteryFull;
}

/**
 * The state of the glasses, the battery, the camera, and the network: one pill for each, with a glyph and words.
 * A problem also gets the warning fill and a warning glyph, so no status shows by color alone.
 */
export function StatusRow() {
  const { state, strings } = useUi();
  const { native } = state;
  const text = strings.status;
  const device = native?.device ?? null;
  const isConnected = device?.link === 'connected';
  const battery = device?.battery ?? null;
  const stream = native?.stream;
  const camera = stream === 'streaming' ? text.cameraOn : stream === 'paused' ? text.cameraPaused : text.cameraOff;
  const isOnline = native?.network === 'online';
  const facts: Fact[] = [
    { key: 'glasses', text: text.glasses(isConnected ? text.connected : text.notConnected), icon: Glasses, isProblem: !isConnected },
    {
      key: 'battery',
      text: text.battery(battery === null ? text.unknown : text.percent(battery)),
      icon: batteryIcon(battery),
      isProblem: battery !== null && battery <= LOW_BATTERY,
    },
    { key: 'camera', text: text.camera(camera), icon: stream === 'streaming' ? Camera : CameraOff, isProblem: stream === 'paused' },
    { key: 'network', text: text.network(isOnline ? text.online : text.offline), icon: isOnline ? Wifi : WifiOff, isProblem: !isOnline },
  ];
  return (
    <HStack as="ul" gap={2} wrap="wrap">
      {facts.map((fact) => (
        <HStack as="li" key={fact.key} className={fact.isProblem ? 'glance-pill glance-pill--problem' : 'glance-pill'} gap={1.5} vAlign="center">
          <Icon icon={fact.isProblem ? TriangleAlert : fact.icon} size="sm" />
          <Text type="supporting" weight="medium" color="inherit">{fact.text}</Text>
        </HStack>
      ))}
    </HStack>
  );
}
