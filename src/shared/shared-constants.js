// Shared constants used by both menu and game contexts.
// Loaded before all other src/ files in both HTML entry points.

const DEFAULT_SETTINGS = Object.freeze({
  masterVol: 0.8,
  musicVol: 0.6,
  sfxVol: 0.7,
  textSize: 75,
  difficulty: 'normal'
});

const SETTINGS_CATEGORIES = Object.freeze([
  "Audio",
  "Gameplay",
  "Graphics",
  "Controls",
  "Accessibility",
  "Language"
]);
