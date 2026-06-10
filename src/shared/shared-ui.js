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
  const scaleFactor = Math.min(safeUiScaleFactor, widthCap / 188);
  return {
    width: Math.round(188 * scaleFactor),
    height: Math.round(320 * scaleFactor),
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
  const padX = Math.round(12 * uiScaleFactor);
  const titleY = y + Math.round(16 * uiScaleFactor);
  const rowStartY = y + Math.round(40 * uiScaleFactor);
  const rowGap = Math.round(16 * uiScaleFactor);
  const valueX = x + w - Math.round(12 * uiScaleFactor);

  push();

  if (typeof BUTTON_BG !== "undefined" && BUTTON_BG) {
    image(BUTTON_BG, x - Math.round(10 * uiScaleFactor), y - Math.round(10 * uiScaleFactor), w + Math.round(20 * uiScaleFactor), h + Math.round(20 * uiScaleFactor));
  } else {
    noStroke();
    fill(16, 16, 20, 220);
    rect(x - Math.round(4 * uiScaleFactor), y - Math.round(4 * uiScaleFactor), w + Math.round(8 * uiScaleFactor), h + Math.round(8 * uiScaleFactor), 4);
  }

  stroke(typeof MENU_GOLD_BORDER !== "undefined" ? MENU_GOLD_BORDER : "rgba(184,134,11,0.65)");
  strokeWeight(Math.max(1, Math.round(2 * uiScaleFactor)));
  fill(20, 20, 24, 228);
  rect(x, y, w, h, 4);

  noStroke();
  fill(255, 214, 120);
  if (typeof gTextSize === "function") gTextSize(Math.round(11 * uiScaleFactor));
  else textSize(Math.round(11 * uiScaleFactor));
  textAlign(LEFT, CENTER);
  text("PERFORMANCE", x + padX, titleY);

  const sepY = Math.round(y + Math.round(27 * uiScaleFactor));
  stroke(typeof MENU_GOLD_BORDER !== "undefined" ? MENU_GOLD_BORDER : "rgba(184,134,11,0.65)");
  strokeWeight(Math.max(1, Math.round(1 * uiScaleFactor)));
  line(x + padX, sepY, x + w - padX, sepY);
  noStroke();

  if (tracker.paused) {
    fill(255, 200, 80);
    if (typeof gTextSize === "function") gTextSize(Math.round(13 * uiScaleFactor));
    else textSize(Math.round(13 * uiScaleFactor));
    textAlign(CENTER, CENTER);
    text("PAUSED", x + w / 2, rowStartY + rowGap * 2);
    pop();
    return;
  }

  const fmtMs  = (v) => (v > 0 ? v.toFixed(1) + " ms" : "—");
  const fmtFps = (v) => (v > 0 ? String(Math.round(v)) : "—");
  const modeLabel = opts.modeLabel || getFpsModeLabel(normalizeFpsMode(opts.fpsMode ?? opts.targetFps));
  const targetLabel = (normalizeFpsMode(opts.fpsMode ?? opts.targetFps) === 'unlimited')
    ? 'uncapped'
    : (Math.round(opts.targetFps || 0) + ' fps');
  const backendLabel = tracker.backend === "pixi" ? "pixi/webgl" : "p5/canvas";

  const rows = [
    ["FPS",     String(Math.round(tracker.measuredFps || 0))],
    ["AVG",     String(Math.round(tracker.averageFps  || tracker.measuredFps || 0))],
    ["1% LOW",  String(Math.round(tracker.low1Fps     || tracker.measuredFps || 0))],
    ["rAF fps", fmtFps(tracker.browserRafFps)],
    [null, null],
    ["mode",    modeLabel],
    ["target",  targetLabel],
    ["period",  fmtMs(tracker.periodMs)],
    ["work",    fmtMs(tracker.workMs)],
    ["wait",    fmtMs(tracker.waitMs)],
    [null, null],
    ["update",  fmtMs(tracker.updateMs)],
    ["world",   fmtMs(tracker.worldMs)],
    ["entity",  fmtMs(tracker.entityMs)],
    ["weather", fmtMs(tracker.weatherMs)],
    ["HUD",     fmtMs(tracker.hudMs)],
    ["minimap", fmtMs(tracker.minimapMs)],
    ["backend", backendLabel],
  ];

  const goldLabels = new Set(["mode", "target", "backend"]);
  rows.forEach(([label, value], index) => {
    const rowY = rowStartY + rowGap * index;
    if (label === null) {
      stroke(typeof MENU_GOLD_BORDER !== "undefined" ? MENU_GOLD_BORDER : "rgba(184,134,11,0.65)");
      strokeWeight(Math.max(1, Math.round(1 * uiScaleFactor)));
      line(x + padX, rowY, x + w - padX, rowY);
      noStroke();
      return;
    }
    fill(205, 205, 215);
    if (typeof gTextSize === "function") gTextSize(Math.round(12 * uiScaleFactor));
    else textSize(Math.round(12 * uiScaleFactor));
    textAlign(LEFT, CENTER);
    text(label, x + padX, rowY);
    fill(goldLabels.has(label) ? 255 : 245, goldLabels.has(label) ? 214 : 245, goldLabels.has(label) ? 120 : 245);
    textAlign(RIGHT, CENTER);
    text(value, valueX, rowY);
  });

  pop();
}
