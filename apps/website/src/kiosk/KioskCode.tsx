import { kioskQr } from './qr';

/** The QR code of the kiosk. It is black on white in each color mode, because a camera must read it. */
export function KioskCode(props: { code: string }) {
  const { size, path } = kioskQr(props.code);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Checkout code ${props.code}`}
      shapeRendering="crispEdges"
      className="kiosk-code"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
