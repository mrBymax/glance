// The placeholder page of the app. It stands in for the phone UI, and it is the manual test tool of the bridge.
//   Page to app: window.GlanceNative.postMessage(json)
//   App to page: window.__glanceReceive(json)
const MAX_LOG_LINES = 20;
const MAX_CAPTIONS = 5;

const element = (id) => document.getElementById(id);
const logLines = [];
const captions = [];
let promptId = null;

function log(direction, message) {
  logLines.push(`${direction} ${JSON.stringify(message)}`);
  element('log').textContent = logLines.slice(-MAX_LOG_LINES).join('\n');
}

function send(message) {
  log('>', message);
  if (window.GlanceNative) window.GlanceNative.postMessage(JSON.stringify(message));
  else log('!', 'This page runs outside the app, so the message went nowhere.');
}

function showPrompt(id, text) {
  promptId = id;
  element('prompt-text').textContent = id === null ? 'No prompt.' : `${text} (${id})`;
  element('add').disabled = id === null;
  element('skip').disabled = id === null;
}

function onEvent(event) {
  switch (event.type) {
    case 'glance.pending':
      showPrompt(event.promptId, event.product.name);
      break;
    case 'checkout.offered':
      showPrompt(event.promptId, event.kiosk.name);
      break;
    case 'glance.cleared':
      if (event.promptId === promptId) showPrompt(null, '');
      break;
    case 'checkout.paid':
    case 'checkout.cancelled':
    case 'checkout.failed':
      showPrompt(null, '');
      break;
    case 'caption': {
      captions.push(event.text);
      const list = element('captions');
      list.replaceChildren(
        ...captions.slice(-MAX_CAPTIONS).map((text) => {
          const item = document.createElement('li');
          item.textContent = text;
          return item;
        }),
      );
      break;
    }
  }
}

window.__glanceReceive = (json) => {
  const message = JSON.parse(json);
  log('<', message);
  if (message.t === 'native.state') element('state').textContent = JSON.stringify(message.state, null, 2);
  if (message.t === 'profile') element('profile').textContent = JSON.stringify(message.profile, null, 2);
  if (message.t === 'event') onEvent(message.event);
};

element('add').addEventListener('click', () => send({ t: 'intent', kind: 'yes', promptId }));
element('skip').addEventListener('click', () => send({ t: 'intent', kind: 'no', promptId }));

const BUTTONS = [
  ['setup.register', { t: 'setup.register' }],
  ['setup.requestCamera', { t: 'setup.requestCamera' }],
  ['setup.requestNotifications', { t: 'setup.requestNotifications' }],
  ['setup.openUpdate', { t: 'setup.openUpdate' }],
  ['session.start', { t: 'session.start' }],
  ['session.end', { t: 'session.end' }],
  ['intent undo', { t: 'intent', kind: 'undo' }],
  ['cart.edit oat-drink-1l 0', { t: 'cart.edit', productId: 'oat-drink-1l', qty: 0 }],
  ['profile.set speechRate 1.5', { t: 'profile.set', patch: { speechRate: 1.5 } }],
  ['profile.set haptics false', { t: 'profile.set', patch: { haptics: false } }],
  ['profile.set mainYes key', { t: 'profile.set', patch: { mainYes: 'key' } }],
  ['profile.set mainYes voice', { t: 'profile.set', patch: { mainYes: 'voice' } }],
  ['data.delete', { t: 'data.delete' }],
];

for (const [label, message] of BUTTONS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', () => send(message));
  element('buttons').append(button);
}

send({ t: 'ui.ready' });
