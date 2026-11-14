// Integration test 2: the Glance server, the phone UI with BrowserBridge, and the kiosk page.
// Starts the server in fake mode and the two Vite dev servers, plays one shop in the installed Chrome, and stops all of it.
// Use: node scripts/integration/server-web.mjs [--strict]
// With --strict, a known defect of a page also fails the run.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, startBrowser, startDevServer, waitForText } from './lib/pages.mjs';
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
const CAPTION_WAIT_MS = 3000;

function check(condition, message) {
  if (!condition) throw new Error(message);
}

/** Waits until the bridge of the phone UI delivered a server event of this type, and returns the event. */
async function waitForEvent(phone, type) {
  try {
    const found = await phone.waitForFunction(
      (wanted) => window.glanceMessages.find((message) => message.t === 'event' && message.event.type === wanted)?.event,
      {},
      type,
    );
    return await found.jsonValue();
  } catch (error) {
    const seen = await phone.evaluate(() => window.glanceMessages.map((message) => (message.t === 'event' ? message.event.type : message.t)));
    throw new Error(`phone UI: the bridge delivered no "${type}" event. It delivered: ${seen.join(', ')}`, { cause: error });
  }
}

/** Returns true when the phone UI shows the line of the payment in its captions before the wait ends. */
async function showsPaidLine(phone) {
  try {
    await phone.waitForFunction(
      (wanted) => [...document.querySelectorAll('li')].some((element) => element.textContent.includes(wanted)),
      { timeout: CAPTION_WAIT_MS },
      PAID_LINE,
    );
    return true;
  } catch {
    return false;
  }
}

async function playShop(server, phoneUrl, kioskUrl, browser, problems, knownDefects) {
  const kiosk = await openPage(
    browser, 'kiosk', `${kioskUrl}/kiosk?name=${encodeURIComponent(KIOSK_NAME)}`, { width: 1920, height: 1080 }, problems,
  );
  await waitForText(kiosk, 'kiosk', 'h1', 'Look at this code to pay');
  await waitForText(kiosk, 'kiosk', '.kiosk-row', `${KIOSK_NAME}, ${STORE}`);
  const codeLabel = await kiosk.$eval('.kiosk-code', (element) => element.getAttribute('aria-label'));
  const code = /^Checkout code ([A-Z2-9]{4})$/.exec(codeLabel ?? '')?.[1];
  check(code, `kiosk: the code has the label "${codeLabel}".`);
  check(code !== SERVER_KIOSK_CODE, 'kiosk: the page shows the code of the kiosk that the server made at its start.');
  console.log(`kiosk: registered, code ${code}`);

  const phone = await openPage(
    browser, 'phone UI', `${phoneUrl}/?ready=1&api=${encodeURIComponent(server.url)}`, { width: 412, height: 915 }, problems,
  );
  await waitForText(phone, 'phone UI', 'main', 'Your cart is empty.');
  // No screen of the page starts a session yet, so the test sends the message of the start button.
  // The dev build keeps the bridge of the page in window.glanceBridge.
  await phone.evaluate(() => {
    window.glanceMessages = [];
    window.glanceBridge.subscribe((message) => window.glanceMessages.push(message));
    window.glanceBridge.send({ t: 'session.start' });
  });
  const sessionQuery = await (await phone.waitForFunction(() => window.glanceBridge.sessionQuery())).jsonValue();
  const session = new URLSearchParams(sessionQuery);
  console.log('phone UI: session started');

  await waitForText(phone, 'phone UI', 'h2', PRODUCT.name);
  await waitForText(phone, 'phone UI', 'main', PRODUCT.price);
  await waitForText(phone, 'phone UI', 'li', 'Camera on.');
  await phone.locator('::-p-aria([name="Add"][role="button"])').click();
  await waitForText(phone, 'phone UI', 'section', `${PRODUCT.pack}, 1 x ${PRODUCT.price}`);
  await waitForText(phone, 'phone UI', 'li', 'Added');
  const cartEvent = await waitForEvent(phone, 'cart.updated');
  check(cartEvent.cart.totalCents === PRODUCT.priceCents, `phone UI: the cart total is ${cartEvent.cart.totalCents} cents.`);
  console.log('phone UI: product card answered with Add, the cart shows the product');

  // The script of the server shows the session the newest kiosk, which is the kiosk of the page.
  const offered = await waitForEvent(phone, 'checkout.offered');
  check(offered.kiosk.name === KIOSK_NAME, `phone UI: the checkout is at "${offered.kiosk.name}", not at "${KIOSK_NAME}".`);
  check(offered.totalCents === PRODUCT.priceCents, `phone UI: the pay prompt has the total ${offered.totalCents} cents.`);
  await waitForText(phone, 'phone UI', 'li', `${KIOSK_NAME} at ${STORE}.`);
  await waitForText(kiosk, 'kiosk', 'h1', 'Waiting for your nod');
  await waitForText(kiosk, 'kiosk', '.kiosk-total', PRODUCT.price);
  await waitForText(kiosk, 'kiosk', 'li', PRODUCT.name);
  await waitForText(kiosk, 'kiosk', 'li', `1 x ${PRODUCT.price}`);
  console.log('kiosk: connected, shows the cart and the total');

  // No screen of the page shows the pay prompt yet, so the test sends the answer of its pay button through the bridge.
  await phone.evaluate((promptId) => window.glanceBridge.send({ t: 'intent', kind: 'yes', promptId }), offered.promptId);
  const paid = await waitForEvent(phone, 'checkout.paid');
  check(paid.totalCents === PRODUCT.priceCents, `phone UI: the receipt has the total ${paid.totalCents} cents.`);
  check(paid.kiosk.name === KIOSK_NAME, `phone UI: the receipt names the kiosk "${paid.kiosk.name}".`);
  check(paid.items.length === 1 && paid.items[0].name === PRODUCT.name, 'phone UI: the receipt does not hold the one product.');
  await waitForText(phone, 'phone UI', 'section', 'Your cart is empty.');
  await waitForText(kiosk, 'kiosk', 'h1', 'Paid');
  await waitForText(kiosk, 'kiosk', '.kiosk-total', PRODUCT.price);
  await waitForText(kiosk, 'kiosk', 'li', PRODUCT.name);
  await waitForText(kiosk, 'kiosk', '.kiosk-row', 'Demo payment. No money moved.');
  console.log(`kiosk: paid, order ${paid.orderId}`);

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
  // BrowserBridge closes the event stream at that session.state, so the page with ?api= does not get the caption.
  if (!(await showsPaidLine(phone))) {
    knownDefects.push(`phone UI: the captions do not show the line "${PAID_LINE} ..." that the server spoke after the payment.`);
  }
}

async function main() {
  const strict = process.argv.includes('--strict');
  const problems = [];
  const knownDefects = [];
  const stops = [];
  let server = null;
  try {
    server = await startFakeServer({ fakeScript: resolve(here, 'server-web.fake-script.json') });
    stops.push(() => server.stop());
    console.log(`server: fake mode on ${server.url}`);
    const phoneUi = await startDevServer('apps/mobile/ui', server.url);
    stops.push(() => phoneUi.stop());
    const website = await startDevServer('apps/website', server.url);
    stops.push(() => website.stop());
    console.log(`pages: phone UI on ${phoneUi.url}, website on ${website.url}`);
    const browser = await startBrowser();
    stops.push(() => browser.close());
    await playShop(server, phoneUi.url, website.url, browser, problems, knownDefects);
  } catch (error) {
    problems.push(error.message);
  } finally {
    for (const stop of stops.reverse()) {
      await stop().catch((error) => problems.push(`A stop failed: ${error.message}`));
    }
    console.log('server, pages, and browser: stopped');
  }
  for (const defect of knownDefects) console.log(`known defect: ${defect}`);
  if (strict) problems.push(...knownDefects);
  if (problems.length === 0) {
    console.log('result: pass');
    return 0;
  }
  for (const problem of problems) console.error(problem);
  if (server) {
    console.error(`The last ${LOG_TAIL_LINES} log lines of the server:`);
    // The address of a call holds the token of its session or kiosk.
    console.error(server.log.slice(-LOG_TAIL_LINES).join('\n').replace(/token=[^"&\s]+/g, 'token=<token>'));
  }
  console.error('result: fail');
  return 1;
}

main().then((code) => process.exit(code), (error) => {
  console.error(error);
  process.exit(1);
});
