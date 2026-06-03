// Shared constants used by both menu and game contexts.
// Loaded before all other src/ files in both HTML entry points.

const LEGACY_UNCAPPED_FPS = 999;
const UNLIMITED_FPS_TARGET = 0;
// p5's frameRate(0) HALTS the draw loop (target interval becomes Infinity), which
// freezes the canvas to black. To run "uncapped" we hand p5 a high finite target
// so it stops throttling while rAF/VSync still bound the real frame rate.
const INTERNAL_UNCAPPED_FRAME_RATE = 1000;
const SETTINGS_STORAGE_KEY = "game.settings";
const LEGACY_SETTINGS_STORAGE_KEY = "menuSettings";

const DEFAULT_SETTINGS = Object.freeze({
  masterVol: 0.8,
  musicVol: 0.6,
  sfxVol: 0.7,
  textSize: 75,
  uiScale: 75,
  difficulty: 'normal',
  fpsMode: '60',
  targetFps: 60,
  performanceOverlay: false,
  performanceOverlayEnabled: false,
});

const SETTINGS_CATEGORIES = Object.freeze([
  "Audio",
  "Gameplay",
  "Graphics",
  "Controls",
  "Accessibility",
  "Language"
]);

function normalizeUiScaleSetting(value, fallback = DEFAULT_SETTINGS.uiScale) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getUiScaleMultiplier(value, fallback = DEFAULT_SETTINGS.uiScale) {
  const normalized = normalizeUiScaleSetting(value, fallback);
  return Math.max(0.75, Math.min(1.35, normalized / DEFAULT_SETTINGS.uiScale));
}

function normalizeTargetFps(value, fallback = DEFAULT_SETTINGS.targetFps) {
  if (value === LEGACY_UNCAPPED_FPS) return UNLIMITED_FPS_TARGET;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return UNLIMITED_FPS_TARGET;
  return Math.max(1, Math.round(parsed));
}

function normalizeFpsMode(value, fallback = DEFAULT_SETTINGS.fpsMode) {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "unlimited" || normalized === "uncapped") return "unlimited";
    if (normalized === "60" || normalized === "120") return normalized;
  }

  const target = normalizeTargetFps(value, getFpsTargetForMode(fallback));
  if (isUnlimitedFpsTarget(target)) return "unlimited";
  return target <= 60 ? "60" : "120";
}

function getFpsTargetForMode(mode) {
  const normalized = normalizeFpsMode(mode, DEFAULT_SETTINGS.fpsMode);
  return normalized === "unlimited" ? UNLIMITED_FPS_TARGET : Number(normalized);
}

function isUnlimitedFpsTarget(value) {
  return normalizeTargetFps(value, UNLIMITED_FPS_TARGET) === UNLIMITED_FPS_TARGET;
}

function getTargetFpsLabel(value) {
  return getFpsModeLabel(normalizeFpsMode(value));
}

function getFpsModeLabel(value) {
  const normalized = normalizeFpsMode(value);
  return normalized === "unlimited" ? "Unlimited" : normalized;
}

function normalizePerformanceOverlaySetting(raw, fallback = DEFAULT_SETTINGS.performanceOverlayEnabled) {
  if (!raw || typeof raw !== "object") return fallback;
  if (typeof raw.performanceOverlay === "boolean") return raw.performanceOverlay;
  if (typeof raw.performanceOverlayEnabled === "boolean") return raw.performanceOverlayEnabled;
  if (typeof raw.showFps === "boolean") return raw.showFps;
  return fallback;
}
