// === Settings State Helpers ===
function normalizeDifficultyChoice(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_LABELS, normalized) ? normalized : null;
}

function getDifficultyLabel(value) {
  return DIFFICULTY_LABELS[value] || DIFFICULTY_LABELS.normal;
}

function trackMenuSettingsElement(el) {
  if (el) activeSettingElements.push(el);
  return el;
}

function getCurrentControl(action) {
  return userControls[action] || DEFAULT_CONTROLS[action];
}

function formatMenuKey(key) {
  return key === ' ' ? 'SPACE' : String(key || '').toUpperCase();
}

// === Settings Panel Builders ===
function addMenuSection(parent, title) {
  const section = createDiv('');
  section.parent(parent);
  section.class('gd-menu-settings-section');
  trackMenuSettingsElement(section);

  const heading = createDiv(title);
  heading.parent(section);
  heading.class('gd-menu-settings-section-title');
  return section;
}

function addMenuRow(section, labelText, helpText) {
  const row = createDiv('');
  row.parent(section);
  row.class('gd-menu-settings-row');
  if (helpText && row.elt) row.elt.title = helpText;
  trackMenuSettingsElement(row);

  const label = createDiv(labelText);
  label.parent(row);
  label.class('gd-menu-settings-label');

  const control = createDiv('');
  control.parent(row);
  control.class('gd-menu-settings-control');
  return { row, control };
}

function addMenuSelectRow(section, labelText, options, currentValue, onChange, helpText) {
  const { control } = addMenuRow(section, labelText, helpText);
  const select = createSelect();
  select.parent(control);
  select.class('gd-menu-select');
  options.forEach(option => select.option(option));
  if (currentValue) select.selected(currentValue);
  select.changed(() => {
    if (typeof onChange === 'function') onChange(select.value());
  });
  trackMenuSettingsElement(select);
  return select;
}

function addMenuToggleRow(section, labelText, currentValue, onChange, helpText) {
  const { control } = addMenuRow(section, labelText, helpText);
  const button = createButton('');
  button.parent(control);
  button.class('gd-menu-toggle');
  let enabled = !!currentValue;

  const update = () => {
    button.html(enabled ? 'ON' : 'OFF');
    if (button.elt) button.elt.dataset.enabled = enabled ? 'true' : 'false';
  };

  button.mousePressed(() => {
    enabled = !enabled;
    update();
    if (typeof onChange === 'function') onChange(enabled);
  });

  update();
  trackMenuSettingsElement(button);
  return button;
}

function addMenuSliderRow(section, labelText, min, max, currentValue, onChange, formatValue) {
  const { control } = addMenuRow(section, labelText);
  const wrap = createDiv('');
  wrap.parent(control);
  wrap.class('gd-menu-slider-wrap');

  const slider = createSlider(min, max, currentValue);
  slider.parent(wrap);
  slider.class('gd-menu-slider');

  const valueLabel = createDiv('');
  valueLabel.parent(wrap);
  valueLabel.class('gd-menu-slider-value');

  const format = typeof formatValue === 'function' ? formatValue : value => String(value);
  const update = () => {
    const value = Number(slider.value());
    valueLabel.html(format(value));
    if (typeof onChange === 'function') onChange(value);
  };

  valueLabel.html(format(Number(slider.value())));
  slider.input(update);
  trackMenuSettingsElement(wrap);
  trackMenuSettingsElement(slider);
  return slider;
}

function addMenuPresetRow(section, labelText, values, currentValue, onChange) {
  const { control } = addMenuRow(section, labelText);
  const group = createDiv('');
  group.parent(control);
  group.class('gd-menu-segmented');
  trackMenuSettingsElement(group);

  values.forEach(item => {
    const button = createButton(item.label);
    button.parent(group);
    button.class('gd-menu-segment');
    if (button.elt) {
      button.elt.dataset.settingValue = String(item.value);
      button.elt.dataset.active = item.value === currentValue ? 'true' : 'false';
    }

    button.mousePressed(() => {
      values.forEach(candidate => {
        const node = group.elt?.querySelector(`[data-setting-value="${candidate.value}"]`);
        if (node) node.dataset.active = candidate.value === item.value ? 'true' : 'false';
      });
      if (typeof onChange === 'function') onChange(item.value);
    });

    trackMenuSettingsElement(button);
  });
}

function addMenuControlRow(section, labelText, action) {
  const current = getCurrentControl(action);
  const { control } = addMenuRow(section, labelText);
  const button = createButton(formatMenuKey(current.key));
  button.parent(control);
  button.class('gd-menu-key-button');

  button.mousePressed(() => {
    const previous = button.html();
    button.html('PRESS KEY');

    const keyHandler = event => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        button.html(previous);
        window.removeEventListener('keydown', keyHandler, true);
        return;
      }

      const keyName = event.key.toUpperCase();
      userControls[action] = { key: keyName, code: event.keyCode };
      button.html(formatMenuKey(keyName));
      saveAllSettings();
      window.removeEventListener('keydown', keyHandler, true);
    };

    window.addEventListener('keydown', keyHandler, true);
  });

  trackMenuSettingsElement(button);
}

function buildDisplaySettings(section) {
  addMenuSelectRow(
    section,
    'FPS Mode',
    ['60', '120', 'Unlimited'],
    getFpsModeLabel(normalizeFpsMode(targetFps)),
    value => {
      targetFps = getFpsTargetForMode(value);
      saveAllSettings();
      if (typeof applyFPS === 'function') applyFPS();
    },
    'Unlimited removes the game-side FPS cap; browser requestAnimationFrame and VSync can still run near display refresh rate.'
  );
  addMenuToggleRow(section, 'Performance Overlay', performanceOverlayEnabled, value => {
    performanceOverlayEnabled = value;
    saveAllSettings();
  });
  addMenuToggleRow(section, 'Show Stars', showStars, value => { showStars = value; saveAllSettings(); });
  addMenuToggleRow(section, 'Screen Shake', screenShakeEnabled, value => { screenShakeEnabled = value; saveAllSettings(); });
  addMenuToggleRow(section, 'Ambient Particles', showParticles, value => { showParticles = value; saveAllSettings(); });
  addMenuToggleRow(section, 'Firefly Lighting', showFireflyLighting, value => { showFireflyLighting = value; saveAllSettings(); });
}

function buildGameplaySettings(section) {
  addMenuToggleRow(section, 'Show Tutorials', showTutorials, value => { showTutorials = value; saveAllSettings(); });
  addMenuToggleRow(section, 'Show HUD', showHUD, value => { showHUD = value; saveAllSettings(); });
  addMenuSelectRow(section, 'Difficulty', ['Easy', 'Normal', 'Hard'], getDifficultyLabel(difficultySetting), value => {
    difficultySetting = value.toLowerCase();
    saveAllSettings();
  });
  addMenuSliderRow(section, 'Sensitivity', 1, 10, sensitivitySetting, value => {
    sensitivitySetting = value;
    saveAllSettings();
  }, value => String(value));
  addMenuToggleRow(section, 'Invert Y Axis', invertYAxis, value => { invertYAxis = value; saveAllSettings(); });
}

function buildAudioSettings(section) {
  const masterSlider = addMenuSliderRow(section, 'Master Volume', 0, 100, Math.round(masterVol * 100), value => {
    masterVol = value / 100;
    if (typeof applyVolumes === 'function') applyVolumes();
    saveAllSettings();
  }, value => `${value}%`);
  if (masterSlider.elt) masterSlider.elt.setAttribute('data-setting', 'masterVol');

  const musicSlider = addMenuSliderRow(section, 'Music Volume', 0, 100, Math.round(musicVol * 100), value => {
    musicVol = value / 100;
    if (typeof applyVolumes === 'function') applyVolumes();
    saveAllSettings();
  }, value => `${value}%`);
  if (musicSlider.elt) musicSlider.elt.setAttribute('data-setting', 'musicVol');

  const sfxSlider = addMenuSliderRow(section, 'SFX Volume', 0, 100, Math.round(sfxVol * 100), value => {
    sfxVol = value / 100;
    saveAllSettings();
  }, value => `${value}%`);
  if (sfxSlider.elt) sfxSlider.elt.setAttribute('data-setting', 'sfxVol');
}

function buildAccessibilitySettings(section) {
  addMenuPresetRow(section, 'UI Scale', [
    { label: 'Compact', value: 60 },
    { label: 'Default', value: 75 },
    { label: 'Large', value: 90 },
  ], textSizeSetting, value => {
    textSizeSetting = value;
    applyCurrentTextSize();
    saveAllSettings();
  });
  addMenuSelectRow(section, 'Color Mode', ['None', 'Protanopia', 'Deuteranopia', 'Tritanopia', 'Grayscale', 'Sepia', 'Invert', 'High Contrast'], colorModeSetting, value => {
    colorModeSetting = value;
    applyColorMode(colorModeSetting);
    saveAllSettings();
  });
  addMenuSelectRow(section, 'Language', ['English', 'Spanish', 'French', 'German'], languageSetting, value => {
    languageSetting = value;
    saveAllSettings();
  });
}

function buildControlsSettings(section) {
  addMenuControlRow(section, 'Move Up', 'UP');
  addMenuControlRow(section, 'Move Down', 'DOWN');
  addMenuControlRow(section, 'Move Left', 'LEFT');
  addMenuControlRow(section, 'Move Right', 'RIGHT');
  addMenuControlRow(section, 'Jump', 'JUMP');
  addMenuControlRow(section, 'Dash', 'DASH');
  addMenuControlRow(section, 'Attack', 'ATTACK');
}

function showSettingsMenu() {
  hideCategoryButtons();
  hideBottomButtons();
  clearSubSettings();
  ensureSettingsMenuRoot();
  if (!settingsMenuContent) return;
  settingsMenuContent.html('');

  const overlay = createDiv('');
  overlay.parent(settingsMenuContent);
  overlay.class('gd-menu-settings-overlay');
  trackMenuSettingsElement(overlay);

  const panel = createDiv('');
  panel.parent(overlay);
  panel.class('gd-menu-settings-panel');

  const title = createDiv('SETTINGS');
  title.parent(panel);
  title.class('gd-menu-settings-title');

  const body = createDiv('');
  body.parent(panel);
  body.class('gd-menu-settings-body');

  buildDisplaySettings(addMenuSection(body, 'DISPLAY'));
  buildGameplaySettings(addMenuSection(body, 'GAMEPLAY'));
  buildAudioSettings(addMenuSection(body, 'AUDIO'));
  buildAccessibilitySettings(addMenuSection(body, 'ACCESSIBILITY'));
  buildControlsSettings(addMenuSection(body, 'CONTROLS'));

  const footer = createDiv('');
  footer.parent(panel);
  footer.class('gd-menu-settings-footer');

  const resetButton = createButton('RESET SETTINGS');
  resetButton.parent(footer);
  resetButton.class('gd-menu-panel-button gd-menu-panel-button-secondary');
  resetButton.mousePressed(() => {
    resetDefaults();
    showSettingsMenu();
  });

  const closeButton = createButton('CLOSE');
  closeButton.parent(footer);
  closeButton.class('gd-menu-panel-button');
  closeButton.mousePressed(() => {
    playClickSFX();
    showingSettings = false;
    hideSettingsMenu();
    showMainMenu();
  });

  try { applyCurrentTextSize(); } catch (e) {}
}

function showSubSettings(label) {
  activeCategory = label;
  showSettingsMenu();
}

// === Settings Teardown / Visibility ===
function clearSubSettings() {
  activeSettingElements.forEach(element => {
    unwatchZoomNeutralElement(element);
    if (element && element.elt && element.elt.tagName === 'INPUT' && element.elt.type === 'range') {
      unregisterZoomAwareSlider(element);
    }
    if (element && typeof element.remove === 'function') element.remove();
  });
  activeSettingElements = [];
}

function hideCategoryButtons() {
  categoryBackgrounds.forEach(element => element && element.remove());
  categoryButtons.forEach(element => element && element.remove());
  categoryBackgrounds = [];
  categoryButtons = [];
}

function hideBottomButtons() {
  [saveBackground, btnSave, backMenuBackground, btnBackMenu].forEach(element => element && element.remove());
  saveBackground = null;
  btnSave = null;
  backMenuBackground = null;
  btnBackMenu = null;
}

function hideMainMenu() {
  [playButtonBackground, btnPlay, settingsButtonBackground, btnSettings, exitButtonBackground, btnExit]
    .forEach(element => element && element.hide());
}

function showMainMenu() {
  if (!btnPlay || !btnSettings || !btnExit) {
    createMainMenu();
    return;
  }
  [playButtonBackground, btnPlay, settingsButtonBackground, btnSettings, exitButtonBackground, btnExit]
    .forEach(element => element && element.show());
}

function hideSettingsMenu() {
  clearSubSettings();
  hideCategoryButtons();
  hideBottomButtons();
  releaseSettingsMenuRoot();
}

// === Accessibility / Text ===
function applyColorMode(mode) {
  if (!document.getElementById('menu-cb-filters')) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'menu-cb-filters';
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none');
    svg.innerHTML = `<defs>
      <filter id="menu-cb-protanopia">
        <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/>
      </filter>
      <filter id="menu-cb-deuteranopia">
        <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/>
      </filter>
      <filter id="menu-cb-tritanopia">
        <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/>
      </filter>
    </defs>`;
    document.body.appendChild(svg);
  }

  const filterMap = {
    Protanopia: 'url(#menu-cb-protanopia)',
    Deuteranopia: 'url(#menu-cb-deuteranopia)',
    Tritanopia: 'url(#menu-cb-tritanopia)',
    Grayscale: 'grayscale(100%)',
    Sepia: 'sepia(80%)',
    Invert: 'invert(100%) hue-rotate(180deg)',
    'High Contrast': 'contrast(150%) saturate(120%)',
  };
  const filter = filterMap[mode] || '';
  const canvas = document.querySelector('canvas');
  if (canvas) canvas.style.filter = filter;
  if (document.body) document.body.style.filter = filter;
}

function adjustTextSize(sizeValue) {
  const normalized = normalizeUiScaleSetting(sizeValue, DEFAULT_SETTINGS.uiScale);
  const menuTextScale = normalized / DEFAULT_SETTINGS.uiScale;
  baseFontPx = menuTextScale * 0.04 * height;
  smallFontPx = menuTextScale * 0.03 * height;
  labelFontPx = menuTextScale * 0.035 * height;
  headingFontPx = baseFontPx * 1.25;

  const applyFont = (element, sizePx) => {
    if (element) element.style('font-size', `${sizePx}px`);
  };

  [btnPlay, btnSettings, btnExit].forEach(button => applyFont(button, baseFontPx));
  [btnSave, btnBackMenu].forEach(button => applyFont(button, smallFontPx));

  try {
    const root = settingsMenuContent?.elt || document.body;
    const scaleClass = normalized <= 60 ? 'compact' : normalized >= 90 ? 'large' : 'default';
    const overlay = root.querySelector?.('.gd-menu-settings-overlay');
    if (overlay) overlay.dataset.uiScale = scaleClass;
    const bodyEl = root.querySelector?.('.gd-menu-settings-body');
    if (bodyEl) bodyEl.scrollTop = 0;
  } catch (e) {}

  if (typeof window.textSize === 'function') window.textSize(headingFontPx);
}

function applyCurrentTextSize() {
  textSizeSetting = normalizeUiScaleSetting(textSizeSetting, DEFAULT_SETTINGS.uiScale);
  adjustTextSize(textSizeSetting);
  updateTextSizeButtonStyles();
}

function saveAccessibilitySettings() {
  playClickSFX();
  applyCurrentTextSize();
  saveAllSettings();
}
