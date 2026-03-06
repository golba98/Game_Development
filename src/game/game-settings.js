// game-settings.js — Settings panels, DOM styles, translation, zoom helpers
// Extracted from 4-Game.js

// --- Text Size Constants ---
const TEXT_SIZE_DEFAULT   = 75;  // Baseline setting value (maps to 1.0 scale)
const TEXT_SIZE_BASE_PX   = 14;  // Body text
const TEXT_SIZE_SMALL_PX  = 12;  // Small/secondary text
const TEXT_SIZE_LABEL_PX  = 18;  // Setting row labels
const TEXT_SIZE_HEADING_PX = 24; // Section headings

// --- Settings Panel Dimensions ---
const SETTINGS_PANEL_W = 720;
const SETTINGS_PANEL_H = 540;

// --- Loading Overlay Scale Clamps ---
const LOADING_SCALE_HEIGHT_REF = 1080; // Reference height for scale calculation
const LOADING_SCALE_MIN        = 0.5;
const LOADING_SCALE_MAX        = 1.5;

// --- Zoom Detection Constants ---
const ZOOM_PROBE_DPI = 96; // Standard screen DPI used by browsers for CSS 1in
const ZOOM_CLAMP_MIN = 0.1;
const ZOOM_CLAMP_MAX = 10;

/** Returns the browser zoom level by measuring a CSS 1-inch element against 96dpi. */
function measureZoomViaInch() {
  try {
    if (typeof document === 'undefined') return null;
    if (!__zoomProbeEl) {
      __zoomProbeEl = document.createElement('div');
      __zoomProbeEl.id = 'gd-zoom-probe';
      __zoomProbeEl.style.position = 'absolute';
      __zoomProbeEl.style.width = '1in';
      __zoomProbeEl.style.height = '1in';
      __zoomProbeEl.style.left = '-9999px';
      __zoomProbeEl.style.top = '-9999px';
      __zoomProbeEl.style.pointerEvents = 'none';
      document.body.appendChild(__zoomProbeEl);
    }
    const rect = __zoomProbeEl.getBoundingClientRect();
    if (!rect || !rect.width) return null;
  
    return rect.width / ZOOM_PROBE_DPI;
  } catch (e) { return null; }
}

/** Aggregates multiple zoom signals (visual viewport, DPR, layout ratio) into one value. */
function estimateBrowserZoom() {
  if (typeof window === 'undefined') return 1;
  const candidates = [];
  if (window.outerWidth && window.innerWidth) {
    const layoutRatio = window.outerWidth / window.innerWidth;
    if (isFinite(layoutRatio) && layoutRatio > 0) {
      candidates.push(layoutRatio);
    }
  }
  const vv = window.visualViewport;
  if (vv && vv.scale) candidates.push(vv.scale);
  const probeZoom = measureZoomViaInch();
  if (probeZoom) candidates.push(probeZoom);
  if (window.devicePixelRatio) {
    const dprZoom = window.devicePixelRatio / (BASE_DPR || 1);
    candidates.push(dprZoom);
  }
  const zoom = candidates.find(v => v && isFinite(v) && v > 0.05 && v < 20) || 1;
  const clamped = Math.max(ZOOM_CLAMP_MIN, Math.min(ZOOM_CLAMP_MAX, zoom));
  if (ZOOM_DIAGNOSTIC_ENABLED) {
    if (!lastLoggedZoom || Math.abs(clamped - lastLoggedZoom) > 0.01) {
      console.log('[zoom] estimated browser zoom =', clamped, '(candidates', candidates, ')');
      lastLoggedZoom = clamped;
    }
  }
  return clamped;
}

/** Applies a continuous counter-scale transform on `el` to cancel browser zoom. Returns a cancel function. */
function makeElementZoomInvariant(el, origin = 'center center') {
  if (!el) return () => {};
  let zoomLoopId = null;
  const update = () => {
    if (!el || !el.parentNode) return;
    const zoom = estimateBrowserZoom();
    const inv = 1 / zoom;
    el.style.transform = `scale(${inv})`;
    el.style.transformOrigin = origin;
    zoomLoopId = requestAnimationFrame(update);
  };
  update();
  return () => { if (zoomLoopId) cancelAnimationFrame(zoomLoopId); };
}

/** Creates a fullscreen overlay + centred panel that stays visually stable across browser zoom levels. */
function createZoomStablePanel(w, h, id) {
  let container = createDiv('');
  container.id(id);
  container.style('position', 'fixed');
  container.style('top', '0');
  container.style('left', '0');
  container.style('width', '100%');
  container.style('height', '100%');
  container.style('z-index', '100000');
  container.style('display', 'flex');
  container.style('align-items', 'center');
  container.style('justify-content', 'center');
  container.style('background-color', 'rgba(0, 0, 0, 0.5)'); 
  container.style('transform-origin', 'top left');
  container.style('will-change', 'transform');
  container.style('pointer-events', 'auto');
  
  let panel = createDiv('');
  panel.parent(container);
  panel.style('width', `${w}px`);
  panel.style('height', `${h}px`);
  panel.style('background-color', 'rgba(18, 18, 23, 0.95)');
  panel.style('border', `2px solid ${MENU_GOLD_BORDER}`);
  panel.style('border-radius', '6px');
  panel.style('display', 'flex');
  panel.style('flex-direction', 'column');
  panel.style('align-items', 'center');
  panel.style('justify-content', 'center');
  panel.style('font-family', '"Courier New", monospace');
  panel.style('color', 'white');
  panel.style('box-shadow', `0 0 18px rgba(0,0,0,0.85), inset 0 0 0 2px ${MENU_GOLD_BORDER}`);
  panel.style('transform', 'none');
  
  let zoomLoopId = null;
  const stopPanelZoom = makeElementZoomInvariant(panel.elt, 'center center');
  const updateZoom = () => {
    if (!document.getElementById(id)) return;

    const vv = window.visualViewport;
    const ox = vv ? (vv.offsetLeft || 0) : 0;
    const oy = vv ? (vv.offsetTop || 0) : 0;

    container.style('transform', `translate(${ox}px, ${oy}px)`);
    
    zoomLoopId = requestAnimationFrame(updateZoom);
  };
  updateZoom();

  return { 
    container, 
    panel, 
    close: () => {
      if (zoomLoopId) cancelAnimationFrame(zoomLoopId);
      stopPanelZoom();
      container.remove();
    }
  };
}

/** Applies full-width pixel-button skin to a settings category tab. */
function applySettingsTabSkin(btn) {
  if (!btn || !btn.elt) return;
  stylePixelButton(btn);
  btn.style('width', '100%');
  btn.style('height', '54px');
  btn.style('padding', '0');
  btn.style('font-size', '20px');
  btn.style('letter-spacing', '0.2px');
  btn.style('border-radius', '2px');
  btn.style('box-shadow', '0 6px 14px rgba(0,0,0,0.6)');
  btn.style('transition', 'filter 0.15s ease, transform 0.1s ease, box-shadow 0.2s ease');
  if (btn.elt) {
    btn.elt.dataset.settingsActive = 'false';
    btn.elt.dataset.baseShadow = btn.style('box-shadow') || '';
  }
}

/** Applies standard menu button styling (size, gold border, text shadow). */
function applyMenuButtonUI(btn, w = 260, h = 48) {
  if (!btn || !btn.elt) return;
  stylePixelButton(btn);
  btn.style('width', `${w}px`);
  btn.style('height', `${h}px`);
  btn.style('font-size', '28px');
  btn.style('font-family', 'inherit');
  btn.style('letter-spacing', '0.4px');
  btn.style('border', `3px solid ${MENU_GOLD_BORDER}`);
  btn.style('color', '#fff');
  btn.style('text-shadow', `0 0 10px ${MENU_GOLD_GLOW}`);
  btn.style('cursor', 'pointer');
  btn.style('padding', '0');
  btn.style('display', 'flex');
  btn.style('align-items', 'center');
  btn.style('justify-content', 'center');
  btn.style('border-radius', '2px');
  btn.style('box-shadow', '0 8px 28px rgba(0,0,0,0.75)');
}

/** Applies the dark textured background and gold border to the settings panel element. */
function decorateSettingsPanel(panel) {
  if (!panel || !panel.style) return;
  panel.style('background-color', 'rgba(8, 8, 12, 0.9)');
  panel.style('background-image', `url('${SETTINGS_PANEL_TEXTURE_PATH}')`);
  panel.style('background-size', 'cover');
  panel.style('background-position', 'center');
  panel.style('border', `4px solid ${MENU_GOLD_BORDER}`);
  panel.style('box-shadow', '0 0 50px rgba(0,0,0,0.95)');
  panel.style('padding', '28px');
  panel.style('box-sizing', 'border-box');
  panel.style('justify-content', 'space-between');
  panel.style('gap', '18px');
  panel.style('border-radius', '12px');
}

/** Removes all settings DOM elements and the overlay, then persists current settings. */
function closeInGameSettings() {
  if (activeSettingElements && activeSettingElements.length) {
    activeSettingElements.forEach(e => { if (e) e.remove(); });
  }
  activeSettingElements = [];

  if (settingsOverlayDiv) {
    settingsOverlayDiv.remove();
    settingsOverlayDiv = null;
    settingsOverlayPanel = null;
  }

  clearSubSettings();
  try { applyCurrentTextSize(); } catch(e) {}
  try { persistSavedSettings(true); } catch(e) {}
}

/** Replaces the current settings panel contents with the builder for `label`. */
function showSubSettings(label) {
  clearSubSettings();

  const cx = width / 2;
  const cy = height / 2;
  const panelW = 0.7 * width;
  const panelH = 0.7 * height;
  const panelLeft = cx - panelW / 2;
  const panelRight = cx + panelW / 2;
  const paddingX = panelW * 0.08;
  const labelX = panelLeft + paddingX;
  const controlX = panelLeft + panelW * 0.42;
  const controlWidth = panelRight - paddingX - controlX;
  const spacingY = panelH * 0.14;

  const ctx = createSettingsContext({
    labelX, controlX, controlWidth, panelH,
    startY: cy - panelH / 2 + panelH * 0.18,
    spacingY
  });

  const builder = CATEGORY_BUILDERS[label];
  if (builder) {
    builder(ctx);
  }

  const backY = cy + panelH / 2 - panelH * 0.12;
  const backWidth = panelW * 0.3;
  const backBG = createBgImg("assets/3-GUI/Button_BG.png", cx - backWidth / 2, backY - BACK_BUTTON_VERTICAL_OFFSET, backWidth, panelH * 0.08, '3');
  const backBtn = makeSmallBtn("← Back", cx - backWidth / 2, backY - BACK_BUTTON_VERTICAL_OFFSET, backWidth, panelH * 0.08, () => {
    playClickSFX();
    clearSubSettings();
    showSettingsMenu();
  });

  activeSettingElements.push(backBG, backBtn);
  applyCurrentTextSize();
}

/** Returns the multiplier for the current text size setting (e.g. 1.0 at default, 1.2 at large). */
function getTextScale() {
  try {
    const raw = (typeof textSizeSetting === 'number') ? textSizeSetting : (parseInt(textSizeSetting, 10) || TEXT_SIZE_DEFAULT);
    return (raw && isFinite(raw)) ? (raw / TEXT_SIZE_DEFAULT) : 1;
  } catch (e) { return 1; }
}

/** Calls the (possibly overridden) textSize() with scale applied. */
function gTextSize(px) {
  ensureTextSizeOverride();
  try {
    if (typeof textSize === 'function') textSize(px);
  } catch (e) {
    try {
      const scale = getTextScale();
      const finalPx = Math.max(8, Math.round((Number(px) || 14) * scale));
      if (typeof _rawTextSizeFn === 'function') _rawTextSizeFn(finalPx);
    } catch (err) {}
  }
}

/** Monkey-patches p5's textSize() once so every call is automatically scaled by getTextScale(). */
function ensureTextSizeOverride() {
  if (_textSizeOverrideInstalled) return;
  if (typeof textSize !== 'function') return;
  _rawTextSizeFn = textSize.bind(window || globalThis);
  const scaledTextSize = (value) => {
    _textSizeBaseValue = (typeof value === 'number') ? value : _textSizeBaseValue || 14;
    const computed = Math.max(8, Math.round(_textSizeBaseValue * getTextScale()));
    try { _rawTextSizeFn(computed); } catch (e) {}
  };
  scaledTextSize.__raw = _rawTextSizeFn;
  scaledTextSize.__getBase = () => _textSizeBaseValue;
  scaledTextSize.__setBase = (val) => { _textSizeBaseValue = val; };
  try { textSize = scaledTextSize; } catch (e) {}
  _textSizeOverrideInstalled = true;
}

/** Re-applies the current text size to all live settings DOM elements. */
function applyCurrentTextSize() {
  ensureTextSizeOverride();
  try { if (typeof textSize === 'function') textSize(_textSizeBaseValue || TEXT_SIZE_BASE_PX); } catch(e) {}
  try {
    const scale = getTextScale();

    // Base values aligned with the inline styles used by createSettingsContext
    const base    = Math.max(14, Math.round(18 * scale));
    const label   = Math.max(16, Math.round(20 * scale));
    const btnSize = Math.max(14, Math.round(18 * scale));

    try { if (typeof textSize === 'function') textSize(base); } catch(e) {}

    try {
      const labels = document.querySelectorAll('.setting-label');
      labels.forEach(l => { try { l.style.fontSize = label + 'px'; } catch(e){} });
    } catch(e) {}

    try {
      const buttons = document.querySelectorAll('button[data-text-size-val]');
      buttons.forEach(b => { try { b.style.fontSize = btnSize + 'px'; } catch(e){} });
    } catch(e) {}

    try {
      const rootEl = (typeof settingsMenuContent !== 'undefined' && settingsMenuContent && settingsMenuContent.elt) ? settingsMenuContent.elt : document.getElementById('menu-settings-root');
      const root = (rootEl && rootEl.querySelector) ? rootEl : document.body;
      const selLabels = root.querySelectorAll('.setting-label, .setting-row, .setting-title');
      selLabels.forEach(el => { try { el.style.fontSize = label + 'px'; } catch(e){} });

      const btns = root.querySelectorAll('button, a');
      btns.forEach(el => { try { el.style.fontSize = btnSize + 'px'; } catch(e){} });

      const selects = root.querySelectorAll('select');
      selects.forEach(el => { try { el.style.fontSize = base + 'px'; } catch(e){} });

      const inputs = root.querySelectorAll('input');
      inputs.forEach(el => { try { el.style.fontSize = base + 'px'; } catch(e){} });

      const headings = root.querySelectorAll('h1, h2, h3');
      headings.forEach(el => { try { el.style.fontSize = Math.round(32 * scale) + 'px'; } catch(e){} });
    } catch(e) {}

    
    try {
      if (Array.isArray(activeSettingElements)) {
        activeSettingElements.forEach(item => {
          try {
            const node = item && (item.elt || item);
            if (!node || !node.style) return;
            const tag = (node.tagName || '').toLowerCase();
            const controlSize = (tag === 'input' || tag === 'select' || tag === 'button' || tag === 'a') ? btnSize : label;
            try { node.style.fontSize = controlSize + 'px'; } catch(e){}
            try {
              const children = node.querySelectorAll && node.querySelectorAll('*');
              if (children && children.length) {
                children.forEach(c => { try { c.style.fontSize = controlSize + 'px'; } catch(e){} });
              }
            } catch(e){}
          } catch(e){}
        });
      }
    } catch(e) {}

    try { updateTextSizeButtonStyles(); } catch(e) {}
  } catch(e) {}
}

/** Updates the loading overlay progress bar and scales the content to fit the viewport. */
function updateLoadingOverlayDom() {
  try {
    const el = document.getElementById('gd-loading-overlay');
    if (!el) return;
    
    if (showLoadingOverlay) {
      if (!overlayProgressActive && overlayProgress < 100) startLoadingProgress();
      if (overlayProgressActive) updateLoadingProgressTick();
      el.style.display = 'flex';
      el.style.opacity = '1';
      
     
      const content = document.getElementById('gd-loading-content');
      if (content) {
         
          let s = 1;
          if (typeof window !== 'undefined') s = window.innerHeight / LOADING_SCALE_HEIGHT_REF;
          s = Math.max(LOADING_SCALE_MIN, Math.min(LOADING_SCALE_MAX, s));
          if (Math.abs((lastLoadingScale ?? 0) - s) > 0.0001) {
            content.style.transform = `scale(${s})`;
            lastLoadingScale = s;
          }
      }
    } else {
      completeLoadingProgress();
      el.style.display = 'none';
      el.style.opacity = '0';
      return; 
    }

    const msg = el.querySelector('.gd-loading-message');
    if (msg && overlayMessage) msg.innerText = overlayMessage;

    let p = 0;
    if (typeof AssetTracker !== 'undefined' && AssetTracker.expected > 0) {
        p = (AssetTracker.loaded / AssetTracker.expected) * 100;
    } else if (typeof overlayProgress !== 'undefined') {
        p = overlayProgress;
    }
    p = Math.floor(Math.max(0, Math.min(100, p)));

    const fill = el.querySelector('.gd-progress-fill');
    const pct = el.querySelector('.gd-progress-text');
    
    if (fill) fill.style.width = p + '%';
    if (pct) pct.innerText = p + '%';

  } catch (e) {}
}

/** Injects the global CSS stylesheet (font, buttons, sliders, checkboxes, terminal) once. */
function injectCustomStyles() {
  try {
    if (typeof document === 'undefined' || !document.head) return;
    
    const existing = document.getElementById('gd-custom-styles');
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = 'gd-custom-styles';
    const fontPath = (typeof UI_FONT_PATH !== 'undefined' ? UI_FONT_PATH : 'assets/3-GUI/font.ttf').replace(/\\/g, '/');
    
    style.type = 'text/css';
    style.appendChild(document.createTextNode(`
      @font-face {
        font-family: 'MyFont';
        src: url('${fontPath}') format('truetype');
      }
      * {
        font-family: 'MyFont', sans-serif !important;
        box-sizing: border-box;
      }
      
      button:hover {
        transform: scale(1.05);
        color: #ffff80 !important;
      }

      button:active {
        transform: scale(0.98);
        color: #fff9b0 !important;
      }

      input[type="range"] {
        -webkit-appearance: none; 
        width: 100%;
        background: transparent;
        margin: 10px 0;
      }

      input[type="range"]::-webkit-slider-runnable-track {
        width: 100%;
        height: 26px !important;
        cursor: pointer;
        background: #222;
        border: 3px solid #555;
        border-radius: 15px;
      }

      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 38px !important;
        width: 38px !important;
        background: #ffcc00;        
        border-radius: 10px;        
        cursor: pointer;
        margin-top: -10px;          
        box-shadow: 0 0 15px rgba(0,0,0,0.8);
        z-index: 20002;
        position: relative;
      }

      input[type="checkbox"] {
        appearance: none;
        -webkit-appearance: none;
        width: 38px !important;
        height: 38px !important;
        background-color: #333;
        border: 3px solid #888;
        border-radius: 8px;
        cursor: pointer;
        position: relative;
        vertical-align: middle;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      input[type="checkbox"]:checked {
        background-color: #ffcc00 !important;
        border-color: #fff !important;
      }

      input[type="checkbox"]:checked::after {
        content: '✔';
        font-size: 28px;
        color: black;
        font-weight: bold;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -55%);
        line-height: 1;
      }

      /* Game Terminal */
      #game-terminal {
        position: fixed;
        top: -35%; /* Start hidden for animation */
        left: 0;
        width: 100%;
        height: 35%;
        background: rgba(5, 15, 5, 0.85);
        backdrop-filter: blur(8px);
        border-bottom: 2px solid #00ff41;
        z-index: 200000;
        display: none;
        flex-direction: column;
        padding: 15px;
        color: #00ff41;
        font-family: 'Courier New', Courier, monospace;
        font-size: 16px;
        box-shadow: 0 10px 30px rgba(0, 255, 65, 0.2);
        overflow: hidden;
        transition: top 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        text-shadow: 0 0 5px rgba(0, 255, 65, 0.5);
      }
      #game-terminal.open {
        top: 0;
        display: flex;
      }
      #game-terminal::after {
        content: " ";
        position: absolute;
        top: 0; left: 0; bottom: 0; right: 0;
        background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
        z-index: 200001;
        background-size: 100% 3px, 3px 100%;
        pointer-events: none;
      }
      #terminal-history {
        flex: 1;
        overflow-y: auto;
        margin-bottom: 10px;
        padding-right: 15px;
        scrollbar-width: thin;
        scrollbar-color: #00ff41 transparent;
      }
      #terminal-history::-webkit-scrollbar { width: 6px; }
      #terminal-history::-webkit-scrollbar-thumb { background: #00ff41; border-radius: 3px; }
      #terminal-input-row {
        display: flex;
        align-items: center;
        border-top: 1px solid rgba(0, 255, 65, 0.2);
        padding-top: 10px;
      }
      #terminal-prompt {
        margin-right: 12px;
        white-space: nowrap;
        color: #00ff41;
        font-weight: bold;
        opacity: 0.8;
      }
      #terminal-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #00ff41;
        font-family: inherit;
        font-size: 18px;
        text-shadow: 0 0 5px rgba(0, 255, 65, 0.5);
      }
      .terminal-log {
        margin: 4px 0;
        line-height: 1.4;
      }
      .terminal-error { color: #ff3333; text-shadow: 0 0 5px rgba(255, 51, 51, 0.5); }
      .terminal-success { color: #33ff33; text-shadow: 0 0 5px rgba(51, 255, 51, 0.5); }
      .terminal-hint { color: #888; font-style: italic; font-size: 12px; }
    `));
    document.head.appendChild(style);
  } catch (e) { console.warn('[game] injectCustomStyles failed', e); }
}

/** Opens the in-game settings overlay (category tabs + right-hand content column). */
function openInGameSettings(currentVals) {
  if (settingsOverlayDiv) {
    settingsOverlayDiv.remove();
    settingsOverlayDiv = null;
    settingsOverlayPanel = null;
  }

  if (currentVals && typeof currentVals === 'object') {
    if (typeof currentVals.masterVol === 'number') masterVol = currentVals.masterVol;
    if (typeof currentVals.musicVol === 'number') musicVol = currentVals.musicVol;
    if (typeof currentVals.sfxVol === 'number') sfxVol = currentVals.sfxVol;
    if (typeof currentVals.difficulty === 'string') {
      setDifficulty(currentVals.difficulty, { regenerate: false, reason: 'sync' });
    }
  }
  try {
    loadLocalSettings();
  } catch (e) {}
  try { applyCurrentTextSize(); } catch (e) {}

  const { container, panel, close } = createZoomStablePanel(SETTINGS_PANEL_W, SETTINGS_PANEL_H, 'gd-settings-overlay');
  decorateSettingsPanel(panel);

  settingsOverlayDiv = container;
  settingsOverlayPanel = panel;
  container.closeZoomPanel = close;

  let title = createDiv('SETTINGS');
  title.parent(panel);
  title.style('position', 'absolute');
  title.style('width', '100%');
  title.style('text-align', 'center');
  title.style('top', '-100px'); // Positioned above the box
  title.style('left', '0');
  title.style('font-size', '42px');
  title.style('font-weight', 'bold');
  title.style('color', '#000');
  title.style('text-shadow', 'none');

  const layoutRow = createDiv('');
  layoutRow.parent(panel);
  layoutRow.style('display', 'flex');
  layoutRow.style('gap', '26px');
  layoutRow.style('width', '100%');
  layoutRow.style('flex', '1');
  layoutRow.style('min-height', '340px');
  layoutRow.style('align-items', 'stretch');
  layoutRow.style('margin', '0 auto');
  layoutRow.style('max-width', '980px');

  const categoryColumn = createDiv('');
  categoryColumn.parent(layoutRow);
  categoryColumn.style('flex', '0 0 32%');
  categoryColumn.style('display', 'flex');
  categoryColumn.style('flex-direction', 'column');
  categoryColumn.style('gap', '12px');
  categoryColumn.style('padding', '6px 0');
  categoryColumn.style('height', '100%');
  categoryColumn.style('justify-content', 'center');
  categoryColumn.style('align-items', 'stretch');
  categoryColumn.style('box-sizing', 'border-box');

  const settingsColumnWrapper = createDiv('');
  settingsColumnWrapper.parent(layoutRow);
  settingsColumnWrapper.style('flex', '1');
  settingsColumnWrapper.style('display', 'flex');
  settingsColumnWrapper.style('flex-direction', 'column');
  settingsColumnWrapper.style('height', '100%');
  settingsColumnWrapper.style('justify-content', 'center');
  settingsColumnWrapper.style('align-items', 'stretch');
  settingsColumnWrapper.style('box-sizing', 'border-box');

  const settingsColumn = createDiv('');
  settingsColumn.parent(settingsColumnWrapper);
  settingsColumn.style('flex', '1');
  settingsColumn.style('height', '100%');
  settingsColumn.style('display', 'flex');
  settingsColumn.style('flex-direction', 'column');
  settingsColumn.style('gap', '12px');
  settingsColumn.style('overflow', 'hidden');

  const settingsBody = createDiv('');
  settingsBody.parent(settingsColumn);
  settingsBody.style('flex', '1');
  settingsBody.style('display', 'flex');
  settingsBody.style('flex-direction', 'column');
  settingsBody.style('gap', '12px');
  settingsBody.style('overflow-y', 'auto');
  settingsBody.style('padding-right', '4px');
  settingsBody.style('height', '100%');

  const categoryButtons = [];
  let activeCategoryBtn = null;

  let placeholderMessage = createDiv('Select a category to reveal its settings.');
  placeholderMessage.parent(settingsBody);
  placeholderMessage.style('color', '#ccc');
  placeholderMessage.style('font-size', '20px');
  placeholderMessage.style('text-align', 'center');
  placeholderMessage.style('margin-top', '8px');
  let placeholderVisible = true;

  const selectCategory = (label, btn) => {
    if (placeholderVisible && placeholderMessage) {
      placeholderMessage.remove();
      placeholderVisible = false;
    }
    if (activeCategoryBtn) {
      activeCategoryBtn.style('filter', 'none');
      activeCategoryBtn.style('transform', 'scale(1)');
      const baseShadow = activeCategoryBtn.elt?.dataset.baseShadow || '0 6px 14px rgba(0,0,0,0.6)';
      activeCategoryBtn.style('box-shadow', baseShadow);
      if (activeCategoryBtn.elt) activeCategoryBtn.elt.dataset.settingsActive = 'false';
    }
    activeCategoryBtn = btn;
    btn.style('filter', 'brightness(1.08)');
    btn.style('transform', 'scale(1.02)');
    btn.style('box-shadow', '0 10px 26px rgba(255,215,160,0.45), inset 0 0 0 2px rgba(255,255,255,0.25)');
    if (btn.elt) btn.elt.dataset.settingsActive = 'true';

    clearSubSettings();
    settingsBody.html('');

    const ctx = createSettingsContext({ container: settingsBody });
    const builder = CATEGORY_BUILDERS[label];
    if (builder) builder(ctx);
    syncSlidersToSettings();
    try { applyCurrentTextSize(); } catch (e) {}
  };

  SETTINGS_CATEGORIES.forEach(label => {
    const btn = createButton(label);
    btn.parent(categoryColumn);
    applySettingsTabSkin(btn);
    btn.style('font-size', '18px');
    btn.style('letter-spacing', '0.2px');
    btn.mousePressed(() => selectCategory(label, btn));
    categoryButtons.push(btn);
  });


  let closeBtn = createButton('CLOSE');
  closeBtn.parent(panel);
  closeBtn.style('margin-top', '16px');
  closeBtn.style('align-self', 'center');
  applyMenuButtonUI(closeBtn, 260, 52);
  closeBtn.style('border-color', MENU_GOLD_COLOR);
  closeBtn.style('box-shadow', '0 8px 20px rgba(0,0,0,0.7)');

  closeBtn.mousePressed(() => {
    if (container.closeZoomPanel) container.closeZoomPanel();
    else container.remove();

    settingsOverlayDiv = null;
    settingsOverlayPanel = null;
    clearSubSettings();

    openInGameMenu();
  });
}

/** Hides all settings category tab buttons and their backgrounds. */
function hideCategoryButtons() {
  categoryBackgrounds.forEach(e => e && e.hide());
  categoryButtons.forEach(e => e && e.hide());
}

/** Hides the Save and Back-to-Menu buttons at the bottom of the settings panel. */
function hideBottomButtons() {
  [saveBackground, btnSave, backMenuBackground, btnBackMenu].forEach(e => e && e.hide());
}

/** Creates a positioned, styled button via `styleButton`. */
function makeBtn(label, x, y, w, h, cb) {
  const b = createButton(label);
  b.size(w, h).position(x, y);
  styleButton(b);
  b.mousePressed(cb);
  return b;
}

/** Creates a non-interactive positioned image element (used as button backgrounds). */
function createBgImg(path, x, y, w, h, zIndex = '9998') {
  const img = createImg(path, '');
  img.size(w, h).position(x, y);
  img.style('pointer-events', 'none');
  img.style('z-index', zIndex);
  img.style('position', 'absolute');
  return img;
}

/** Creates a positioned small-pixel-styled button. */
function makeSmallBtn(label, x, y, w, h, cb) {
  const b = createButton(label);
  b.size(w, h).position(x, y);
  styleSmallButton(b);
  b.mousePressed(cb);
  return b;
}

/** Creates a right-aligned, absolutely positioned label div for legacy canvas-based settings. */
function createSettingLabel(txt, x, y, maxWidth = 200) {
  const d = createDiv(txt);
  d.position(x, y);
  d.style("color", "white");
  d.style("font-size", (0.035 * height) + "px");
  d.style("text-align", "right");
  d.style("width", maxWidth + "px");
  d.style("z-index", "4");
  d.style("position", "absolute");
  d.style("pointer-events", "none");
  if (d.elt && d.elt.classList) d.elt.classList.add('setting-label');
  return d;
}

/** Highlights the currently active text-size preset button in gold. */
function updateTextSizeButtonStyles() {
  const buttons = selectAll('button[data-text-size-val]');
  buttons.forEach(btn => {
    const sizeVal = Number(btn.attribute('data-text-size-val'));
    if (sizeVal === textSizeSetting) {
      btn.style('color', '#ffcc00');
      btn.style('text-shadow', '0 0 8px #ffcc0070');
    } else {
      btn.style('color', 'white');
      btn.style('text-shadow', '0 0 8px #ffffff60');
    }
  });
}

/** Syncs all active audio sliders to the current in-memory volume values. */
function syncSlidersToSettings() {
  activeSettingElements.forEach(e => {
    if (!e.elt || e.elt.tagName !== 'INPUT' || e.elt.type !== 'range') return;
    const key = e.elt.getAttribute('data-setting');
    if (!key) return;
    let value;
    switch (key) {
      case 'masterVol': value = masterVol * 100; break;
      case 'musicVol': value = musicVol * 100; break;
      case 'sfxVol': value = sfxVol * 100; break;
      default: return;
    }
    e.value(value);
  });
}

/** Removes and clears all tracked active setting DOM elements. */
function clearSubSettings() {
  activeSettingElements.forEach(e => e && e.remove());
  activeSettingElements = [];
}

/** Hides all main-menu buttons (Play, Settings, Exit). */
function hideMainMenu() {
  [playButtonBackground, btnPlay, settingsButtonBackground, btnSettings, exitButtonBackground, btnExit]
    .forEach(e => e && e.hide());
}

/** Shows main-menu buttons, creating them if they don't exist yet. */
function showMainMenu() {
  if (!btnPlay || !btnSettings || !btnExit) {
    createMainMenu();
    return;
  }
  [playButtonBackground, btnPlay, settingsButtonBackground, btnSettings, exitButtonBackground, btnExit]
    .forEach(e => e && e.show());
}

/** Destroys and clears all settings category + nav button elements. */
function hideSettingsMenu() {
  [...categoryBackgrounds, ...categoryButtons, saveBackground, btnSave, backMenuBackground, btnBackMenu]
    .forEach(e => e && e.remove());
  categoryBackgrounds = [];
  categoryButtons = [];
}

/** Applies transparent, absolutely-positioned style to legacy canvas-overlay buttons. */
function styleButton(btn) {
  btn.style("background", "transparent");
  btn.style("border", "none");
  btn.style("cursor", "pointer");
  btn.style("color", "white");
  btn.style("text-shadow", "0 0 10px #ffffff60");
  if (btn.elt) {
    btn.elt.style.position = 'absolute';
    btn.elt.style.pointerEvents = 'auto';
    btn.elt.style.zIndex = '10001';
  }
}

/** Applies the pixel-art button texture, hover/out animations, and font styling. */
function stylePixelButton(btn) {
  
  btn.style('background-color', 'transparent');
  btn.style('border', 'none');
  btn.style('color', 'white');
  btn.style('cursor', 'pointer');
  btn.style('border-radius', '2px');
  
  
  btn.style('background-image', `url('${MENU_BUTTON_TEXTURE_PATH}')`);
  btn.style('background-size', '100% 100%');
  btn.style('background-repeat', 'no-repeat');
  btn.style('image-rendering', 'pixelated'); 
  
  
  btn.style('font-family', '"MyFont", sans-serif'); 
  btn.style('text-shadow', '0 0 10px #ffffff60');
  
  
  btn.mouseOver(() => {
    btn.style('transform', 'scale(1.05)');
    btn.style('color', '#ffff80');
  });
  btn.mouseOut(() => {
    btn.style('transform', 'scale(1.0)');
    btn.style('color', 'white');
  });
  
  
  btn.style('z-index', '20005');
}

/** Populates `ctx` with Master Volume, Music Volume, and SFX Volume sliders. */
function buildAudioSettings(ctx) {
  ctx
    .addSliderRow("Master Volume", 0, 100, masterVol * 100, v => { 
        masterVol = v / 100; 
        if(typeof applyVolumes === 'function') applyVolumes(); 
        if(gameMusic) gameMusic.setVolume(musicVol * masterVol); 
        saveLocalSettingsDebounced(); 
    }, { isAudio: true })
    .addSliderRow("Music Volume", 0, 100, musicVol * 100, v => { 
        musicVol = v / 100; 
        if(typeof applyVolumes === 'function') applyVolumes(); 
        if(gameMusic) gameMusic.setVolume(musicVol * masterVol);
        saveLocalSettingsDebounced(); 
    }, { isAudio: true })
    .addSliderRow("SFX Volume", 0, 100, sfxVol * 100, v => { 
        sfxVol = v / 100; 
        saveLocalSettingsDebounced(); 
    }, { isAudio: true });
}

/** Populates `ctx` with Tutorials, HUD, and Difficulty controls. */
function buildGameplaySettings(ctx) {
  ctx
    .addCheckboxRow("Show Tutorials", showTutorialsSetting, { onChange: v => { showTutorialsSetting = v; persistSavedSettings(); } })
    .addCheckboxRow("Enable HUD", hudEnabled, { onChange: v => { hudEnabled = v; persistSavedSettings(); } })
    .addCheckboxRow("Show FPS", showFps, { onChange: v => { showFps = v; persistSavedSettings(); } })
    .addSelectRow("Difficulty", ["Easy", "Normal", "Hard"], {
      value: (difficultySetting.charAt(0).toUpperCase() + difficultySetting.slice(1)),
      onChange: (val) => {
        difficultySetting = val.toLowerCase();
        
        if(typeof setDifficulty === 'function') setDifficulty(difficultySetting, { regenerate: false });
        
        saveLocalSettings(); 
      }
    });
}

/** Populates `ctx` with Graphics toggles. */
function buildGraphicsSettings(ctx) {
  const fpsLabels = ["30", "60", "90", "120", "144", "165", "200", "350", "Uncapped"];
  const currentFpsLabel = targetFps === 999 ? "Uncapped" : String(targetFps);

  ctx
    .addSelectRow("Max FPS", fpsLabels, {
      value: fpsLabels.includes(currentFpsLabel) ? currentFpsLabel : "Uncapped",
      onChange: v => {
        targetFps = (v === "Uncapped") ? 999 : Number(v);
        persistSavedSettings();
        if (typeof applyFPS === 'function') applyFPS();
      }
    })
    .addCheckboxRow("Show Stars", showStars, { onChange: v => { showStars = v; persistSavedSettings(); } })
    .addCheckboxRow("Screen Shake", screenShakeEnabled, { onChange: v => { screenShakeEnabled = v; persistSavedSettings(); } })
    .addCheckboxRow("Ambient Particles", showParticles, { onChange: v => { 
        showParticles = v; 
        if (!v && typeof vfx !== 'undefined') {
          for (let i = vfx.length - 1; i >= 0; i--) {
            if (vfx[i].type === 'firefly') vfx.splice(i, 1);
          }
        }
        persistSavedSettings(); 
    } })
    .addCheckboxRow("Firefly Lighting", showFireflyLighting, { onChange: v => { showFireflyLighting = v; persistSavedSettings(); } });
}

/** Populates `ctx` with click-to-rebind keybind rows, a Sensitivity slider, and Invert Y toggle. */
function buildControlsSettings(ctx) {
  const KEYBIND_ACTIONS = [
    { key: 'moveUp',    label: 'Move Up' },
    { key: 'moveDown',  label: 'Move Down' },
    { key: 'moveLeft',  label: 'Move Left' },
    { key: 'moveRight', label: 'Move Right' },
    { key: 'sprint',    label: 'Sprint' },
    { key: 'jump',      label: 'Jump' },
    { key: 'cut',       label: 'Cut / Attack' },
  ];

  KEYBIND_ACTIONS.forEach(({ key, label }) => {
    const row = createDiv('');
    row.parent(ctx.container);
    row.style('display', 'flex');
    row.style('align-items', 'center');
    row.style('justify-content', 'space-between');
    row.style('width', '100%');
    row.style('margin-bottom', '10px');
    activeSettingElements.push(row);

    const lbl = createDiv(label);
    lbl.parent(row);
    lbl.class('setting-label');
    lbl.style('color', 'white');
    lbl.style('font-size', '20px');
    lbl.style('text-align', 'right');
    lbl.style('text-shadow', '1px 1px 0 #000');
    lbl.style('margin-right', '10px');
    lbl.style('flex', '1');

    const btn = createButton(keyCodeToLabel(playerKeybinds[key]));
    btn.parent(row);
    btn.style('flex', '1');
    btn.style('height', '30px');
    stylePixelButton(btn);
    btn.style('font-size', '14px');
    btn.style('padding', '0');
    activeSettingElements.push(btn);

    btn.mousePressed(() => {
      btn.html('Press a key...');
      const capture = (e) => {
        e.preventDefault();
        e.stopPropagation();
        playerKeybinds[key] = e.keyCode;
        btn.html(keyCodeToLabel(e.keyCode));
        document.removeEventListener('keydown', capture, true);
        try { saveLocalSettings(); } catch (err) {}
      };
      document.addEventListener('keydown', capture, true);
    });
  });

  ctx.addSliderRow("Sensitivity", 1, 10, sensitivitySetting, v => { sensitivitySetting = Number(v); persistSavedSettings(); });
  ctx.addCheckboxRow("Invert Y Axis", invertYAxis, { onChange: v => { invertYAxis = v; persistSavedSettings(); } });
}

/** Applies an SVG colour-blindness filter to the canvas, or clears it for "None". */
function applyColorMode(mode) {
  // Inject SVG filter definitions once
  if (!document.getElementById('game-cb-filters')) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'game-cb-filters';
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none');
    svg.innerHTML = `<defs>
      <filter id="game-cb-protanopia">
        <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/>
      </filter>
      <filter id="game-cb-deuteranopia">
        <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/>
      </filter>
      <filter id="game-cb-tritanopia">
        <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/>
      </filter>
    </defs>`;
    document.body.appendChild(svg);
  }

  const filterMap = {
    'Protanopia':   'url(#game-cb-protanopia)',
    'Deuteranopia': 'url(#game-cb-deuteranopia)',
    'Tritanopia':   'url(#game-cb-tritanopia)',
    'Grayscale':    'grayscale(100%)',
    'Sepia':        'sepia(80%)',
    'Invert':       'invert(100%) hue-rotate(180deg)',
    'High Contrast':'contrast(150%) saturate(120%)'
  };
  const canvas = document.querySelector('canvas');
  if (canvas) canvas.style.filter = filterMap[mode] || '';
}

/** Populates `ctx` with Color Mode selector and Text Size preset buttons. */
function buildAccessibilitySettings(ctx) {
  ctx.addSelectRow("Color Mode", ["None", "Protanopia", "Deuteranopia", "Tritanopia", "Grayscale", "Sepia", "Invert", "High Contrast"], {
    value: colorModeSetting,
    onChange: v => { colorModeSetting = v; applyColorMode(v); persistSavedSettings(); }
  });
  
  
  const row = createDiv('');
  row.parent(ctx.container);
  row.style('display', 'flex');
  row.style('align-items', 'center');
  row.style('justify-content', 'space-between');
  row.style('width', '100%');
  row.style('margin-bottom', '10px');
  activeSettingElements.push(row);

  const lbl = createDiv("Text Size");
  lbl.parent(row);
  lbl.class('setting-label');
  lbl.style('color', 'white');
  lbl.style('font-size', '20px');
  lbl.style('text-align', 'right'); 
  lbl.style('text-shadow', '1px 1px 0 #000');
  lbl.style('margin-right', '10px');
  lbl.style('flex', '1');

  const btnGroup = createDiv('');
  btnGroup.parent(row);
  btnGroup.style('display', 'flex');
  btnGroup.style('gap', '5px');
  btnGroup.style('flex', '1');

  const presetSource = (typeof window !== 'undefined' && Array.isArray(window.MENU_TEXT_SIZE_PRESETS)) ? window.MENU_TEXT_SIZE_PRESETS : null;
  const presets = presetSource || [ { label: 'Small', value: 60 }, { label: 'Default', value: 75 }, { label: 'Big', value: 90 } ];

  presets.forEach(p => {
      const label = p && p.label ? String(p.label) : String(p);
      const val = p && typeof p.value === 'number' ? Number(p.value) : (label === 'Default' ? 75 : (label === 'Small' ? 60 : 90));
      const btn = createButton(label);
      btn.parent(btnGroup);
      btn.attribute('data-text-size-val', String(val));
      btn.style('flex', '1');
      btn.style('height', '30px');
      stylePixelButton(btn);
      btn.style('font-size', '14px');
      btn.style('padding', '0');
      btn.mousePressed(() => {
        try { textSizeSetting = Number(val); } catch(e) { textSizeSetting = val; }
        try { applyCurrentTextSize(); } catch(e) {}
        try { updateTextSizeButtonStyles(); } catch(e) {}
        try {
          if (typeof persistSavedSettings === 'function') {
            persistSavedSettings(true);
          } else if (typeof saveLocalSettings === 'function') {
            saveLocalSettings();
          } else {
            try { localStorage.setItem('menuSettings', JSON.stringify({ masterVol, musicVol, sfxVol, textSizeSetting, difficulty: difficultySetting })); } catch(e){}
          }
        } catch(e) {}
      });
  });
}

/** Looks up `key` in the active language table; falls back to English, then the key itself. */
function t(key, ...args) {
  const code = (languageSetting || 'English').slice(0, 2).toLowerCase();
  const table = TRANSLATIONS[code] || TRANSLATIONS.en;
  const val = (table[key] !== undefined ? table[key] : TRANSLATIONS.en[key]) ?? key;
  return typeof val === 'function' ? val(...args) : val;
}

/** Populates `ctx` with the Language selector. */
function buildLanguageSettings(ctx) {
  ctx.addSelectRow("Language", ["English", "Spanish", "French", "German"], {
    value: languageSetting,
    onChange: v => { languageSetting = v; persistSavedSettings(); }
  });
}

/**
 * Returns a builder object for populating a settings panel.
 * All created elements are pushed into `activeSettingElements` for later cleanup.
 * Methods: addSliderRow, addCheckboxRow, addSelectRow, pushElement
 */
function createSettingsContext({ container }) {
  
  const styleLabel = (el) => {
      el.class('setting-label');
      el.style('color', 'white');
      el.style('font-size', '20px');
      el.style('text-align', 'right'); 
      el.style('text-shadow', '1px 1px 0 #000');
      el.style('margin-right', '10px');
      el.style('flex', '1');
  };

  const styleInput = (el) => {
      el.style('cursor', 'pointer');
      el.style('flex', '1');
  };

  const audioSettingKey = (label) => {
    if (label === 'Master Volume') return 'masterVol';
    if (label === 'Music Volume') return 'musicVol';
    if (label === 'SFX Volume') return 'sfxVol';
    return null;
  };

  const recordElement = (el) => {
    if (el) activeSettingElements.push(el);
  };

  const createRow = () => {
    const row = createDiv('');
    row.parent(container);
    row.style('display', 'flex');
    row.style('align-items', 'center');
    row.style('justify-content', 'space-between');
    row.style('width', '100%');
    row.style('margin-bottom', '10px');
    recordElement(row);
    return row;
  };

  const ctx = {
    container,

    pushElement(el) {
      recordElement(el);
      return ctx;
    },

    addSliderRow(name, min, max, val, callback, opts = {}) {
      const row = createRow();

      const lbl = createDiv(name);
      lbl.parent(row);
      styleLabel(lbl);
      recordElement(lbl);
      
      const slider = createSlider(min, max, val);
      slider.parent(row);
      slider.style('width', '100%'); 
      styleInput(slider);
      if (opts && opts.isAudio) {
        const key = audioSettingKey(name);
        if (key) slider.attribute('data-setting', key);
      }
      recordElement(slider);
      
      slider.input(() => {
        try { callback(slider.value()); } catch(e) {}
        try {
          if (typeof window !== 'undefined' && typeof window.showError1 === 'function') {
            const keyName = String(name || '').toLowerCase();
            if (/sensitivity/.test(keyName)) {
              try { window.showError1(name); } catch(e){}
            }
          }
        } catch(e) {}
      });
      
      return ctx;
    },

    addCheckboxRow(name, state = false, options = {}) {
      const row = createRow();

      const lbl = createDiv(name);
      lbl.parent(row);
      styleLabel(lbl);
      recordElement(lbl);

      const toggle = createDiv('');
      toggle.parent(row);
      toggle.style('width', '36px');
      toggle.style('height', '36px');
      toggle.style('display', 'flex');
      toggle.style('align-items', 'center');
      toggle.style('justify-content', 'center');
      toggle.style('border', `2px solid ${MENU_GOLD_BORDER}`);
      toggle.style('border-radius', '6px');
      toggle.style('box-shadow', `inset 0 0 0 2px rgba(0,0,0,0.4)`);
      toggle.style('cursor', 'pointer');
      toggle.style('font-size', '24px');
      toggle.style('font-family', 'MyFont, sans-serif');
      toggle.style('color', MENU_GOLD_COLOR);
      toggle.style('background', 'rgba(255,255,255,0.05)');
      toggle.style('transition', 'background 0.2s ease, transform 0.2s ease');
      recordElement(toggle);

      let checked = !!state;
      const updateVisual = (value) => {
        toggle.html(value ? '✔' : '');
        toggle.style('background', value ? `rgba(184,134,11,0.35)` : 'rgba(255,255,255,0.05)');
        toggle.style('box-shadow', value ? `0 0 12px ${MENU_GOLD_GLOW}` : 'inset 0 0 0 2px rgba(0,0,0,0.4)');
        toggle.style('transform', value ? 'scale(1.05)' : 'none');
      };
      updateVisual(checked);

      const toggleHandler = () => {
        checked = !checked;
        updateVisual(checked);
        if (typeof options.onChange === 'function') {
          options.onChange(checked);
        }
        try {
        if (typeof window !== 'undefined' && typeof window.showError1 === 'function') {
          const keyName = String(name || '').toLowerCase();
          if (/show\s*tutorials?/.test(keyName) || /enable\s*hud/.test(keyName) || /enabled\s*hub/.test(keyName) || /invert\s*y/.test(keyName) || /invert\s*y\s*axis/.test(keyName)) {
            try { window.showError1(name); } catch(e){}
          }
        }
        } catch(e) {}
      };
      toggle.mousePressed(toggleHandler);

      return ctx;
    },

    addSelectRow(name, opts, options = {}) {
      const row = createRow();

      const lbl = createDiv(name);
      lbl.parent(row);
      styleLabel(lbl);
      recordElement(lbl);

      const sel = createSelect();
      sel.parent(row);
      sel.style('font-size', '16px');
      sel.style('background', '#222');
      sel.style('color', 'white');
      sel.style('border', '1px solid #555'); 
      sel.style('border-radius', '4px');
      sel.style('padding', '5px');
      styleInput(sel);
      
      opts.forEach(opt => sel.option(opt));
      
      if (options.value) sel.value(options.value);
      sel.changed(() => {
        try { if (typeof options.onChange === 'function') options.onChange(sel.value()); } catch(e) {}
        try {
          if (typeof window !== 'undefined' && typeof window.showError1 === 'function') {
            const keyName = String(name || '').toLowerCase();
            if (/color\s*mode/.test(keyName) || /difficulty/.test(keyName)) {
              try { window.showError1(name); } catch(e){}
            } else if (/language/.test(keyName)) {
              try { window.showError1(name + ' — ONLY English is supported now'); } catch(e){}
            }
          }
        } catch(e) {}
      });
      recordElement(sel);

      return ctx;
    }
  };
  return ctx;
}

/** Creates the loading overlay DOM (progress bar + percentage) if it doesn't exist yet. */
function ensureLoadingOverlayDom() {
  try {
    if (typeof document === 'undefined') return null;
    
    if (!document.body) {
      setTimeout(ensureLoadingOverlayDom, 50);
      return null;
    }

    let el = document.getElementById('gd-loading-overlay');
    
    if (el && !document.getElementById('gd-loading-content')) {
        el.remove();
        el = null;
    }

    if (el) return el;

    el = document.createElement('div');
    el.id = 'gd-loading-overlay';
    
    const content = document.createElement('div');
    content.id = 'gd-loading-content';

    const msg = document.createElement('div');
    msg.className = 'gd-loading-message';
    msg.innerText = overlayMessage || 'LOADING MAP...';

    const barCont = document.createElement('div');
    barCont.className = 'gd-progress-container';
    
    const barFill = document.createElement('div');
    barFill.className = 'gd-progress-fill';
    
    const pct = document.createElement('div');
    pct.className = 'gd-progress-text';
    pct.innerText = '0%';

    barCont.appendChild(barFill);
    
    content.appendChild(msg);
    content.appendChild(barCont);
    content.appendChild(pct);
    
    el.appendChild(content);
    document.body.appendChild(el);

    makeElementZoomInvariant(content, 'top center');

    return el;
  } catch (e) { return null; }
}


// ── Translations data ──
const TRANSLATIONS = {
  en: {
    paused:'PAUSED', resume:'RESUME', settings:'SETTINGS', exit:'EXIT',
    victory:'VICTORY',
    victory_msg:(g)=>`All threats eliminated.<br>Final Gold: ${g}<br>Find the portal to escape.`,
    continue_btn:'CONTINUE',
    game_over:'GAME OVER',
    gameover_msg:(g)=>`Your journey has ended.<br>Final Gold: ${g}`,
    restart:'RESTART', exit_to_menu:'EXIT TO MENU',
    gold_hud:(n)=>`GOLD: ${n}`,
    boss_name:'ELITE BEETLE ALPHA',
    got_potion:'GOT POTION', got_boost:'GOT BOOST',
    speed_up:'SPEED UP!', full_hp:'FULL HP', crush:'CRUSH!', empty:'EMPTY', splat:'SPLAT!',
    objective:'OBJECTIVE: Collect all Coins and Eliminate all Threats!',
    map_saved:'Map saved locally', map_autosaved:'Map autosaved',
    level_clear:(l,n)=>`Level ${l} Clear! Entering Level ${n}...`,
    world_cleared:'World Cleared! Traveling to next area...',
    tut_title:'WELCOME TO THE TRAINING GLADE',
    tut_move:'• W/A/S/D: Move', tut_sprint:'• SHIFT (Hold): Sprint',
    tut_jump:'• SPACE: Jump', tut_attack:'• LEFT CLICK or E: Attack',
    tut_items:'• [1] / [2]: Use Items',
    tut_objective:'OBJETIVO:', tut_objective_text:'Fight, collect coins, then enter the Portal!',
    tut_step_move:'Move', tut_step_sprint:'Sprint', tut_step_fight:'Fight',
    tut_step_collect:'Collect', tut_step_portal:'Portal',
    tut_wasd:'Use W A S D to move!', tut_head_north:'Head North through the gap!', tut_gap:'Gap',
    tut_sprint_prompt:(k)=>`Hold ${k} to Sprint!`, tut_fast:'Fast! Keep going!',
    tut_target:'Target', tut_attack_prompt:(k)=>`${k} to Attack!`,
    tut_approach:'Approach and attack!', tut_keep_attacking:'Keep attacking!',
    tut_collect_coins:(n)=>`Collect all coins! (${n} left)`,
    tut_portal:'Portal', tut_enter_portal:'Enter the Portal!',
    tut_made_it:'Nice! You made it through!', tut_fast2:'Fast!',
    tut_pest_eliminated:'Pest eliminated! Good work!',
    tut_coins_collected:'All coins collected! The Portal is open!',
    tut_coins_left:(n)=>`${n} coin${n===1?'':'s'} left!`,
    tut_come_back_sprint:(k)=>`Come back up! Hold ${k} to sprint!`,
    tut_pest_north:'Come back! The pest is to the North!',
    tut_defeat_first:'Defeat the pest first! Head back West!',
    tut_coins_east:'The coins are to the East!',
    tut_collect_north:'Come back! Collect the coins up North!',
    tut_portal_north:'The Portal is up North! Head back!',
    tut_portal_east:'The Portal is to the East!',
  },
  es: {
    paused:'PAUSADO', resume:'REANUDAR', settings:'AJUSTES', exit:'SALIR',
    victory:'VICTORIA',
    victory_msg:(g)=>`Todas las amenazas eliminadas.<br>Oro final: ${g}<br>Encuentra el portal para escapar.`,
    continue_btn:'CONTINUAR',
    game_over:'FIN DEL JUEGO',
    gameover_msg:(g)=>`Tu aventura ha terminado.<br>Oro final: ${g}`,
    restart:'REINICIAR', exit_to_menu:'SALIR AL MENÚ',
    gold_hud:(n)=>`ORO: ${n}`,
    boss_name:'ESCARABAJO ÉLITE ALFA',
    got_potion:'¡POCIÓN!', got_boost:'¡IMPULSO!',
    speed_up:'¡VELOZ!', full_hp:'HP LLENO', crush:'¡APLASTADO!', empty:'VACÍO', splat:'¡PLAS!',
    objective:'OBJETIVO: ¡Recoge todas las monedas y elimina las amenazas!',
    map_saved:'Mapa guardado', map_autosaved:'Autoguardado',
    level_clear:(l,n)=>`¡Nivel ${l} superado! Entrando al nivel ${n}...`,
    world_cleared:'¡Mundo completado! Viajando a la siguiente zona...',
    tut_title:'BIENVENIDO AL CLARO DE ENTRENAMIENTO',
    tut_move:'• W/A/S/D: Moverse', tut_sprint:'• SHIFT (Mantener): Correr',
    tut_jump:'• ESPACIO: Saltar', tut_attack:'• CLIC o E: Atacar',
    tut_items:'• [1] / [2]: Usar objetos',
    tut_objective:'OBJETIVO:', tut_objective_text:'¡Lucha, recoge monedas y entra al portal!',
    tut_step_move:'Mover', tut_step_sprint:'Correr', tut_step_fight:'Luchar',
    tut_step_collect:'Recoger', tut_step_portal:'Portal',
    tut_wasd:'¡Usa W A S D para moverte!', tut_head_north:'¡Ve al Norte por el hueco!', tut_gap:'Hueco',
    tut_sprint_prompt:(k)=>`¡Mantén ${k} para correr!`, tut_fast:'¡Rápido! ¡Sigue así!',
    tut_target:'Objetivo', tut_attack_prompt:(k)=>`¡${k} para atacar!`,
    tut_approach:'¡Acércate y ataca!', tut_keep_attacking:'¡Sigue atacando!',
    tut_collect_coins:(n)=>`¡Recoge todas las monedas! (${n} restantes)`,
    tut_portal:'Portal', tut_enter_portal:'¡Entra al portal!',
    tut_made_it:'¡Muy bien! ¡Lo lograste!', tut_fast2:'¡Rápido!',
    tut_pest_eliminated:'¡Plaga eliminada! ¡Buen trabajo!',
    tut_coins_collected:'¡Monedas recogidas! ¡El portal está abierto!',
    tut_coins_left:(n)=>`¡Quedan ${n} moneda${n===1?'':'s'}!`,
    tut_come_back_sprint:(k)=>`¡Vuelve! ¡Mantén ${k} para correr!`,
    tut_pest_north:'¡Vuelve! ¡La plaga está al Norte!',
    tut_defeat_first:'¡Derrota la plaga primero! ¡Vuelve al Oeste!',
    tut_coins_east:'¡Las monedas están al Este!',
    tut_collect_north:'¡Vuelve! ¡Recoge las monedas al Norte!',
    tut_portal_north:'¡El portal está al Norte! ¡Vuelve!',
    tut_portal_east:'¡El portal está al Este!',
  },
  fr: {
    paused:'PAUSE', resume:'REPRENDRE', settings:'OPTIONS', exit:'QUITTER',
    victory:'VICTOIRE',
    victory_msg:(g)=>`Toutes les menaces éliminées.<br>Or final: ${g}<br>Trouvez le portail pour fuir.`,
    continue_btn:'CONTINUER',
    game_over:'PARTIE TERMINÉE',
    gameover_msg:(g)=>`Votre aventure est terminée.<br>Or final: ${g}`,
    restart:'RECOMMENCER', exit_to_menu:'QUITTER',
    gold_hud:(n)=>`OR: ${n}`,
    boss_name:'SCARABÉE ÉLITE ALPHA',
    got_potion:'POTION!', got_boost:'BOOST!',
    speed_up:'VITESSE!', full_hp:'PV COMPLETS', crush:'ÉCRASÉ!', empty:'VIDE', splat:'PLOUF!',
    objective:'OBJECTIF: Collectez toutes les pièces et éliminez les menaces!',
    map_saved:'Carte sauvegardée', map_autosaved:'Sauvegarde auto',
    level_clear:(l,n)=>`Niveau ${l} terminé! Entrée au niveau ${n}...`,
    world_cleared:'Monde terminé! Voyage vers la prochaine zone...',
    tut_title:'BIENVENUE DANS LA CLAIRIÈRE',
    tut_move:'• W/A/S/D: Se déplacer', tut_sprint:'• SHIFT (Maintenir): Sprinter',
    tut_jump:'• ESPACE: Sauter', tut_attack:'• CLIC ou E: Attaquer',
    tut_items:'• [1] / [2]: Utiliser objets',
    tut_objective:'OBJECTIF:', tut_objective_text:'Combattez, collectez des pièces, puis entrez dans le portail!',
    tut_step_move:'Bouger', tut_step_sprint:'Sprint', tut_step_fight:'Combat',
    tut_step_collect:'Collecter', tut_step_portal:'Portail',
    tut_wasd:'Utilisez W A S D pour vous déplacer!', tut_head_north:"Allez au Nord par l'ouverture!", tut_gap:'Passage',
    tut_sprint_prompt:(k)=>`Maintenez ${k} pour sprinter!`, tut_fast:'Vite! Continuez!',
    tut_target:'Cible', tut_attack_prompt:(k)=>`${k} pour attaquer!`,
    tut_approach:'Approchez et attaquez!', tut_keep_attacking:"Continuez d'attaquer!",
    tut_collect_coins:(n)=>`Collectez toutes les pièces! (${n} restantes)`,
    tut_portal:'Portail', tut_enter_portal:'Entrez dans le portail!',
    tut_made_it:'Bravo! Vous avez réussi!', tut_fast2:'Rapide!',
    tut_pest_eliminated:'Nuisible éliminé! Bon travail!',
    tut_coins_collected:'Pièces collectées! Le portail est ouvert!',
    tut_coins_left:(n)=>`${n} pièce${n===1?'':'s'} restante${n===1?'':'s'}!`,
    tut_come_back_sprint:(k)=>`Revenez! Maintenez ${k} pour sprinter!`,
    tut_pest_north:'Revenez! Le nuisible est au Nord!',
    tut_defeat_first:"Éliminez le nuisible d'abord! Revenez à l'Ouest!",
    tut_coins_east:"Les pièces sont à l'Est!",
    tut_collect_north:'Revenez! Collectez les pièces au Nord!',
    tut_portal_north:'Le portail est au Nord! Revenez!',
    tut_portal_east:"Le portail est à l'Est!",
  },
  de: {
    paused:'PAUSE', resume:'WEITER', settings:'EINSTELLUNGEN', exit:'BEENDEN',
    victory:'SIEG',
    victory_msg:(g)=>`Alle Bedrohungen beseitigt.<br>Endgold: ${g}<br>Finde das Portal zum Entkommen.`,
    continue_btn:'WEITER',
    game_over:'SPIEL VORBEI',
    gameover_msg:(g)=>`Deine Reise ist vorbei.<br>Endgold: ${g}`,
    restart:'NEU STARTEN', exit_to_menu:'ZUM MENÜ',
    gold_hud:(n)=>`GOLD: ${n}`,
    boss_name:'ELITE-KÄFER ALPHA',
    got_potion:'TRANK!', got_boost:'BOOST!',
    speed_up:'SCHNELL!', full_hp:'VOLL HP', crush:'ZERQUETSCHT!', empty:'LEER', splat:'PATSCH!',
    objective:'ZIEL: Sammle alle Münzen und eliminiere alle Bedrohungen!',
    map_saved:'Karte gespeichert', map_autosaved:'Autospeicherung',
    level_clear:(l,n)=>`Level ${l} geschafft! Betrete Level ${n}...`,
    world_cleared:'Welt abgeschlossen! Reise zum nächsten Gebiet...',
    tut_title:'WILLKOMMEN IN DER TRAINING-LICHTUNG',
    tut_move:'• W/A/S/D: Bewegen', tut_sprint:'• SHIFT (Halten): Sprinten',
    tut_jump:'• LEERTASTE: Springen', tut_attack:'• LINKSKLICK oder E: Angreifen',
    tut_items:'• [1] / [2]: Gegenstände benutzen',
    tut_objective:'ZIEL:', tut_objective_text:'Kämpfe, sammle Münzen und betrete das Portal!',
    tut_step_move:'Bewegen', tut_step_sprint:'Sprint', tut_step_fight:'Kampf',
    tut_step_collect:'Sammeln', tut_step_portal:'Portal',
    tut_wasd:'Benutze W A S D zum Bewegen!', tut_head_north:'Geh durch die Lücke nach Norden!', tut_gap:'Lücke',
    tut_sprint_prompt:(k)=>`Halte ${k} zum Sprinten!`, tut_fast:'Schnell! Weiter so!',
    tut_target:'Ziel', tut_attack_prompt:(k)=>`${k} zum Angreifen!`,
    tut_approach:'Annähern und angreifen!', tut_keep_attacking:'Weiter angreifen!',
    tut_collect_coins:(n)=>`Sammle alle Münzen! (${n} übrig)`,
    tut_portal:'Portal', tut_enter_portal:'Betrete das Portal!',
    tut_made_it:'Gut! Du hast es geschafft!', tut_fast2:'Schnell!',
    tut_pest_eliminated:'Schädling besiegt! Gute Arbeit!',
    tut_coins_collected:'Münzen gesammelt! Das Portal ist offen!',
    tut_coins_left:(n)=>`${n} Münze${n===1?'':'n'} übrig!`,
    tut_come_back_sprint:(k)=>`Komm zurück! Halte ${k} zum Sprinten!`,
    tut_pest_north:'Komm zurück! Der Schädling ist im Norden!',
    tut_defeat_first:'Besiege den Schädling zuerst! Geh nach Westen!',
    tut_coins_east:'Die Münzen sind im Osten!',
    tut_collect_north:'Komm zurück! Sammle die Münzen im Norden!',
    tut_portal_north:'Das Portal ist im Norden! Komm zurück!',
    tut_portal_east:'Das Portal ist im Osten!',
  },
};


// ── Category builders map ──
const CATEGORY_BUILDERS = {
  Audio: buildAudioSettings,
  Gameplay: buildGameplaySettings,
  Graphics: buildGraphicsSettings,
  Controls: buildControlsSettings,
  Accessibility: buildAccessibilitySettings,
  Language: buildLanguageSettings
};


// ── Text size override state ──
let _rawTextSizeFn = null;
let _textSizeBaseValue = 14;
let _textSizeOverrideInstalled = false;
