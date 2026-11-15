const HEAD_NOD_THRESHOLD_DEG_PER_SEC = 18;
const IMU_SAMPLE_COUNT = 40;
const IMU_SAMPLE_STEP_SEC = 0.05;

export function formatEur(cents) {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError('Price in cents must be a non-negative integer');
  }
  return `${(cents / 100).toFixed(2)} EUR`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function gaussianPulse(t, center, width, amplitude) {
  const dist = (t - center) / width;
  return amplitude * Math.exp(-0.5 * dist * dist);
}

export function samplePitchDegPerSec(timeline, time) {
  if (time < 0) return 0;
  const baseline = Math.sin(time * 5.2) * 2.4 + Math.cos(time * 2.1) * 1.1;
  const downSpike = gaussianPulse(time, timeline.nodPeakDown, 0.055, -29);
  const upRecovery = gaussianPulse(time, timeline.nodPeakUp, 0.06, 24);
  return Number((baseline + downSpike + upRecovery).toFixed(1));
}

function computeImuState(timeline, t) {
  const samples = [];
  for (let i = IMU_SAMPLE_COUNT - 1; i >= 0; i -= 1) {
    const sampleTime = t - i * IMU_SAMPLE_STEP_SEC;
    samples.push(samplePitchDegPerSec(timeline, sampleTime));
  }
  const pitchDegPerSec = samples[samples.length - 1] ?? 0;
  return {
    pitchDegPerSec,
    samples,
    nodTriggered: t >= timeline.nodTrigger,
    thresholdDegPerSec: HEAD_NOD_THRESHOLD_DEG_PER_SEC,
  };
}

function computeSpeechState(timeline, t) {
  const activeCue = timeline.speechCues.find((cue) => t >= cue.start && t <= cue.end) ?? null;

  let isSpeaking = false;
  let activeText = '';
  let revealedWords = [];
  let hiddenWords = [];

  if (activeCue) {
    isSpeaking = true;
    activeText = activeCue.text;
    const words = activeCue.text.split(/\s+/);
    const span = Math.max(0.1, activeCue.end - activeCue.start);
    const progress = clamp((t - activeCue.start) / span, 0, 1);
    const revealedCount = clamp(Math.ceil(words.length * progress), 1, words.length);
    revealedWords = words.slice(0, revealedCount);
    hiddenWords = words.slice(revealedCount);
  }

  const transcriptHistory = [
    ...timeline.initialTranscript.map((entry) => ({
      id: entry.id,
      timeLabel: entry.time,
      text: entry.text,
      isLive: false,
    })),
    ...timeline.speechCues
      .filter((cue) => t >= cue.start)
      .map((cue) => ({
        id: cue.id,
        timeLabel: cue.timeLabel,
        text: cue.text,
        isLive: t <= cue.end,
      })),
  ];

  return {
    isSpeaking,
    activeText,
    revealedWords,
    hiddenWords,
    transcriptHistory,
  };
}

function computeCartState(clip, t) {
  const items = clip.initialCart.map((item) => ({ ...item }));
  let justAddedId = null;

  if (t >= clip.timeline.nodTrigger) {
    const product = clip.targetProduct;
    items.push({
      id: product.id,
      name: product.name,
      packSize: product.packSize,
      qty: 1,
      unitPriceCents: product.priceCents,
      lineTotalCents: product.priceCents,
    });
    justAddedId = product.id;
  }

  const totalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);

  return {
    items,
    totalCents,
    totalFormatted: formatEur(totalCents),
    itemCount,
    justAddedId,
  };
}

function computePromptState(clip, t) {
  const { timeline, targetProduct } = clip;
  if (t < timeline.pendingStart) {
    return null;
  }

  const accepted = t >= timeline.nodTrigger;
  if (!accepted) {
    const elapsedSinceWindowOpen = Math.max(0, t - timeline.headWindowStart);
    const headWindowSecLeft = Number(
      Math.max(0, timeline.headWindowDuration - elapsedSinceWindowOpen).toFixed(1),
    );
    const headWindowPct = clamp(
      (headWindowSecLeft / timeline.headWindowDuration) * 100,
      0,
      100,
    );
    return {
      promptId: timeline.promptId,
      product: targetProduct,
      state: 'pending',
      headWindowSecLeft,
      headWindowPct,
      undoSecLeft: 0,
    };
  }

  const elapsedSinceConfirm = t - timeline.nodTrigger;
  const undoSecLeft = Number(
    Math.max(0, timeline.undoDuration - elapsedSinceConfirm).toFixed(1),
  );
  return {
    promptId: timeline.promptId,
    product: targetProduct,
    state: 'accepted',
    headWindowSecLeft: 0,
    headWindowPct: 0,
    undoSecLeft,
  };
}

function computeVisionState(clip, t) {
  const { timeline } = clip;
  const seq = 1 + Math.floor(t * 7);

  if (t < timeline.detectStart) {
    return {
      status: 'none',
      confidence: 0,
      latencyMs: null,
      cropPct: '80% x 70%',
      seq,
    };
  }

  if (t < timeline.pendingStart) {
    return {
      status: 'sampling',
      confidence: null,
      latencyMs: Math.round((t - timeline.detectStart) * 760),
      cropPct: '80% x 70%',
      seq: 19,
    };
  }

  return {
    status: 'identified',
    confidence: 0.96,
    latencyMs: 680,
    cropPct: '80% x 70%',
    seq: 19,
  };
}

function computeLastEvent(clip, t) {
  const { timeline, targetProduct } = clip;

  if (t >= timeline.nodTrigger) {
    return {
      type: 'cart.updated',
      timestamp: '00:05.75',
      summary: `intent(head:yes) -> Added ${targetProduct.name}`,
      payload: {
        type: 'cart.updated',
        intent: { kind: 'yes', source: 'head', promptId: timeline.promptId },
        item: { productId: targetProduct.id, qty: 1, unitPriceCents: targetProduct.priceCents },
        totalCents: 1029,
      },
    };
  }

  if (t >= timeline.pendingStart) {
    return {
      type: 'glance.pending',
      timestamp: '00:03.60',
      summary: `Identified ${targetProduct.name} (${formatEur(targetProduct.priceCents)})`,
      payload: {
        type: 'glance.pending',
        promptId: timeline.promptId,
        product: {
          id: targetProduct.id,
          name: targetProduct.name,
          packSize: targetProduct.packSize,
          priceCents: targetProduct.priceCents,
        },
        warnings: targetProduct.warnings,
      },
    };
  }

  if (t >= timeline.detectStart) {
    return {
      type: 'frame.picked',
      timestamp: '00:02.60',
      summary: 'Sharpest frame #19 uploaded to Gemini (768px JPEG)',
      payload: {
        type: 'frame.picked',
        seq: 19,
        blurred: true,
        crop: '80%x70%',
      },
    };
  }

  return {
    type: 'session.state',
    timestamp: '00:00.00',
    summary: 'DAT stream active at 720x1280 @ 7fps',
    payload: {
      type: 'session.state',
      phase: 'browsing',
      stream: 'STREAMING',
    },
  };
}

export function computeMockupState(clip, rawTime) {
  const t = clamp(Number.isFinite(rawTime) ? rawTime : 0, 0, clip.duration);
  const progress = clip.duration > 0 ? t / clip.duration : 0;

  const activeBeat =
    clip.beats.find((beat, index) => {
      const isLast = index === clip.beats.length - 1;
      return isLast ? t >= beat.start : t >= beat.start && t < beat.end;
    }) ?? clip.beats[0];

  return {
    t,
    progress,
    phase: activeBeat.phase,
    phaseLabel: activeBeat.phaseLabel,
    device: { ...clip.device },
    vision: computeVisionState(clip, t),
    prompt: computePromptState(clip, t),
    speech: computeSpeechState(clip.timeline, t),
    imu: computeImuState(clip.timeline, t),
    cart: computeCartState(clip, t),
    lastEvent: computeLastEvent(clip, t),
  };
}
