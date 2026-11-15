import { KIOSK_SCREEN } from '../content/site';
import { assetUrl } from './Picture';

/**
 * The kiosk page in its "waiting for your nod" state, drawn with the tokens of the page, so it follows the color scheme.
 * The text and the amounts are those of the recorded demo run of apps/website on the app branch.
 * The code keeps dark modules on a white card with its quiet zone in both schemes, as a scanner needs.
 */
export function KioskScreen() {
  const { place, state, amount, lines } = KIOSK_SCREEN;
  return (
    <div className="kiosk">
      <div className="kiosk__screen">
        <img className="kiosk__code" src={assetUrl('kiosk-code.png')} width={1024} height={1024} alt="" loading="lazy" decoding="async" />
        <div className="kiosk__text">
          <p className="kiosk__place">{place}</p>
          <p className="kiosk__state">{state}</p>
          <p className="kiosk__amount">{amount}</p>
          <dl className="kiosk__lines">
            {lines.map((line) => (
              <div key={line.name}>
                <dt>{line.name}</dt>
                <dd>{line.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
