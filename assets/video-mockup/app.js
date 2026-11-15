import { cerealPickupClip } from './clips/cerealPickup.js';
import { computeMockupState, formatEur } from './engine.js';
import { customSlotSkin } from './skins/customSlotSkin.js';
import { glanceAppSkin } from './skins/glanceAppSkin.js';
import { screenshotBeatSkin } from './skins/screenshotBeatSkin.js';
import { shelfEdgeSkin } from './skins/shelfEdgeSkin.js';
import { telemetryHudSkin } from './skins/telemetryHudSkin.js';

const SKINS = [glanceAppSkin, screenshotBeatSkin, shelfEdgeSkin, telemetryHudSkin, customSlotSkin];
const clip = cerealPickupClip;

const shellEl = document.getElementById('studio-shell');
const stageEl = document.getElementById('stage-canvas');
const videoEl = document.getElementById('clip-video');
const videoErrEl = document.getElementById('video-error');
const fileInputEl = document.getElementById('file-input');
const loadFileBtn = document.getElementById('btn-load-file');
const loadFileInlineBtn = document.getElementById('btn-load-inline');
const phoneScreenEl = document.getElementById('phone-screen');
const backendInspectorEl = document.getElementById('backend-inspector');
const biPanelTitleEl = document.getElementById('bi-panel-title');
const biPipelineBtn = document.getElementById('btn-bi-pipeline');
const biPr7Btn = document.getElementById('btn-bi-pr7');
const biPipelineViewEl = document.getElementById('bi-pipeline-view');
const backendPr7ViewEl = document.getElementById('backend-pr7-view');
const pr7HudCameraEl = document.getElementById('pr7-hud-camera');
const pr7HudTitleEl = document.getElementById('pr7-hud-title');
const pr7HudPriceEl = document.getElementById('pr7-hud-price');
const pr7HudWarningEl = document.getElementById('pr7-hud-warning');
const pr7HudPromptEl = document.getElementById('pr7-hud-prompt');
const pr7HudTotalEl = document.getElementById('pr7-hud-total');
const pr7HudCaptionEl = document.getElementById('pr7-hud-caption');
const pr7HudDockEl = document.getElementById('pr7-hud-dock');
const pr7HudYesEl = document.getElementById('pr7-hud-yes');
const pr7HudNoEl = document.getElementById('pr7-hud-no');
const pr7MirrorCaptionsEl = document.getElementById('pr7-mirror-captions');
const pr7MirrorCartEl = document.getElementById('pr7-mirror-cart');
const pr7MirrorTotalEl = document.getElementById('pr7-mirror-total');
const biPhaseBadgeEl = document.getElementById('bi-phase-badge');
const biDeviceMetaEl = document.getElementById('bi-device-meta');
const biVisionTagEl = document.getElementById('bi-vision-tag');
const biCropBoxEl = document.getElementById('bi-crop-box');
const biCropLabelEl = document.getElementById('bi-crop-label');
const biCropSubEl = document.getElementById('bi-crop-sub');
const biJsonBoxEl = document.getElementById('bi-json-box');
const biAudioStateEl = document.getElementById('bi-audio-state');
const biAudioBars = Array.from(document.getElementById('bi-audio-bars').children);
const biAudioCueEl = document.getElementById('bi-audio-cue');
const biImuValEl = document.getElementById('bi-imu-val');
const biImuLineEl = document.getElementById('bi-imu-line');
const biImuGateEl = document.getElementById('bi-imu-gate');
const biImuWindowEl = document.getElementById('bi-imu-window');
const biCartTotalEl = document.getElementById('bi-cart-total');
const biCartListEl = document.getElementById('bi-cart-list');

const playBtn = document.getElementById('btn-play');
const restartBtn = document.getElementById('btn-restart');
const speedBtn = document.getElementById('btn-speed');
const loopBtn = document.getElementById('btn-loop');
const cleanBtn = document.getElementById('btn-clean');
const cleanHintBtn = document.getElementById('clean-hint');

const skinSelectEl = document.getElementById('select-skin');
const layoutSelectEl = document.getElementById('select-layout');
const beatBarEl = document.getElementById('beat-bar');
const scrubberEl = document.getElementById('scrubber');
const timeReadoutEl = document.getElementById('time-readout');

let activeSkin = SKINS[0];
let videoReady = false;
let virtualPlaying = false;
let virtualTime = 0;
let playbackRate = 1.0;
let isLooping = true;
let isScrubbing = false;
let lastFrameMs = performance.now();
let currentObjectUrl = null;
let idleTimer = null;

function formatClock(sec) {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const rem = (clamped % 60).toFixed(2).padStart(5, '0');
  return `${String(mins).padStart(2, '0')}:${rem}`;
}

function getCurrentTime() {
  return videoReady ? videoEl.currentTime : virtualTime;
}

function setCurrentTime(nextSec) {
  const clamped = Math.max(0, Math.min(clip.duration, nextSec));
  virtualTime = clamped;
  if (videoReady) {
    videoEl.currentTime = clamped;
  }
}

function isPlaying() {
  return videoReady ? !videoEl.paused && !videoEl.ended : virtualPlaying;
}

async function togglePlay() {
  if (videoReady) {
    if (videoEl.paused || videoEl.ended) {
      if (videoEl.ended) videoEl.currentTime = 0;
      try {
        await videoEl.play();
      } catch {
        virtualPlaying = true;
      }
    } else {
      videoEl.pause();
    }
  } else {
    if (virtualTime >= clip.duration) {
      virtualTime = 0;
    }
    virtualPlaying = !virtualPlaying;
  }
  syncControls();
}

function restartPlayback() {
  setCurrentTime(0);
  if (videoReady) {
    void videoEl.play().catch(() => {});
  } else {
    virtualPlaying = true;
  }
  syncControls();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildImuPolyline(samples, width, height) {
  if (!samples.length) return '';
  const maxAbs = 36;
  const stepX = width / Math.max(1, samples.length - 1);
  return samples
    .map((val, idx) => {
      const x = (idx * stepX).toFixed(1);
      const clamped = Math.max(-maxAbs, Math.min(maxAbs, val));
      const y = ((0.5 - clamped / (2 * maxAbs)) * height).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');
}

let lastBiEventType = '';
let lastBiCartSig = '';
let lastPr7CaptionSig = '';
let lastPr7CartSig = '';

function setBackendView(view) {
  const isPr7 = view === 'pr7';
  biPipelineViewEl.hidden = isPr7;
  backendPr7ViewEl.hidden = !isPr7;
  biPipelineBtn.classList.toggle('is-active', !isPr7);
  biPr7Btn.classList.toggle('is-active', isPr7);
  biPipelineBtn.setAttribute('aria-selected', isPr7 ? 'false' : 'true');
  biPr7Btn.setAttribute('aria-selected', isPr7 ? 'true' : 'false');
  biPanelTitleEl.textContent = isPr7 ? 'PR #7 MIRROR + DISPLAY HUD' : 'BACKEND & GLASSES PIPELINE';
}

function renderPr7CompanionView(state) {
  const count = state.cart.itemCount;
  const itemsText = count === 1 ? '1 item' : `${count} items`;
  const latestCaption = state.speech.transcriptHistory[state.speech.transcriptHistory.length - 1];

  pr7HudCameraEl.textContent = 'Camera on';
  pr7HudTotalEl.textContent = `${state.cart.totalFormatted}, ${itemsText}`;
  pr7HudCaptionEl.textContent = latestCaption ? latestCaption.text : 'Listening for shelf scan';

  if (state.prompt && state.prompt.state === 'pending') {
    const { product } = state.prompt;
    pr7HudTitleEl.textContent = `${product.name}, ${product.packSize}`;
    pr7HudPriceEl.textContent = formatEur(product.priceCents);
    pr7HudPriceEl.hidden = false;
    if (product.warnings.length > 0) {
      pr7HudWarningEl.textContent = product.warnings[0];
      pr7HudWarningEl.hidden = false;
    } else {
      pr7HudWarningEl.hidden = true;
    }
    pr7HudPromptEl.textContent = 'Add to cart?';
    pr7HudDockEl.hidden = false;
    pr7HudYesEl.textContent = 'Add';
    pr7HudNoEl.textContent = 'Skip';
  } else {
    pr7HudTitleEl.textContent = 'No product in view';
    pr7HudPriceEl.hidden = true;
    pr7HudWarningEl.hidden = true;
    pr7HudPromptEl.textContent =
      state.prompt && state.prompt.state === 'accepted'
        ? `Added ${state.prompt.product.name}. Hold a product up to hear its price.`
        : 'Hold a product up to hear its price.';
    pr7HudDockEl.hidden = true;
  }

  const mirrorCaptions = [...state.speech.transcriptHistory].reverse().slice(0, 3);
  const mirrorCapSig = mirrorCaptions.map((c) => `${c.id}:${c.isLive ? '1' : '0'}`).join('|');
  if (mirrorCapSig !== lastPr7CaptionSig) {
    lastPr7CaptionSig = mirrorCapSig;
    pr7MirrorCaptionsEl.innerHTML = mirrorCaptions
      .map((entry, idx) => {
        const cls = idx === 0 ? 'mirror-cap-current' : 'mirror-cap-old';
        return `<li class="${cls}"><span lang="en">${escapeHtml(entry.text)}</span></li>`;
      })
      .join('');
  }

  const mirrorCartSig = `${state.cart.items.length}:${state.cart.totalCents}:${state.cart.justAddedId ?? ''}`;
  if (mirrorCartSig !== lastPr7CartSig) {
    lastPr7CartSig = mirrorCartSig;
    pr7MirrorTotalEl.textContent = state.cart.totalFormatted;
    pr7MirrorCartEl.innerHTML = state.cart.items
      .map((item) => {
        const unit = formatEur(item.unitPriceCents);
        return `
          <li class="mirror-cart-row">
            <span>${escapeHtml(item.name)} <small>(${escapeHtml(item.packSize)}, ${item.qty} x ${unit})</small></span>
            <strong>${formatEur(item.lineTotalCents)}</strong>
          </li>
        `;
      })
      .join('');
  }
}

function renderBackendInspector(state) {
  renderBackendInspectorCore(state);
  renderPr7CompanionView(state);
}

function renderBackendInspectorCore(state) {
  backendInspectorEl.dataset.phase = state.phase;
  backendInspectorEl.dataset.speaking = state.speech.isSpeaking ? 'true' : 'false';
  backendInspectorEl.dataset.triggered = state.imu.nodTriggered ? 'true' : 'false';

  biPhaseBadgeEl.textContent = state.phaseLabel.toUpperCase();
  biDeviceMetaEl.textContent = `${state.device.model} | ${state.device.streamSpec} | Blur ON | t=${state.t.toFixed(2)}s`;

  biVisionTagEl.textContent =
    state.vision.status === 'identified'
      ? `GEMINI ${state.vision.latencyMs}ms | 0 STORED`
      : '0 FRAMES STORED';

  biCropBoxEl.dataset.status = state.vision.status;
  if (state.vision.status === 'identified') {
    biCropLabelEl.textContent = `${state.prompt.product.name} (${Math.round(state.vision.confidence * 100)}%)`;
    biCropSubEl.textContent = `Seq #${state.vision.seq} | Crop ${state.vision.cropPct}`;
  } else if (state.vision.status === 'sampling') {
    biCropLabelEl.textContent = 'LOCKING SHARPEST FRAME';
    biCropSubEl.textContent = `Seq #${state.vision.seq} -> Gemini Flash Lite`;
  } else {
    biCropLabelEl.textContent = `CROP ${state.vision.cropPct}`;
    biCropSubEl.textContent = `Seq #${state.vision.seq} | Status: none`;
  }

  if (state.lastEvent.type !== lastBiEventType) {
    lastBiEventType = state.lastEvent.type;
    biJsonBoxEl.textContent = JSON.stringify(state.lastEvent.payload, null, 2);
  }

  biAudioStateEl.textContent = state.speech.isSpeaking ? 'PLAYING CLIP' : 'STANDBY';
  biAudioBars.forEach((bar, idx) => {
    if (state.speech.isSpeaking) {
      const pct = Math.abs(Math.sin(state.t * 14 + idx * 0.85)) * 74 + 22;
      bar.style.height = `${pct.toFixed(0)}%`;
      bar.dataset.active = 'true';
    } else {
      bar.style.height = '16%';
      bar.dataset.active = 'false';
    }
  });

  if (state.speech.isSpeaking) {
    biAudioCueEl.textContent = state.speech.revealedWords.join(' ') || state.speech.activeText;
  } else {
    const latest = state.speech.transcriptHistory[state.speech.transcriptHistory.length - 1];
    biAudioCueEl.textContent = latest ? latest.text : 'Listening for shelf scan';
  }

  const pitchSign = state.imu.pitchDegPerSec >= 0 ? '+' : '';
  biImuValEl.textContent = `${pitchSign}${state.imu.pitchDegPerSec.toFixed(1)} deg/s`;
  biImuLineEl.setAttribute('points', buildImuPolyline(state.imu.samples, 240, 60));

  if (state.imu.nodTriggered) {
    biImuGateEl.textContent = 'INTENT: head:yes';
    biImuWindowEl.textContent = 'CONFIRMED';
  } else if (state.prompt && state.prompt.state === 'pending') {
    biImuGateEl.textContent = 'GATE: ARMED';
    biImuWindowEl.textContent = `${state.prompt.headWindowSecLeft.toFixed(1)}s window`;
  } else {
    biImuGateEl.textContent = 'GATE: LOCKED';
    biImuWindowEl.textContent = 'THRESH +/-18 deg/s';
  }

  const cartSig = `${state.cart.items.length}:${state.cart.totalCents}:${state.cart.justAddedId ?? ''}`;
  if (cartSig !== lastBiCartSig) {
    lastBiCartSig = cartSig;
    biCartTotalEl.textContent = state.cart.totalFormatted;
    biCartListEl.innerHTML = state.cart.items
      .map((item) => {
        const isNew = item.id === state.cart.justAddedId;
        return `
          <div class="bi-cart-item ${isNew ? 'is-new' : ''}">
            <div class="bi-cart-info">
              <span class="bi-cart-name">${item.qty}x ${escapeHtml(item.name)}</span>
              <span class="bi-cart-size">${escapeHtml(item.packSize)}</span>
            </div>
            <span class="bi-cart-price">${formatEur(item.lineTotalCents)}</span>
          </div>
        `;
      })
      .join('');
  }
}

function renderMockup(timeSec) {
  const state = computeMockupState(clip, timeSec);
  activeSkin.render(state);
  renderBackendInspector(state);
  return state;
}

function mountSkin(skinId) {
  const next = SKINS.find((s) => s.id === skinId) ?? SKINS[0];
  if (activeSkin && typeof activeSkin.unmount === 'function') {
    activeSkin.unmount();
  }
  activeSkin = next;
  activeSkin.mount(phoneScreenEl);
  renderMockup(getCurrentTime());
}

function syncControls() {
  const playing = isPlaying();
  playBtn.textContent = playing ? 'Pause' : 'Play';
  playBtn.classList.toggle('is-active', playing);
  speedBtn.textContent = `${playbackRate.toFixed(1)}x`;
  speedBtn.classList.toggle('is-active', playbackRate !== 1.0);
  loopBtn.classList.toggle('is-active', isLooping);
  loopBtn.textContent = isLooping ? 'Loop: On' : 'Loop: Off';
}

function updateCleanIdleState() {
  clearTimeout(idleTimer);
  cleanHintBtn.style.opacity = '1';
  if (shellEl.classList.contains('is-clean')) {
    idleTimer = setTimeout(() => {
      cleanHintBtn.style.opacity = '0';
    }, 2000);
  }
}

function setCleanView(enabled) {
  shellEl.classList.toggle('is-clean', enabled);
  cleanHintBtn.hidden = !enabled;
  updateCleanIdleState();
}

function setupSkinsAndBeats() {
  SKINS.forEach((skin) => {
    const opt = document.createElement('option');
    opt.value = skin.id;
    opt.textContent = skin.name;
    skinSelectEl.appendChild(opt);
  });
  skinSelectEl.value = activeSkin.id;

  clip.beats.forEach((beat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'beat-pill';
    btn.dataset.beatId = beat.id;
    btn.textContent = beat.jumpLabel;
    btn.addEventListener('click', () => {
      setCurrentTime(beat.start);
      renderMockup(beat.start);
    });
    beatBarEl.appendChild(btn);
  });

  scrubberEl.max = String(clip.duration);
}

function loadSelectedFile(file) {
  if (!file) return;
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }
  currentObjectUrl = URL.createObjectURL(file);
  videoReady = false;
  videoErrEl.hidden = true;
  videoEl.src = currentObjectUrl;
  videoEl.load();
}

function bindEvents() {
  videoEl.addEventListener('loadedmetadata', () => {
    videoReady = true;
    videoErrEl.hidden = true;
    videoEl.loop = isLooping;
    videoEl.playbackRate = playbackRate;
    syncControls();
  });

  videoEl.addEventListener('error', () => {
    videoReady = false;
    videoErrEl.hidden = false;
    syncControls();
  });

  videoEl.addEventListener('play', syncControls);
  videoEl.addEventListener('pause', syncControls);
  videoEl.addEventListener('ended', syncControls);

  playBtn.addEventListener('click', () => {
    void togglePlay();
  });

  restartBtn.addEventListener('click', restartPlayback);

  speedBtn.addEventListener('click', () => {
    playbackRate = playbackRate === 1.0 ? 0.5 : 1.0;
    if (videoReady) {
      videoEl.playbackRate = playbackRate;
    }
    syncControls();
  });

  loopBtn.addEventListener('click', () => {
    isLooping = !isLooping;
    videoEl.loop = isLooping;
    syncControls();
  });

  cleanBtn.addEventListener('click', () => setCleanView(true));
  cleanHintBtn.addEventListener('click', () => setCleanView(false));

  skinSelectEl.addEventListener('change', (event) => {
    mountSkin(event.target.value);
  });

  layoutSelectEl.addEventListener('change', (event) => {
    stageEl.dataset.layout = event.target.value;
  });

  biPipelineBtn.addEventListener('click', () => setBackendView('pipeline'));
  biPr7Btn.addEventListener('click', () => setBackendView('pr7'));

  scrubberEl.addEventListener('pointerdown', () => {
    isScrubbing = true;
  });
  scrubberEl.addEventListener('pointerup', () => {
    isScrubbing = false;
  });
  scrubberEl.addEventListener('input', (event) => {
    const val = Number(event.target.value);
    setCurrentTime(val);
    renderMockup(val);
  });

  loadFileBtn.addEventListener('click', () => fileInputEl.click());
  loadFileInlineBtn.addEventListener('click', () => fileInputEl.click());
  fileInputEl.addEventListener('change', (event) => {
    const [file] = event.target.files ?? [];
    loadSelectedFile(file);
  });

  window.addEventListener('mousemove', updateCleanIdleState);

  window.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') {
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      void togglePlay();
    } else if (event.key === 'r' || event.key === 'R') {
      restartPlayback();
    } else if (event.key === 'h' || event.key === 'H') {
      setCleanView(!shellEl.classList.contains('is-clean'));
    }
  });
}

function tick(nowMs) {
  const dtSec = Math.min(0.1, (nowMs - lastFrameMs) / 1000);
  lastFrameMs = nowMs;

  if (!videoReady && virtualPlaying) {
    virtualTime += dtSec * playbackRate;
    if (virtualTime >= clip.duration) {
      if (isLooping) {
        virtualTime = 0;
      } else {
        virtualTime = clip.duration;
        virtualPlaying = false;
        syncControls();
      }
    }
  }

  const state = renderMockup(getCurrentTime());

  if (!isScrubbing) {
    scrubberEl.value = String(state.t);
  }
  timeReadoutEl.textContent = `${formatClock(state.t)} / ${formatClock(clip.duration)}`;

  const activeBeat =
    clip.beats.find((beat, idx) => {
      const isLast = idx === clip.beats.length - 1;
      return isLast ? state.t >= beat.start : state.t >= beat.start && state.t < beat.end;
    }) ?? clip.beats[0];

  beatBarEl.querySelectorAll('.beat-pill').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.beatId === activeBeat.id);
  });

  requestAnimationFrame(tick);
}

setupSkinsAndBeats();
bindEvents();
mountSkin(activeSkin.id);
videoEl.src = clip.videoUrl;
videoEl.loop = isLooping;
syncControls();
requestAnimationFrame(tick);
