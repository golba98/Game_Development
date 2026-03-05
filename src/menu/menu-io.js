// === Persistence / Settings Storage ===
function saveSettings() {
  playClickSFX();
  saveAllSettings();
  try {
    const iframe = document.getElementById('game-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'update-audio-settings',
        masterVol, musicVol, sfxVol,
        difficulty: difficultySetting
      }, '*');
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
  textSizeSetting = DEFAULT_SETTINGS.textSize;
  difficultySetting = DEFAULT_SETTINGS.difficulty;
  applyVolumes();
  applyCurrentTextSize();
  syncSlidersToSettings();
  alert("↺ Settings reset to default (and saved).");
  saveAllSettings();
}

function saveAllSettings() {
  const settings = {
    masterVol, musicVol, sfxVol, textSizeSetting, difficulty: difficultySetting,
    sensitivitySetting, invertYAxis, showTutorials, showHUD,
    languageSetting, colorModeSetting, userControls
  };
  localStorage.setItem("menuSettings", JSON.stringify(settings));
  console.log("💾 Saved Settings:", settings);
}

function loadAllSettings() {
  const saved = localStorage.getItem("menuSettings");
  if (saved) {
    const s = JSON.parse(saved);
    masterVol = s.masterVol ?? masterVol;
    musicVol = s.musicVol ?? musicVol;
    sfxVol = s.sfxVol ?? sfxVol;
    textSizeSetting = s.textSizeSetting ?? textSizeSetting;

    sensitivitySetting = s.sensitivitySetting ?? sensitivitySetting;
    invertYAxis = s.invertYAxis ?? invertYAxis;
    showTutorials = s.showTutorials ?? showTutorials;
    showHUD = s.showHUD ?? showHUD;
    languageSetting = s.languageSetting ?? languageSetting;
    colorModeSetting = s.colorModeSetting ?? colorModeSetting;
    if (s.userControls) userControls = s.userControls;

    const storedDifficulty = normalizeDifficultyChoice(s.difficulty);
    if (storedDifficulty) difficultySetting = storedDifficulty;
    applyVolumes();
    applyCurrentTextSize();
    syncSlidersToSettings();
    console.log("✅ Loaded Settings:", s);
  } else {
    console.log("⚙️ No saved settings found. Using defaults.");
    applyCurrentTextSize();
  }
}

function clearSavedSettings() {
  localStorage.removeItem("menuSettings");
  console.log("🗑️ Cleared saved settings.");
}
