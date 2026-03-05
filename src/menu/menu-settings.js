// === Utilities / Misc ===
function normalizeDifficultyChoice(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_LABELS, normalized) ? normalized : null;
}

function getDifficultyLabel(value) {
  return DIFFICULTY_LABELS[value] || DIFFICULTY_LABELS.normal;
}

// === Settings UI / Builders ===
function showSettingsMenu() {
  clearSubSettings();
  ensureSettingsMenuRoot();

  const cx = width / 2;
  const cy = height / 2;
  const panelW = 0.7 * width;
  const panelH = 0.7 * height;

  const panelLeft = cx - panelW / 2;
  const leftPanelX = panelLeft + panelW * 0.04;
  const categoryButtonWidth = Math.min(panelW * 0.33, width * 0.35);
  const categoryButtonHeight = panelH * 0.09;
  const categorySpacing = categoryButtonHeight + panelH * 0.03;
  const yOffset = -panelH * 0.08;
  const totalH = (SETTINGS_CATEGORIES.length - 1) * categorySpacing;
  const yStart = cy - totalH / 2 + yOffset;

  categoryBackgrounds = [];
  categoryButtons = [];

  SETTINGS_CATEGORIES.forEach((label, index) => {
    const yPos = yStart + index * categorySpacing;
    const bg = createBgImg("assets/3-GUI/Button_BG.png", leftPanelX, yPos, categoryButtonWidth, categoryButtonHeight);
    categoryBackgrounds.push(bg);
    const btn = makeBtn(label, leftPanelX, yPos, categoryButtonWidth, categoryButtonHeight, () => {
      playClickSFX();
      hideCategoryButtons();
      hideBottomButtons();
      activeCategory = label;
      showSubSettings(label);
    });
    categoryButtons.push(btn);
  });

  const secondaryButtonHeight = categoryButtonHeight * 0.75;
  const baseBottom = cy + panelH / 2 - secondaryButtonHeight - Math.round(panelH * 0.05);
  const leftThird = width / 3;
  const rightThird = (width / 3) * 2;

  const bottomButtonW = Math.max(categoryButtonWidth * 0.9, panelW * 0.18);
  const saveX = leftThird - bottomButtonW / 2;
  const backX = rightThird - bottomButtonW / 2;

  saveBackground = createBgImg("assets/3-GUI/Button_BG.png", saveX, baseBottom, bottomButtonW, secondaryButtonHeight);
  btnSave = makeSmallBtn("💾 Save", saveX, baseBottom, bottomButtonW, secondaryButtonHeight, saveSettings);

  backMenuBackground = createBgImg("assets/3-GUI/Button_BG.png", backX, baseBottom, bottomButtonW, secondaryButtonHeight);
  btnBackMenu = makeSmallBtn("↩ Back to Menu", backX, baseBottom, bottomButtonW, secondaryButtonHeight, () => {
      playClickSFX();
      showingSettings = false;
      clearSubSettings();
      hideSettingsMenu();
      showMainMenu();
  });

  try {
    if (btnBackMenu && btnBackMenu.elt) {
      btnBackMenu.elt.style.whiteSpace = 'nowrap';
    }
    if (btnSave && btnSave.elt) {
      btnSave.elt.style.whiteSpace = 'nowrap';
    }
  } catch (e) {}

  applyCurrentTextSize();
}

function hideCategoryButtons() {
  categoryBackgrounds.forEach(e => e && e.hide());
  categoryButtons.forEach(e => e && e.hide());
}

function hideBottomButtons() {
  [saveBackground, btnSave, backMenuBackground, btnBackMenu].forEach(e => e && e.hide());
}

function showSubSettings(label) {
  clearSubSettings();

  const cx = width / 2;
  const cy = height / 2;

  // Use a larger panel for Controls if needed
  let panelW = 0.7 * width;
  let panelH = 0.7 * height;
  if (label === 'Controls') {
    panelW = 0.8 * width;
    panelH = 0.85 * height;
  }

  const panelLeft = cx - panelW / 2;
  const panelTop = cy - panelH / 2;

  // FIXED LAYOUT CONSTANTS
  const labelWidth = panelW * 0.35;
  const labelX = panelLeft + panelW * 0.05;
  const controlX = panelLeft + panelW * 0.42;
  const controlWidth = panelW * 0.5;

  // Adjusted spacing to be more consistent
  let spacingY = Math.round(panelH * 0.12);
  let startY = panelTop + panelH * 0.18;

  // Reduce spacing if there are many controls
  if (label === 'Controls') {
    spacingY = Math.round(panelH * 0.08);
    startY = panelTop + panelH * 0.12;
  }

  const ctx = createSettingsContext({
    labelX,
    labelWidth,
    controlX,
    controlWidth,
    panelH,
    startY,
    spacingY
  });

  const builder = CATEGORY_BUILDERS[label];
  if (builder) {
    builder(ctx);
  }

  const backY = panelTop + panelH - panelH * 0.12;
  const backWidth = Math.min(panelW * 0.3, 200);
  const backHeight = panelH * 0.08;
  const backBG = createBgImg("assets/3-GUI/Button_BG.png", cx - backWidth / 2, backY, backWidth, backHeight, '20005');
  const backBtn = makeSmallBtn("← Back", cx - backWidth / 2, backY, backWidth, backHeight, () => {
    playClickSFX();
    clearSubSettings();
    showSettingsMenu();
  });
  backBtn.style('z-index', '20006');

  activeSettingElements.push(backBG, backBtn);
  applyCurrentTextSize();
}

// === Settings Context / Row Builders ===
function createSettingsContext(layout) {
  const domParent = settingsMenuContent || getMenuDomParent();
  return {
    layout: layout,
    y: layout.startY,

    pushElement(el) { activeSettingElements.push(el); },

    addSliderRow(labelText, min, max, currentVal, onChange, opts) {
      // Align label vertically with slider
      this.pushElement(createSettingLabel(labelText, this.layout.labelX, this.y + 2, this.layout.labelWidth, domParent));

      const slider = createSlider(min, max, currentVal);
      slider.parent(domParent);

      slider.position(this.layout.controlX, this.y);
      const sliderW = Math.round(this.layout.controlWidth * 0.9);
      slider.style('width', sliderW + 'px');
      slider.style('height', '30px');
      slider.style('z-index', '20000');
      registerZoomAwareSlider(slider, sliderW, 30);

      if (opts && opts.isAudio) {
        const settingKey = labelText.toLowerCase().includes("master") ? "masterVol"
                      : labelText.toLowerCase().includes("music")  ? "musicVol"
                      : "sfxVol";
      slider.attribute('data-setting', settingKey);
      }
      slider.input(() => onChange(slider.value()));
      this.pushElement(slider);

      this.y += this.layout.spacingY;
      return this;
    },

    addCheckboxRow(labelText, isChecked, onChange) {
      // Align label vertically with checkbox
      this.pushElement(createSettingLabel(labelText, this.layout.labelX, this.y + 5, this.layout.labelWidth, domParent));

      const chk = createCheckbox('', !!isChecked);
      chk.parent(domParent);

      chk.position(this.layout.controlX, this.y);
      chk.style('z-index', '20000');
      watchZoomNeutralElement(chk);

      if(chk.elt) chk.elt.classList.add('setting-checkbox');

      if (onChange) chk.changed(() => onChange(chk.checked()));
      this.pushElement(chk);

      this.y += this.layout.spacingY;
      return this;
    },

    addSelectRow(labelText, options, config) {
      // Align label vertically with select
      this.pushElement(createSettingLabel(labelText, this.layout.labelX, this.y + 8, this.layout.labelWidth, domParent));

      const sel = createSelect();
      sel.parent(domParent);
      const selectW = Math.min(this.layout.controlWidth * 0.8, 300);
      const selectH = 40;
      sel.position(this.layout.controlX, this.y);
      sel.size(selectW, selectH);
      sel.style('font-size', '18px');
      sel.style('font-family', "'MyFont', sans-serif");
      sel.style('z-index', '20000');
      sel.style('background', '#222');
      sel.style('color', 'white');
      sel.style('border', '2px solid #ffcc00');
      sel.style('border-radius', '5px');
      sel.style('padding', '5px 10px');
      watchZoomNeutralElement(sel);

      options.forEach(opt => sel.option(opt));

      let initialVal = null;
      let changeHandler = null;
      if (typeof config === 'object') {
        if (config.value) initialVal = config.value;
        if (config.onChange) changeHandler = config.onChange;
      } else if (typeof config === 'function') changeHandler = config;

      if (initialVal) sel.selected(initialVal);
      if (changeHandler) sel.changed(() => changeHandler(sel.value()));

      this.pushElement(sel);

      this.y += this.layout.spacingY;
      return this;
    },

    addControlRow(labelText, currentKey, onRebind) {
      this.pushElement(createSettingLabel(labelText, this.layout.labelX, this.y + 5, this.layout.labelWidth, domParent));

      const btn = createButton(currentKey);
      btn.parent(domParent);
      btn.position(this.layout.controlX, this.y);
      btn.size(this.layout.controlWidth * 0.6, 40);
      styleSmallButton(btn);
      btn.style('background', '#333');
      btn.style('border', '2px solid #555');
      btn.style('border-radius', '8px');
      btn.style('z-index', '20000');
      watchZoomNeutralElement(btn);

      btn.mousePressed(() => {
        const previousLabel = btn.html();
        btn.html('...');
        btn.style('background', '#884400');

        const keyHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (e.key === 'Escape') {
            btn.html(previousLabel);
            btn.style('background', '#333');
            window.removeEventListener('keydown', keyHandler, true);
            return;
          }

          const newKey = e.key.toUpperCase();
          const newKeyCode = e.keyCode;
          onRebind(newKey, newKeyCode);
          btn.html(newKey === ' ' ? 'SPACE' : newKey);
          btn.style('background', '#333');
          window.removeEventListener('keydown', keyHandler, true);
        };
        window.addEventListener('keydown', keyHandler, true);
      });

      this.pushElement(btn);
      this.y += this.layout.spacingY;
      return this;
    }
  };
}



// === Settings Builders Mapping ===
const CATEGORY_BUILDERS = {
  Audio: buildAudioSettings,
  Gameplay: buildGameplaySettings,
  Controls: buildControlsSettings,
  Accessibility: buildAccessibilitySettings,
  Language: buildLanguageSettings
};

function buildAudioSettings(ctx) {
  ctx
    .addSliderRow("Master Volume", 0, 100, masterVol * 100, v => {
        masterVol = v / 100;
        if(typeof applyVolumes === 'function') applyVolumes();
        if(gameMusic) gameMusic.setVolume(musicVol * masterVol);
    }, { isAudio: true })
    .addSliderRow("Music Volume", 0, 100, musicVol * 100, v => {
        musicVol = v / 100;
        if(typeof applyVolumes === 'function') applyVolumes();
        if(gameMusic) gameMusic.setVolume(musicVol * masterVol);
    }, { isAudio: true })
    .addSliderRow("SFX Volume", 0, 100, sfxVol * 100, v => {
        sfxVol = v / 100;
    }, { isAudio: true });
}

function buildGameplaySettings(ctx) {
  ctx
    .addCheckboxRow("Show Tutorials", showTutorials, v => {
        showTutorials = v;
        saveAllSettings();
    })
    .addCheckboxRow("Enable HUD", showHUD, v => {
        showHUD = v;
        saveAllSettings();
    })
    .addSelectRow("Difficulty", ["Easy", "Normal", "Hard"], {
      value: (difficultySetting.charAt(0).toUpperCase() + difficultySetting.slice(1)),
      onChange: (val) => {
        const normalized = val.toLowerCase();
        difficultySetting = normalized;
        saveAllSettings();
      }
    });
}

function buildControlsSettings(ctx) {
  ctx.addSliderRow("Sensitivity", 1, 10, sensitivitySetting, v => {
        sensitivitySetting = v;
        saveAllSettings();
     })
     .addCheckboxRow("Invert Y Axis", invertYAxis, v => {
        invertYAxis = v;
        saveAllSettings();
     });

  ctx.y += 20; // Gap

  // Helper: adds a rebindable control row for the given action key
  const ctrlRow = (label, action) => {
    const displayKey = userControls[action].key === ' ' ? 'SPACE' : userControls[action].key;
    ctx.addControlRow(label, displayKey, (k, c) => {
      userControls[action] = { key: k, code: c };
      saveAllSettings();
    });
  };

  // Movement
  ctrlRow("Move Up",    'UP');
  ctrlRow("Move Down",  'DOWN');
  ctrlRow("Move Left",  'LEFT');
  ctrlRow("Move Right", 'RIGHT');

  // Actions
  ctrlRow("Jump",   'JUMP');
  ctrlRow("Dash",   'DASH');
  ctrlRow("Attack", 'ATTACK');
}

function buildAccessibilitySettings(ctx) {
  ctx.addSelectRow("Color Mode", ["None", "Protanopia", "Deuteranopia", "Tritanopia"], {
      value: colorModeSetting,
      onChange: (v) => {
          colorModeSetting = v;
          saveAllSettings();
      }
  });

  const { labelX, controlX, controlWidth, panelH, spacingY } = ctx.layout;

  const lbl = createDiv("Text Size");
  lbl.parent(getMenuDomParent());
  lbl.class('setting-label');
  const labelWidth = Math.max(120, controlX - labelX - 20);
  lbl.position(labelX, ctx.y + TEXTSIZE_BUTTON_Y_OFFSET);
  lbl.style('width', labelWidth + 'px');
  lbl.style('text-align', 'right');
  lbl.style('color', 'white');
  lbl.style('font-size', (0.035 * height) + 'px');
  lbl.style('z-index', '20005');
  lbl.style('pointer-events', 'none');
  ctx.pushElement(lbl);

  const sizes = [
    { label: "Small", val: 50 },
    { label: "Default", val: 75 },
    { label: "Big", val: 100 }
  ];

  const gap = Math.max(10, Math.round(panelH * 0.02));
  const btnW = (controlWidth - (gap * (sizes.length - 1))) / sizes.length;
  const btnH = Math.max(48, Math.round(panelH * 0.12));
  let currX = controlX;
  sizes.forEach(item => {
      const btn = createButton(item.label);
      btn.parent(getMenuDomParent());
      btn.position(currX, ctx.y + TEXTSIZE_BUTTON_Y_OFFSET);
      btn.size(btnW, btnH);

      styleButton(btn);
      btn.style('background', '#333');
      btn.style('border', '4px solid #555');
      btn.style('border-radius', '15px');
      btn.style('font-size', Math.max(16, Math.round(btnH * 0.35)) + 'px');
      btn.style('font-weight', 'bold');
      btn.style('z-index', '20005');

      btn.attribute('data-text-size-val', item.val);

      btn.mousePressed(() => {
        playClickSFX();
        textSizeSetting = item.val;
        applyCurrentTextSize();
        saveAllSettings();
      });

      ctx.pushElement(btn);
      currX += btnW + gap;
  });

  setTimeout(updateTextSizeButtonStyles, 50);
  ctx.y += spacingY + btnH * 0.6;
}

function buildLanguageSettings(ctx) {
  ctx.addSelectRow("Language", ["English", "Spanish", "French", "German"], {
      value: languageSetting,
      onChange: (v) => {
          languageSetting = v;
          saveAllSettings();
      }
  });
}

// === Settings Cleanup ===
function clearSubSettings() {
  activeSettingElements.forEach(e => {
    unwatchZoomNeutralElement(e);
    if (e && e.elt && e.elt.tagName === 'INPUT' && e.elt.type === 'range') {
      unregisterZoomAwareSlider(e);
    }
    e && e.remove();
  });
  activeSettingElements = [];
}

// === Menu Visibility ===
function hideMainMenu() {
  [playButtonBackground, btnPlay, settingsButtonBackground, btnSettings, exitButtonBackground, btnExit]
    .forEach(e => e && e.hide());
}

function showMainMenu() {
  if (!btnPlay || !btnSettings || !btnExit) {
    createMainMenu();
    return;
  }
  [playButtonBackground, btnPlay, settingsButtonBackground, btnSettings, exitButtonBackground, btnExit]
    .forEach(e => e && e.show());
}

// === Settings Teardown ===
function hideSettingsMenu() {
  clearSubSettings();
  [...categoryBackgrounds, ...categoryButtons, saveBackground, btnSave, backMenuBackground, btnBackMenu]
    .forEach(e => e && e.remove());
  categoryBackgrounds = [];
  categoryButtons = [];
  releaseSettingsMenuRoot();
}

// === Text / Accessibility ===
function adjustTextSize(sizeValue) {
  if (typeof sizeValue !== 'number' || !isFinite(sizeValue)) {
    sizeValue = DEFAULT_SETTINGS.textSize;
  }
  const scale = sizeValue / DEFAULT_SETTINGS.textSize;
  baseFontPx = scale * 0.04 * height;
  smallFontPx = scale * 0.03 * height;
  labelFontPx = scale * 0.035 * height;
  headingFontPx = baseFontPx * 1.25;

  const applyFont = (el, sizePx) => { if (el) el.style('font-size', sizePx + 'px'); };
  [btnPlay, btnSettings, btnExit].forEach(btn => applyFont(btn, baseFontPx));
  [btnSave, btnBackMenu].forEach(btn => applyFont(btn, smallFontPx));
  categoryButtons.forEach(btn => applyFont(btn, baseFontPx));
  activeSettingElements.forEach(e => {
    if (!e || !e.elt) return;
    const tag = e.elt.tagName;
    if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'INPUT') applyFont(e, smallFontPx);
    else if (e.elt.classList?.contains('setting-label')) applyFont(e, labelFontPx);
  });
  selectAll('.setting-label').forEach(lbl => lbl.style('font-size', labelFontPx + 'px'));
  selectAll('.setting-checkbox').forEach(cbEl => { try { cbEl.style('font-size', smallFontPx + 'px'); } catch (e) {} });
  window.textSize(headingFontPx);
}

function applyCurrentTextSize() {
  adjustTextSize(textSizeSetting);
  updateTextSizeButtonStyles();
}

function saveAccessibilitySettings() {
  playClickSFX();
  alert("✅ Accessibility settings applied!");
  applyCurrentTextSize();
}
