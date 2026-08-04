// Shared UI helpers for menu/game HUD surfaces.

function createPerformanceTracker(maxSamples = 120) {
  return {
    maxSamples: Math.max(10, maxSamples | 0),
    samples: [],
    measuredFps: 0,
    averageFps: 0,
    low1Fps: 0,
    totalMs: 0, updateMs: 0, worldMs: 0, entityMs: 0,
    weatherMs: 0, hudMs: 0, minimapMs: 0, pixiFlushMs: 0,
    browserRafFps: 0, periodMs: 0, workMs: 0, waitMs: 0,
    backend: "p5",
    paused: false,
  };
}

function recordPerformanceSample(tracker, measuredFps) {
  if (!tracker) return tracker;
  const fps = Number(measuredFps);
  if (!Number.isFinite(fps) || fps <= 0) return tracker;

  tracker.measuredFps = fps;
  tracker.samples.push(fps);
  if (tracker.samples.length > tracker.maxSamples) tracker.samples.shift();

  const sum = tracker.samples.reduce((acc, value) => acc + value, 0);
  tracker.averageFps = tracker.samples.length ? (sum / tracker.samples.length) : fps;

  const sorted = tracker.samples.slice().sort((a, b) => a - b);
  const lowIndex = Math.max(0, Math.floor(sorted.length * 0.01));
  tracker.low1Fps = sorted[lowIndex] || fps;
  return tracker;
}

function resetPerformanceTracker(tracker) {
  if (!tracker) return;
  tracker.samples = [];
  tracker.measuredFps = tracker.averageFps = tracker.low1Fps = 0;
  tracker.totalMs = tracker.updateMs = tracker.worldMs = tracker.entityMs = 0;
  tracker.weatherMs = tracker.hudMs = tracker.minimapMs = tracker.pixiFlushMs = 0;
  tracker.browserRafFps = 0;
  tracker.periodMs = tracker.workMs = tracker.waitMs = 0;
  tracker.paused = false;
}

function getViewportSize() {
  const hasWindow = typeof window !== "undefined";
  const vv = hasWindow ? window.visualViewport : null;
  const viewportW = Math.max(
    1,
    Math.round((vv && vv.width) || (hasWindow ? window.innerWidth : 0) || (typeof windowWidth !== "undefined" ? windowWidth : 0) || 1),
  );
  const viewportH = Math.max(
    1,
    Math.round((vv && vv.height) || (hasWindow ? window.innerHeight : 0) || (typeof windowHeight !== "undefined" ? windowHeight : 0) || 1),
  );
  return { width: viewportW, height: viewportH };
}

function getPerformanceOverlaySize(uiScaleFactor = 1, maxWidth = Infinity) {
  const safeUiScaleFactor = Math.max(0.85, Math.min(1.4, Number(uiScaleFactor) || 1));
  const widthCap = Number.isFinite(maxWidth) ? Math.max(1, Number(maxWidth)) : Infinity;
  const scaleFactor = Math.min(safeUiScaleFactor, widthCap / 220);
  return {
    width: Math.round(220 * scaleFactor),
    height: Math.round(24 * scaleFactor),
    uiScaleFactor: scaleFactor,
  };
}

function drawPerformanceOverlayPanel(opts = {}) {
  const tracker = opts.tracker;
  if (!tracker) return;

  const _sz = getPerformanceOverlaySize(opts.uiScaleFactor || 1, opts.maxWidth);
  const x = Math.round(Number(opts.x) || 0);
  const y = Math.round(Number(opts.y) || 0);
  const w = _sz.width;
  const h = _sz.height;
  const uiScaleFactor = _sz.uiScaleFactor;
  const padX = Math.round(6 * uiScaleFactor);
  const centerY = y + h / 2;

  push();
  noStroke();
  fill(0, 0, 0, 205);
  rect(x, y, w, h, Math.max(2, Math.round(3 * uiScaleFactor)));

  const modeLabel = (opts.modeLabel || getFpsModeLabel(normalizeFpsMode(opts.fpsMode ?? opts.targetFps)))
    .replace(' (Max)', '');
  const metrics = [
    ["CUR", String(Math.round(tracker.measuredFps || 0)), 0.2],
    ["AVG", String(Math.round(tracker.averageFps || tracker.measuredFps || 0)), 0.21],
    ["1%", String(Math.round(tracker.low1Fps || tracker.measuredFps || 0)), 0.17],
    ["MODE", modeLabel, 0.42],
  ];
  let fieldX = x + padX;
  const usableW = w - padX * 2;
  metrics.forEach(([label, value, share]) => {
    const fieldW = usableW * share;
    textAlign(LEFT, CENTER);
    textStyle(NORMAL);
    fill(178, 178, 186);
    if (typeof gTextSize === "function") gTextSize(Math.round(6 * uiScaleFactor));
    else textSize(Math.round(6 * uiScaleFactor));
    text(label, fieldX, centerY);

    const labelW = textWidth(label) + Math.round(3 * uiScaleFactor);
    textStyle(BOLD);
    fill(247, 247, 250);
    if (typeof gTextSize === "function") gTextSize(Math.round(8 * uiScaleFactor));
    else textSize(Math.round(8 * uiScaleFactor));
    text(value, fieldX + labelW, centerY);
    fieldX += fieldW;
  });

  textStyle(NORMAL);
  pop();
}
