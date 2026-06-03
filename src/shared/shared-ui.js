// Shared UI helpers for menu/game HUD surfaces.

function createPerformanceTracker(maxSamples = 120) {
  return {
    maxSamples: Math.max(10, maxSamples | 0),
    samples: [],
    measuredFps: 0,
    averageFps: 0,
    low1Fps: 0,
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

function getPerformanceOverlaySize(uiScaleFactor = 1) {
  const safeUiScaleFactor = Math.max(0.85, Math.min(1.4, Number(uiScaleFactor) || 1));
  return {
    width: Math.round(188 * safeUiScaleFactor),
    height: Math.round(104 * safeUiScaleFactor),
    uiScaleFactor: safeUiScaleFactor,
  };
}

function drawPerformanceOverlayPanel(opts = {}) {
  const tracker = opts.tracker;
  if (!tracker) return;

  const size = getPerformanceOverlaySize(opts.uiScaleFactor || 1);
  const x = Math.round(Number(opts.x) || 0);
  const y = Math.round(Number(opts.y) || 0);
  const w = size.width;
  const h = size.height;
  const uiScaleFactor = size.uiScaleFactor;
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

  const modeLabel = opts.modeLabel || getFpsModeLabel(normalizeFpsMode(opts.fpsMode ?? opts.targetFps));
  const rows = [
    ["FPS", String(Math.round(tracker.measuredFps || 0))],
    ["AVG", String(Math.round(tracker.averageFps || tracker.measuredFps || 0))],
    ["1% LOW", String(Math.round(tracker.low1Fps || tracker.measuredFps || 0))],
    ["Mode", modeLabel],
  ];

  rows.forEach(([label, value], index) => {
    const rowY = rowStartY + rowGap * index;
    fill(205, 205, 215);
    if (typeof gTextSize === "function") gTextSize(Math.round(12 * uiScaleFactor));
    else textSize(Math.round(12 * uiScaleFactor));
    textAlign(LEFT, CENTER);
    text(label, x + padX, rowY);
    fill(label === "Mode" ? 255 : 245, label === "Mode" ? 214 : 245, label === "Mode" ? 120 : 245);
    textAlign(RIGHT, CENTER);
    text(value, valueX, rowY);
  });

  pop();
}
