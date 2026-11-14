// Integration test 2: the Glance server, the phone UI with BrowserBridge, the kiosk page, and the mirror page.
// Starts the server in fake mode and the two Vite dev servers, plays one shop in the installed Chrome, and stops all of it.
// Use: node scripts/integration/server-web.mjs
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, POLL_MS, startBrowser, startDevServer, waitForText } from './lib/pages.mjs';
import { startFakeServer } from './lib/server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const KIOSK_NAME = 'Checkout 7';
const STORE = 'Demo Market';
// The kiosk that the fake server has from its start. The kiosk page must get another code.
const SERVER_KIOSK_CODE = 'K3X7';
// The oat drink of apps/server/catalog/catalog.dev.json.
const PRODUCT = { name: 'Oat drink', pack: '1 L', priceCents: 189, price: '1.89 EUR' };
const LOG_TAIL_LINES = 40;
const PAID_LINE = 'Paid.';
const DEMO_PAYMENT_LINE = 'Demo payment. No money moved.';
// The checkout sheet of the phone UI, for the pay prompt and for the receipt. The Astryx BottomSheet is a dialog element.
const SHEET = 'dialog[open]';
// The two columns of the mirror page: the spoken lines and the cart.
const MIRROR_VOICE = '.mirror-voice';
const MIRROR_CART = '.mirror-cart';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

const button = (name) => `::-p-aria([name="${name}"][role="button"])`;

/** Waits until the bridge of the phone UI delivered a server event of this type, and returns the event. */
async function waitForEvent(phone, type) {
  try {
    const found = await phone.waitForFunction(
      (wanted) => window.glanceMessages.find((message) => message.t === 'event' && message.event.type === wanted)?.event,
      { polling: POLL_MS },
      type,
    );
    return await found.jsonValue();
  } catch (error) {
    const seen = await phone.evaluate(() => window.glanceMessages.map((message) => (message.t === 'event' ? message.event.type : message.t)));
    throw new Error(`phone UI: the bridge delivered no "${type}" event. It delivered: ${seen.join(', ')}`, { cause: error });
  }
}

async function playShop(server, phoneUrl, websiteUrl, browser, problems) {
  const kiosk = await openPage(
    browser, 'kiosk', `${websiteUrl}/kiosk?name=${encodeURIComponent(KIOSK_NAME)}`, { width: 1920, height: 1080 }, problems,
  );
  await waitForText(kiosk, 'kiosk', 'h1', 'Look at this code to pay');
  await waitForText(kiosk, 'kiosk', '.kiosk-row', `${KIOSK_NAME}, ${STORE}`);
  const codeLabel = await kiosk.$eval('.kiosk-code', (element) => element.getAttribute('aria-label'));
  const code = /^Checkout code ([A-Z2-9]{4})$/.exec(codeLabel ?? '')?.[1];
  check(code, `kiosk: the code has the label "${codeLabel}".`);
  check(code !== SERVER_KIOSK_CODE, 'kiosk: the page shows the code of the kiosk that the server made at its start.');
  console.log(`kiosk: registered, code ${code}`);

  // The mirror follows the newest live session, as it does in the demo. It starts before the phone has a session.
  const mirror = await openPage(
    browser, 'mirror', `${websiteUrl}/mirror?latest=${encodeURIComponent(server.demoKey)}`, { width: 1920, height: 1080 }, problems,
  );
  await mirror.locator(button('Start mirror')).click();
  await waitForText(mirror, 'mirror', MIRROR_VOICE, 'Waiting for a session on the phone.');
  console.log('mirror: started, waits for a session');

  const phone = await openPage(
    browser, 'phone UI', `${phoneUrl}/?ready=1&api=${encodeURIComponent(server.url)}`, { width: 412, height: 915 }, problems,
  );
  await waitForText(phone, 'phone UI', 'h1', 'Set up Glance');
  // The dev build keeps the bridge of the page in window.glanceBridge. The test reads the events that the bridge delivers.
  await phone.evaluate(() => {
    window.glanceMessages = [];
    window.glanceBridge.subscribe((message) => window.glanceMessages.push(message));
  });
  await phone.locator(button('Start shopping')).click();
  const sessionQuery = await (await phone.waitForFunction(() => window.glanceBridge.sessionQuery(), { polling: POLL_MS })).jsonValue();
  const session = new URLSearchParams(sessionQuery);
  await waitForText(phone, 'phone UI', 'main', 'Your cart is empty.');
  console.log('phone UI: setup screen answered with Start shopping, the session started');

  await waitForText(phone, 'phone UI', 'h2', PRODUCT.name);
  await waitForText(phone, 'phone UI', 'main', PRODUCT.price);
  await waitForText(phone, 'phone UI', 'li', 'Camera on.');
  await waitForText(mirror, 'mirror', `${MIRROR_VOICE} li`, 'Camera on.');
  await waitForText(mirror, 'mirror', MIRROR_CART, 'The cart is empty.');
  console.log('mirror: follows the session of the phone');

  await phone.locator(button('Add')).click();
  await waitForText(phone, 'phone UI', 'section', `${PRODUCT.pack}, 1 x ${PRODUCT.price}`);
  await waitForText(phone, 'phone UI', 'li', 'Added');
  const cartEvent = await waitForEvent(phone, 'cart.updated');
  check(cartEvent.cart.totalCents === PRODUCT.priceCents, `phone UI: the cart total is ${cartEvent.cart.totalCents} cents.`);
  console.log('phone UI: product card answered with Add, the cart shows the product');
  await waitForText(mirror, 'mirror', `${MIRROR_VOICE} li`, 'Added');
  await waitForText(mirror, 'mirror', `${MIRROR_CART} li`, PRODUCT.name);
  await waitForText(mirror, 'mirror', `${MIRROR_CART} li`, `${PRODUCT.pack}, 1 x ${PRODUCT.price}`);
  await waitForText(mirror, 'mirror', MIRROR_CART, PRODUCT.price);
  console.log('mirror: shows the line of the add and the cart');

  // The script of the server shows the session the newest kiosk, which is the kiosk of the page.
  const offered = await waitForEvent(phone, 'checkout.offered');
  check(offered.kiosk.name === KIOSK_NAME, `phone UI: the checkout is at "${offered.kiosk.name}", not at "${KIOSK_NAME}".`);
  check(offered.totalCents === PRODUCT.priceCents, `phone UI: the pay prompt has the total ${offered.totalCents} cents.`);
  await waitForText(phone, 'phone UI', 'li', `${KIOSK_NAME} at ${STORE}.`);
  await waitForText(phone, 'phone UI', `${SHEET} h2`, `${KIOSK_NAME} at ${STORE}`);
  await waitForText(phone, 'phone UI', SHEET, '1 item');
  await waitForText(phone, 'phone UI', SHEET, PRODUCT.price);
  await waitForText(mirror, 'mirror', `${MIRROR_VOICE} li`, `${KIOSK_NAME} at ${STORE}.`);
  await waitForText(kiosk, 'kiosk', 'h1', 'Waiting for your nod');
  await waitForText(kiosk, 'kiosk', '.kiosk-total', PRODUCT.price);
  await waitForText(kiosk, 'kiosk', 'li', PRODUCT.name);
  await waitForText(kiosk, 'kiosk', 'li', `1 x ${PRODUCT.price}`);
  console.log('kiosk: connected, shows the cart and the total');

  await phone.locator(button('Pay')).click();
  const paid = await waitForEvent(phone, 'checkout.paid');
  check(paid.totalCents === PRODUCT.priceCents, `phone UI: the receipt has the total ${paid.totalCents} cents.`);
  check(paid.kiosk.name === KIOSK_NAME, `phone UI: the receipt names the kiosk "${paid.kiosk.name}".`);
  check(paid.items.length === 1 && paid.items[0].name === PRODUCT.name, 'phone UI: the receipt does not hold the one product.');
  await waitForText(phone, 'phone UI', `${SHEET} h2`, 'Paid');
  await waitForText(phone, 'phone UI', SHEET, `Order ${paid.orderId}`);
  await waitForText(phone, 'phone UI', `${SHEET} li`, PRODUCT.name);
  await waitForText(phone, 'phone UI', SHEET, DEMO_PAYMENT_LINE);
  await waitForText(phone, 'phone UI', 'section', 'Your cart is empty.');
  console.log('phone UI: checkout sheet answered with Pay, the receipt shows the order');
  await waitForText(kiosk, 'kiosk', 'h1', 'Paid');
  await waitForText(kiosk, 'kiosk', '.kiosk-total', PRODUCT.price);
  await waitForText(kiosk, 'kiosk', 'li', PRODUCT.name);
  await waitForText(kiosk, 'kiosk', '.kiosk-row', DEMO_PAYMENT_LINE);
  console.log(`kiosk: paid, order ${paid.orderId}`);
  await waitForText(mirror, 'mirror', `${MIRROR_VOICE} li`, PAID_LINE);
  await waitForText(mirror, 'mirror', MIRROR_CART, 'The cart is empty.');
  console.log('mirror: shows the line of the payment and an empty cart');

  const answer = await fetch(`${server.url}/api/sessions/${session.get('s')}?token=${session.get('t')}`);
  check(answer.ok, `server: the snapshot call gave the status ${answer.status}.`);
  const snapshot = await answer.json();
  check(snapshot.phase === 'paid', `server: the phase of the session is "${snapshot.phase}".`);
  check(snapshot.cart.items.length === 0, 'server: the cart of the paid session is not empty.');
  check(snapshot.lastReceipt?.orderId === paid.orderId, 'server: the snapshot does not hold the receipt of the page.');
  check(
    snapshot.captions.some((caption) => caption.text.startsWith(PAID_LINE)),
    `server: no caption of the snapshot starts with "${PAID_LINE}".`,
  );
  console.log('server: the snapshot has the phase paid, the receipt, and the line of the payment');

  // The server sends the caption of the payment after session.state with the phase paid.
  // BrowserBridge keeps the event stream open for a grace time after that event, so the page gets the caption.
  await waitForText(phone, 'phone UI', 'li', PAID_LINE);
  check(await phone.evaluate(() => window.glanceBridge.sessionQuery()) === null, 'phone UI: the bridge still holds the paid session.');
  console.log('phone UI: the captions show the line of the payment, and the bridge forgot the session');

  await phone.locator(button('Done')).click();
  await waitForText(phone, 'phone UI', 'h1', 'Set up Glance');
  console.log('phone UI: receipt answered with Done, the setup screen shows again');
}

async function main() {
  const problems = [];
  const stops = [];
  let server = null;
  try {
    // The key of GET /api/demo/latest, which the mirror page sends. A new one for each run, and it opens no other server.
    server = await startFakeServer({ fakeScript: resolve(here, 'server-web.fake-script.json'), demoKey: randomUUID() });
    stops.push(() => server.stop());
    console.log(`server: fake mode on ${server.url}`);
    const phoneUi = await startDevServer('apps/mobile/ui', server.url);
    stops.push(() => phoneUi.stop());
    const website = await startDevServer('apps/website', server.url);
    stops.push(() => website.stop());
    console.log(`pages: phone UI on ${phoneUi.url}, website on ${website.url}`);
    const browser = await startBrowser();
    stops.push(() => browser.close());
    await playShop(server, phoneUi.url, website.url, browser, problems);
  } catch (error) {
    problems.push(error.message);
  } finally {
    for (const stop of stops.reverse()) {
      await stop().catch((error) => problems.push(`A stop failed: ${error.message}`));
    }
    console.log('server, pages, and browser: stopped');
  }
  if (problems.length === 0) {
    console.log('result: pass');
    return 0;
  }
  for (const problem of problems) console.error(problem);
  if (server) {
    console.error(`The last ${LOG_TAIL_LINES} log lines of the server:`);
    // The server logs the path of a call with no query. This line also covers a log line that holds a token or the demo key.
    console.error(server.log.slice(-LOG_TAIL_LINES).join('\n').replace(/(token|key)=[^"&\s]+/g, '$1=<hidden>'));
  }
  console.error('result: fail');
  return 1;
}

main().then((code) => process.exit(code), (error) => {
  console.error(error);
  console.error('result: fail');
  process.exit(1);
});
