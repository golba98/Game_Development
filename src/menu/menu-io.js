// === Persistence / Settings Storage ===
let lastSavedSettingsJson = null;

function saveSettings() {
  playClickSFX();
  saveAllSettings();
  try {
    const iframe = document.getElementById('game-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        typeof getGameSettingsMessage === 'function'
          ? getGameSettingsMessage()
          : { type: 'update-audio-settings', masterVol, musicVol, sfxVol, difficulty: difficultySetting },
        '*',
      );
      console.log('[saveSettings] forwarded audio settings to game iframe');
    }
  } catch (e) { console.warn('[saveSettings] failed to post audio settings to iframe', e); }
  alert("💾 Settings saved and stored locally!");
}

function resetDefaults() {
  playClickSFX();
  clearSavedSettings();
  masterVol = DEFAULT_SETTINGS.masterVol;
  musicVol = DEFAULT_SETTINGS.musicVol;
  sfxVol = DEFAULT_SETTINGS.sfxVol;
  textSizeSetting = DEFAULT_SETTINGS.uiScale;
  difficultySetting = DEFAULT_SETTINGS.difficulty;
  sensitivitySetting = 5;
  invertYAxis = false;
  showTutorials = true;
  showHUD = true;
  languageSetting = 'English';
  colorModeSetting = 'None';
  performanceOverlayEnabled = DEFAULT_SETTINGS.performanceOverlayEnabled;
  showStars = true;
  screenShakeEnabled = true;
  showParticles = true;
  showFireflyLighting = true;
  targetFps = getFpsTargetForMode(DEFAULT_SETTINGS.fpsMode);
  userControls = JSON.parse(JSON.stringify(DEFAULT_CONTROLS));
  applyVolumes();
  applyCurrentTextSize();
  syncSlidersToSettings();
  if (typeof applyFPS === 'function') applyFPS();
  if (typeof applyColorMode === 'function') applyColorMode(colorModeSetting);
  alert("↺ Settings reset to default (and saved).");
  saveAllSettings();
}

function saveAllSettings() {
  const fpsMode = normalizeFpsMode(targetFps, DEFAULT_SETTINGS.fpsMode);
  const settings = {
    masterVol, musicVol, sfxVol,
    textSizeSetting,
    uiScale: textSizeSetting,
    difficulty: difficultySetting,
    sensitivitySetting, invertYAxis, showTutorials, showHUD,
    languageSetting, colorModeSetting, userControls,
    fpsMode,
    performanceOverlay: performanceOverlayEnabled,
    showStars,
    screenShakeEnabled,
    showParticles,
    showFireflyLighting,
    v: 1, // settings version
  };
  const settingsJson = JSON.stringify(settings);
  if (settingsJson === lastSavedSettingsJson) {
    return; // No changes, skip write/log
  }
  lastSavedSettingsJson = settingsJson;
  localStorage.setItem(SETTINGS_STORAGE_KEY, settingsJson);
  console.log("Saved Settings:", settings);
}

function loadAllSettings() {
  const saved = localStorage.getItem(SETTINGS_STORAGE_KEY) || localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
  if (saved) {
    let s = null;
    try {
      s = JSON.parse(saved);
    } catch (e) {
      console.warn("Saved settings were invalid. Resetting to defaults.", e);
      clearSavedSettings();
      applyCurrentTextSize();
      return;
    }
    if (!s || typeof s !== "object") {
      clearSavedSettings();
      applyCurrentTextSize();
      return;
    }

    // Migration: Migrate implicit bug-induced "unlimited" defaults to stable 60 FPS
    if (!s.v) {
      if (s.fpsMode === "unlimited" || s.targetFps === 0) {
        s.fpsMode = "60";
        s.targetFps = 60;
      }
      s.v = 1;
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s));
      } catch (e) {}
    }

    lastSavedSettingsJson = JSON.stringify(s);

    masterVol = s.masterVol ?? masterVol;
    musicVol = s.musicVol ?? musicVol;
    sfxVol = s.sfxVol ?? sfxVol;
    textSizeSetting = normalizeUiScaleSetting(
      s.uiScale ?? s.textSizeSetting,
      textSizeSetting,
    );

    sensitivitySetting = s.sensitivitySetting ?? sensitivitySetting;
    invertYAxis = s.invertYAxis ?? invertYAxis;
    showTutorials = s.showTutorials ?? showTutorials;
    showHUD = s.showHUD ?? showHUD;
    languageSetting = s.languageSetting ?? languageSetting;
    colorModeSetting = s.colorModeSetting ?? colorModeSetting;
    performanceOverlayEnabled = normalizePerformanceOverlaySetting(s, performanceOverlayEnabled);
    showStars = s.showStars ?? showStars;
    screenShakeEnabled = s.screenShakeEnabled ?? screenShakeEnabled;
    showParticles = s.showParticles ?? showParticles;
    showFireflyLighting = s.showFireflyLighting ?? showFireflyLighting;
    targetFps = getFpsTargetForMode(normalizeFpsMode(s.fpsMode ?? s.targetFps, normalizeFpsMode(targetFps)));
    if (s.userControls) userControls = s.userControls;

    const storedDifficulty = normalizeDifficultyChoice(s.difficulty);
    if (storedDifficulty) difficultySetting = storedDifficulty;
    applyVolumes();
    applyCurrentTextSize();
    if (typeof applyFPS === 'function') applyFPS();
    syncSlidersToSettings();
    if (typeof applyColorMode === 'function') applyColorMode(colorModeSetting);
    console.log("Loaded Settings:", s);
  } else {
    console.log("No saved settings found. Using defaults.");
    applyCurrentTextSize();
  }
}

function clearSavedSettings() {
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  localStorage.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
  console.log("Cleared saved settings.");
}
