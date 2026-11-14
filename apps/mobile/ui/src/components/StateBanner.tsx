import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { BatteryLow, CameraOff, CircleX, Glasses, Pause, RefreshCw, ThermometerSun, WifiOff, type LucideIcon } from 'lucide-react';
import { useUi } from '../bridge/BridgeContext';
import { bannerOf, type BannerAction, type BannerId } from '../state/banner';

/** The glyph of each banner. A banner with no entry shows the glyph of its status. */
const GLYPHS: Partial<Record<BannerId, LucideIcon>> = {
  paymentFailed: CircleX,
  serverUnreachable: WifiOff,
  regularCheckout: ThermometerSun,
  glassesNotFound: Glasses,
  updateRequired: RefreshCw,
  ended: CameraOff,
  resting: CameraOff,
  stopped: CameraOff,
  paused: Pause,
  offFace: Glasses,
  batteryLow: BatteryLow,
};

/** The one banner for the device and error states. It shows nothing when all is well. */
export function StateBanner() {
  const { state, strings, send, dispatch } = useUi();
  const banner = bannerOf(state, strings);
  if (!banner) return null;
  const run = (action: BannerAction) => {
    if ('send' in action) send(action.send);
    else dispatch(action.dispatch);
  };
  const { action } = banner;
  const glyph = GLYPHS[banner.id];
  return (
    <Banner
      status={banner.status}
      icon={glyph ? <Icon icon={glyph} /> : undefined}
      title={banner.title}
      description={banner.description ?? undefined}
      endContent={action ? <Button label={action.label} onClick={() => run(action)} /> : undefined}
    />
  );
}
