import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { useUi } from '../bridge/BridgeContext';
import { bannerOf, type BannerAction } from '../state/banner';

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
  return (
    <Banner
      status={banner.status}
      title={banner.title}
      description={banner.description ?? undefined}
      endContent={action ? <Button label={action.label} onClick={() => run(action)} /> : undefined}
    />
  );
}
