// === Zoom / DOM Stability / Scaling ===
function installMenuZoomLogger() {
  const logZoom = () => {
    try {
      const vv = window.visualViewport;
      const scale = vv && vv.scale ? vv.scale : (window.outerWidth / window.innerWidth) || 1;
      const dpr = window.devicePixelRatio || 1;
      const ratio = (window.outerWidth && window.innerWidth) ? window.outerWidth / window.innerWidth : 1;
      if (!_lastMenuZoomLog || Math.abs(scale - _lastMenuZoomLog) > 0.01) {
        console.log('[menu-zoom] scale', scale, 'dpr', dpr, 'outer/inner ratio', ratio, 'headers zoom', document.documentElement.style.zoom, document.body.style.zoom, 'visualViewport', vv ? vv.scale : 'n/a');
        _lastMenuZoomLog = scale;
      }
    } catch (e) {
      console.warn('[menu-zoom] logger failed', e);
    }
  };
  if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener('resize', logZoom);
  }
  window.addEventListener('resize', logZoom);
  window.addEventListener('zoom', logZoom);
  logZoom();
}

// === DOM Helpers ===
function getMenuDomParent() {
  return menuDomParent || document.body;
}

let _lastMenuRootOffset = { x: null, y: null };
// === Zoom Helpers ===
function watchZoomNeutralElement(el) {
  if (!el) return;
  const node = el.elt || el;
  if (!node || !node.style) return;
  node.style.transformOrigin = 'top left';
  node.style.willChange = 'transform';
  zoomNeutralElements.add(node);
}

function unwatchZoomNeutralElement(el) {
  if (!el) return;
  const node = el.elt || el;
  if (!node) return;
  zoomNeutralElements.delete(node);
}

function registerZoomAwareSlider(el, baseWidth, baseHeight) {
  if (!el) return;
  const node = el.elt || el;
  if (!node) return;
  zoomAwareSliders.set(node, { baseWidth, baseHeight });
}

function unregisterZoomAwareSlider(el) {
  if (!el) return;
  const node = el.elt || el;
  if (!node) return;
  zoomAwareSliders.delete(node);
}
// === Zoom / Measurement ===
function getCurrentMenuZoom() {
  const scale = window.visualViewport?.scale;
  if (scale && isFinite(scale) && scale > 0) return scale;
  return estimateMenuBrowserZoom();
}
// === DOM Stability Routines ===
function keepMenuRootStable(el) {
  if (!el) return () => {};
  let loopId = null;
  const update = () => {
    if (!el || !el.parentNode) return;
    const vv = window.visualViewport;
    const offsetX = vv ? (vv.offsetLeft || 0) : 0;
    const offsetY = vv ? (vv.offsetTop || 0) : 0;
    const zoom = getCurrentMenuZoom();
    const safeZoom = (zoom && isFinite(zoom) && zoom > 0) ? zoom : 1;
    el.style.transform = `translate(${-offsetX}px, ${-offsetY}px)`;
    el.style.transformOrigin = 'top left';
    if (_lastMenuRootOffset.x !== offsetX || _lastMenuRootOffset.y !== offsetY) {
      console.log('[menu-debug] root translate', { offsetX, offsetY, zoom: safeZoom });
      _lastMenuRootOffset = { x: offsetX, y: offsetY };
    }
    loopId = requestAnimationFrame(update);
  };
  update();
  return () => { if (loopId) cancelAnimationFrame(loopId); };
}

function keepMenuScaleStable(el) {
  if (!el) return () => {};
  let loopId = null;
  const update = () => {
    if (!el || !el.parentNode) return;
    const zoom = getCurrentMenuZoom();
    const safeZoom = (zoom && isFinite(zoom) && zoom > 0) ? zoom : 1;
    const clampedZoom = Math.max(0.1, Math.min(10, safeZoom));
    const inv = 1 / clampedZoom;
    el.style.transform = `scale(${inv})`;
    el.style.transformOrigin = 'top left';
    zoomNeutralElements.forEach(node => {
      if (!node) return;
      node.style.transform = `scale(${clampedZoom})`;
    });
    zoomAwareSliders.forEach(({ baseWidth, baseHeight }, node) => {
      if (!node || !baseWidth) return;
      node.style.width = `${Math.max(0, baseWidth * clampedZoom)}px`;
      if (baseHeight) {
        node.style.height = `${Math.max(0, baseHeight * clampedZoom)}px`;
      }
    });
    loopId = requestAnimationFrame(update);
  };
  update();
  return () => { if (loopId) cancelAnimationFrame(loopId); };
}

// === Zoom Measurement ===
function measureMenuZoomViaInch() {
  try {
    if (typeof document === 'undefined') return null;
    if (!__menuZoomProbeEl) {
      __menuZoomProbeEl = document.createElement('div');
      __menuZoomProbeEl.id = 'menu-zoom-probe';
      __menuZoomProbeEl.style.position = 'absolute';
      __menuZoomProbeEl.style.width = '1in';
      __menuZoomProbeEl.style.height = '1in';
      __menuZoomProbeEl.style.left = '-9999px';
      __menuZoomProbeEl.style.top = '-9999px';
      __menuZoomProbeEl.style.pointerEvents = 'none';
      document.body.appendChild(__menuZoomProbeEl);
    }
    const rect = __menuZoomProbeEl.getBoundingClientRect();
    if (!rect || !rect.width) return null;
    return rect.width / 96;
  } catch (e) { return null; }
}

let _menuLastLoggedZoom = null;
function estimateMenuBrowserZoom() {
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
  const probeZoom = measureMenuZoomViaInch();
  if (probeZoom) candidates.push(probeZoom);
  if (window.devicePixelRatio) {
    const dprZoom = window.devicePixelRatio / (BASE_MENU_DPR || 1);
    candidates.push(dprZoom);
  }
  const zoom = candidates.find(v => v && isFinite(v) && v > 0.05 && v < 20) || 1;
  const clamped = Math.max(0.1, Math.min(10, zoom));
  if (!_menuLastLoggedZoom || Math.abs(clamped - _menuLastLoggedZoom) > 0.01) {
    console.log('[menu-zoom] estimated browser zoom =', clamped, '(candidates', candidates, ')');
    _menuLastLoggedZoom = clamped;
  }
  return clamped;
}

// === Settings DOM / Root ===
function ensureSettingsMenuRoot() {
  if (settingsMenuRoot && settingsMenuContent) {
    menuDomParent = settingsMenuContent;
    return settingsMenuContent;
  }
  releaseSettingsMenuRoot();
  settingsMenuRoot = createDiv('');
  settingsMenuRoot.id('menu-settings-root');
  settingsMenuRoot.style('position', 'fixed');
  settingsMenuRoot.style('top', '0');
  settingsMenuRoot.style('left', '0');
  settingsMenuRoot.style('width', '100%');
  settingsMenuRoot.style('height', '100%');
  settingsMenuRoot.style('z-index', '2147483646');
  settingsMenuRoot.style('pointer-events', 'none');
  settingsMenuRoot.style('transform-origin', 'top left');
  settingsMenuRoot.style('will-change', 'transform');
  settingsMenuRoot.style('background', 'transparent');
  settingsMenuRoot.parent(document.body);

  settingsMenuScaleWrapper = createDiv('');
  settingsMenuScaleWrapper.parent(settingsMenuRoot);
  settingsMenuScaleWrapper.style('position', 'absolute');
  settingsMenuScaleWrapper.style('top', '0');
  settingsMenuScaleWrapper.style('left', '0');
  settingsMenuScaleWrapper.style('width', '100%');
  settingsMenuScaleWrapper.style('height', '100%');
  settingsMenuScaleWrapper.style('pointer-events', 'none');
  settingsMenuScaleWrapper.style('transform-origin', 'top left');
  settingsMenuScaleWrapper.style('will-change', 'transform');

  settingsMenuContent = createDiv('');
  settingsMenuContent.parent(settingsMenuScaleWrapper);
  settingsMenuContent.style('position', 'absolute');
  settingsMenuContent.style('top', '0');
  settingsMenuContent.style('left', '0');
  settingsMenuContent.style('width', '100%');
  settingsMenuContent.style('height', '100%');
  settingsMenuContent.style('pointer-events', 'auto');
  settingsMenuContent.style('display', 'block');

  settingsMenuStabilityHandle = keepMenuRootStable(settingsMenuRoot.elt);
  settingsMenuZoomHandle = keepMenuScaleStable(settingsMenuScaleWrapper.elt);
  menuDomParent = settingsMenuContent;
  return settingsMenuContent;
}

function releaseSettingsMenuRoot() {
  menuDomParent = null;
  if (settingsMenuStabilityHandle) {
    settingsMenuStabilityHandle();
    settingsMenuStabilityHandle = null;
  }
  if (settingsMenuZoomHandle) {
    settingsMenuZoomHandle();
    settingsMenuZoomHandle = null;
  }
  if (settingsMenuRoot) {
    settingsMenuRoot.remove();
    settingsMenuRoot = null;
  }
  if (settingsMenuScaleWrapper) {
    settingsMenuScaleWrapper.remove();
    settingsMenuScaleWrapper = null;
  }
  settingsMenuContent = null;
}
