// === Lifecycle / Setup / Rendering ===
function preload() {
  const _dbg = (() => { try { return new URLSearchParams(window.location.search).get('debug') === '1'; } catch (e) { return false; } })();
  if (_dbg) console.log('[preload] started — loading 5 menu assets');

  // Error callbacks are required so p5.js decrements its preload counter even on
  // failure — without them a single 404/decode-error leaves setup() uncalled forever.
  const imgOk  = (n) => () => { if (_dbg) console.log('[preload] image ok:', n); };
  const imgErr = (n) => () => console.warn('[preload] image failed (continuing):', n);
  const sndOk  = (n) => () => { if (_dbg) console.log('[preload] sound ok:', n); };
  const sndErr = (n) => () => console.warn('[preload] sound failed (continuing):', n);

  rectSkin     = loadImage('assets/1-Background/1-Menu/Settings_Background.png', imgOk('Settings_Background'), imgErr('Settings_Background'));
  myFont       = loadFont('assets/3-GUI/font.ttf',
    () => { if (_dbg) console.log('[preload] font ok'); },
    () => console.warn('[preload] font failed (continuing): font.ttf'));
  bgVideo      = createVideo(MENU_VIDEO_PATH);  // DOM element — not tracked by p5 preload
  bgMusic      = loadSound('assets/8-Music/menu_music.wav',    sndOk('menu_music'),    sndErr('menu_music'));
  clickSFX     = loadSound('assets/9-Sounds/Button_Press.mp3', sndOk('Button_Press'), sndErr('Button_Press'));
  bgPlayButton = loadImage('assets/1-Background/1-Menu/Background.png', imgOk('Background'), imgErr('Background'));
}

function setup() {
  const _dbg = (() => { try { return new URLSearchParams(window.location.search).get('debug') === '1'; } catch (e) { return false; } })();
  if (_dbg) console.log('[setup] started');
  try {
    const loadingOverlay = document.getElementById('gd-loading-overlay');
    if (loadingOverlay) loadingOverlay.remove();
    if (_dbg) console.log('[setup] loading overlay removed');

    const viewportSize = getViewportSize();
    canvas = createCanvas(viewportSize.width, viewportSize.height);
    canvas.style('z-index', '1');
    if (_dbg) console.log('[setup] canvas created', viewportSize.width, 'x', viewportSize.height);

    canvas.style('pointer-events', 'none');

    textFont(myFont);
    noStroke();

    loadAllSettings();
    injectCustomStyles();
    applyFPS();

    videoBuffer = createGraphics(width, height);
    initializeMenuBackgroundVideo(bgVideo);

    applyVolumes();
    // Do NOT start music here — autoplay before a user gesture is blocked by the
    // browser and emits an AudioContext warning. Music starts on first gesture below.
    const resumeOnFirstGesture = () => {
      try {
        console.log('[setup] first user gesture detected — attempting to unlock audio and start music');
        // unlockAudioAndStart() unlocks/resumes the context and starts menu music
        // itself once unlocked; passing a music callback here would double-start it.
        unlockAudioAndStart();
      } catch (e) {
        console.warn('[setup] resumeOnFirstGesture failed', e);
      }
    };
    window.addEventListener('pointerdown', resumeOnFirstGesture, { once: true });
    window.addEventListener('keydown', resumeOnFirstGesture, { once: true });
    calculateLayout();
    createMainMenu();
    if (_dbg) console.log('[setup] main menu created');
    installMenuZoomLogger();

    try {
      const ac = typeof getAudioContext === 'function' ? getAudioContext() : null;
      if (ac?.suspend) ac.suspend();
    } catch (e) {}
  } catch (e) {
    console.error('[setup] failed:', e);
    try {
      const ov = document.getElementById('gd-loading-overlay');
      if (ov) {
        const msg = ov.querySelector('.gd-loading-message');
        if (msg) msg.innerText = 'ERROR — check console';
      }
    } catch (_) {}
  }
}

  // === Iframe / Message handling ===
  window.removeGameOverlay = function () {
    requestStopGameMusicAndCloseOverlay();
  };

  window.addEventListener('message', (ev) => {
    if (!ev || !ev.data) return;
    try {

      if (ev.data.type === 'close-game-overlay') {
        window.removeGameOverlay();
      }

      else if (ev.data.type === 'game-iframe-ready') {
        try {
          const iframe = document.getElementById('game-iframe');
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              ...(typeof getGameSettingsMessage === 'function'
                ? getGameSettingsMessage()
                : { type: 'update-audio-settings', masterVol, musicVol, sfxVol, difficulty: difficultySetting })
            }, '*');
          }
        } catch (e) {}
      }

      else if (ev.data.type === 'game-ready') {
        // Game scripts fully loaded, canvas created — safe to send game-activated now.
        try {
          const iframe = document.getElementById('game-iframe');
          if (iframe && iframe.contentWindow && !iframe._gameActivatedSent) {
            iframe._gameActivatedSent = true;
            iframe.contentWindow.postMessage(
              (typeof getGameSettingsMessage === 'function'
                ? getGameSettingsMessage('game-activated')
                : { type: 'game-activated', masterVol, musicVol, sfxVol }),
              '*'
            );
            console.log('[parent] game-ready received: posted game-activated');
            try { iframe.focus(); } catch (e) {}
            try { iframe.contentWindow.focus(); } catch (e) {}
          }
        } catch (e) {}
      }

      else if (ev.data.type === 'sync-settings') {
        if (typeof ev.data.masterVol === 'number') masterVol = ev.data.masterVol;
        if (typeof ev.data.musicVol === 'number') musicVol = ev.data.musicVol;
        if (typeof ev.data.sfxVol === 'number') sfxVol = ev.data.sfxVol;
        if (typeof ev.data.difficulty === 'string') difficultySetting = ev.data.difficulty;
        if (typeof ev.data.showTutorialsSetting === 'boolean') showTutorials = ev.data.showTutorialsSetting;
        else if (typeof ev.data.showTutorials === 'boolean') showTutorials = ev.data.showTutorials;
        if (typeof ev.data.hudEnabled === 'boolean') showHUD = ev.data.hudEnabled;
        else if (typeof ev.data.showHUD === 'boolean') showHUD = ev.data.showHUD;
        performanceOverlayEnabled = normalizePerformanceOverlaySetting(ev.data, performanceOverlayEnabled);
        if (typeof ev.data.fpsMode !== 'undefined' || typeof ev.data.targetFps === 'number') {
          targetFps = getFpsTargetForMode(normalizeFpsMode(ev.data.fpsMode ?? ev.data.targetFps, normalizeFpsMode(targetFps)));
        }
        if (typeof ev.data.showStars === 'boolean') showStars = ev.data.showStars;
        if (typeof ev.data.screenShakeEnabled === 'boolean') screenShakeEnabled = ev.data.screenShakeEnabled;
        if (typeof ev.data.showParticles === 'boolean') showParticles = ev.data.showParticles;
        if (typeof ev.data.showFireflyLighting === 'boolean') showFireflyLighting = ev.data.showFireflyLighting;
        if (typeof ev.data.colorModeSetting === 'string') colorModeSetting = ev.data.colorModeSetting;
        if (typeof ev.data.invertYAxis === 'boolean') invertYAxis = ev.data.invertYAxis;
        if (typeof ev.data.sensitivitySetting === 'number') sensitivitySetting = ev.data.sensitivitySetting;
        textSizeSetting = normalizeUiScaleSetting(
          ev.data.uiScale ?? ev.data.textSizeSetting,
          textSizeSetting,
        );
        if (typeof ev.data.languageSetting === 'string') languageSetting = ev.data.languageSetting;


        applyVolumes();
        applyFPS();
        applyCurrentTextSize();


        saveAllSettings();
      }
    } catch (e) { console.warn('Message error', e); }
}, false);


  // === Iframe / Overlay Controls ===
  function requestStopGameMusicAndCloseOverlay() {
    const iframe = document.getElementById('game-iframe');
    const ov = document.getElementById('game-overlay');

    const cleanupAndResume = () => {
      try {
        const ifr = document.getElementById('game-iframe');
        if (ifr && ifr.contentWindow) {
          ifr.contentWindow.postMessage({ type: 'release-game-assets' }, '*');
        }
      } catch (e) {
        console.warn('[menu] failed to request release-game-assets', e);
      }
      try { if (ov) ov.remove(); } catch (e) { console.warn('remove overlay failed', e); }
      try {
        const ac = typeof getAudioContext === 'function' ? getAudioContext() : null;
        if (ac?.resume) ac.resume();
      } catch (e) {}
      try { startMenuMusicIfNeeded(); } catch (e) { console.warn('startMenuMusicIfNeeded failed', e); }
      try { enableMenuBackgroundVideo(); } catch (e) { console.warn('enableMenuBackgroundVideo failed', e); }
      showingSettings = false;
      activeCategory = null;
      try { hideSettingsMenu(); } catch (e) {}
      showMainMenu();
      setTimeout(() => { try { window.focus(); } catch (e) {} }, 50);

      setTimeout(() => {
        skipNextMenuReload = true;
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
        try { windowResized(); } catch (e) { console.warn('menu: windowResized call failed', e); }
      }, 350);
    };

    if (!iframe || !iframe.contentWindow) {
      cleanupAndResume();
      return;
    }

    const ackType = 'game-music-stopped';
    let acked = false;
    const onMessage = (ev) => {
      if (!ev || !ev.data) return;
      if (ev.data.type === ackType) {
        acked = true;
        window.removeEventListener('message', onMessage);
        cleanupAndResume();
      }
    };

    window.addEventListener('message', onMessage);

    try {
      iframe.contentWindow.postMessage({ type: 'stop-game-music' }, '*');
    } catch (e) { console.warn('failed to post stop-game-music', e); }

    setTimeout(() => {
      if (!acked) {
        window.removeEventListener('message', onMessage);
        cleanupAndResume();
      }
    }, 400);
  }

function applyFPS() {
  if (typeof frameRate === 'function') {
    const fpsMode = normalizeFpsMode(targetFps, DEFAULT_SETTINGS.fpsMode);
    targetFps = applyFpsModeToP5(fpsMode);
  }
}

// === Draw / Render Loop ===
function draw() {
  if (inGame) return;
  if (!window._menuFirstDraw) {
    window._menuFirstDraw = true;
    try {
      if (new URLSearchParams(window.location.search).get('debug') === '1') console.log('[draw] first menu draw frame');
    } catch (e) {}
  }

  updateBackgroundVideo();

  videoBuffer.clear();
  videoBuffer.image(bgVideo, 0, 0, width, height);
  imageMode(CORNER);
  tint(255, videoOpacity);
  image(videoBuffer, 0, 0, width, height);
  if (fallbackOpacity > 1) {
    const fallbackSource = fallbackFrameReady ? loopFallbackBuffer : bgPlayButton;
    if (fallbackSource) {
      tint(255, fallbackOpacity);
      image(fallbackSource, 0, 0, width, height);
    }
  }
  noTint();

  if (fadeAlpha > 0) {
    fill(0, fadeAlpha);
    rect(0, 0, width, height);
    if (!fadeInProgress) {
      fadeAlpha = max(0, fadeAlpha - 10);
    }
  }

  if (typeof frameRate === 'function') {
    recordPerformanceSample(performanceTracker, frameRate());
  }

  const menuPerfDebug = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('debugPerf') === '1' || params.get('menuPerf') === '1';
    } catch (e) {
      return false;
    }
  })();

  if (menuPerfDebug) {
    const uiScaleFactor = getUiScaleMultiplier(textSizeSetting);
    const _sz = getPerformanceOverlaySize(uiScaleFactor);
    drawPerformanceOverlayPanel({
      x: width - _sz.width - Math.round(20 * uiScaleFactor),
      y: Math.round(20 * uiScaleFactor),
      tracker: performanceTracker,
      targetFps,
      fpsMode: normalizeFpsMode(targetFps),
      uiScaleFactor,
    });
  }
}

// === Window / Resize Handling ===
function windowResized() {
  try { clearTimeout(_menuResizeTimer); } catch (e) {}
  const viewportSize = getViewportSize();
  _menuLastSize = { w: viewportSize.width, h: viewportSize.height };
  _menuResizeTimer = setTimeout(() => {
    try {

      const overlay = document.getElementById('game-overlay');
      if (overlay) {
        console.log('[menu] windowResized: game overlay present — skipping reload');
        return;
      }
    } catch (e) {
      console.warn('[menu] windowResized overlay check failed', e);
    }

    const latestViewportSize = getViewportSize();
    const matchesSize = (_menuLastSize.w === latestViewportSize.width && _menuLastSize.h === latestViewportSize.height);
    if (matchesSize) {
      resizeMenuViewport();
    } else {
      windowResized();
    }
  }, 200);
}

function resizeMenuViewport() {
  const viewportSize = getViewportSize();
  resizeCanvas(viewportSize.width, viewportSize.height);

  try {
    if (videoBuffer && typeof videoBuffer.remove === 'function') videoBuffer.remove();
  } catch (e) {}
  try {
    if (loopFallbackBuffer && typeof loopFallbackBuffer.remove === 'function') loopFallbackBuffer.remove();
  } catch (e) {}
  videoBuffer = createGraphics(width, height);
  loopFallbackBuffer = null;
  fallbackFrameReady = false;

  calculateLayout();
  positionMainMenuElements();
  applyCurrentTextSize();
}

function keyPressed() {
    if (key === "'" && keyIsDown(CONTROL)) {
        toggleTerminal();
        return false;
    }
}

// === Custom Styles Injection ===
function injectCustomStyles() {
  const existingStyle = document.getElementById('custom-menu-styles');
  if (existingStyle) existingStyle.remove();

  const style = createElement("style", `
    @font-face {
      font-family: "MyFont";
      src: url("assets/3-GUI/font.ttf") format("truetype");
    }
    * {
      font-family: "MyFont", sans-serif !important;
      box-sizing: border-box;
    }

    input[type="range"] {
      -webkit-appearance: none;
      width: 100%;
      background: transparent;
      margin: 10px 0;
    }

    /* The Track */
    input[type="range"]::-webkit-slider-runnable-track {
      width: 100%;
      height: 26px !important;
      cursor: pointer;
      background: #222;
      border: 3px solid #555;
      border-radius: 15px;
    }

    /* The Handle (Thumb) - THE BUTTON YOU DRAG */
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      height: 38px !important;
      width: 38px !important;
      background: #ffcc00;
      border: 4px solid white;
      border-radius: 10px;        /* Slightly rounded square */
      cursor: pointer;
      margin-top: -16px;          /* Centers it on the track */
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

    .setting-checkbox {
      margin-left: 12px;
    }

    /* Button Hover */
    button:hover {
      transform: scale(1.05);
      color: #ffea80 !important;
    }

    .gd-menu-settings-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      pointer-events: auto;
      z-index: 2147483646;
      background: rgba(0, 0, 0, 0.28);
      --modal-panel-gap: 12px;
      --modal-panel-padding: 20px 24px;
      --modal-section-gap: 8px;
      --modal-section-padding: 10px 12px;
      --modal-row-height: 36px;
      --modal-row-gap: 12px;
      --modal-label-size: 18px;
      --modal-control-size: 15px;
      --modal-control-height: 36px;
      --modal-section-title-size: 17px;
      --modal-title-size: clamp(26px, 4.5vh, 38px);
    }

    .gd-menu-settings-overlay[data-ui-scale="compact"] {
      --modal-panel-gap: 8px;
      --modal-panel-padding: 14px 18px;
      --modal-section-gap: 6px;
      --modal-section-padding: 7px 10px;
      --modal-row-height: 30px;
      --modal-row-gap: 10px;
      --modal-label-size: 13px;
      --modal-control-size: 13px;
      --modal-control-height: 30px;
      --modal-section-title-size: 14px;
      --modal-title-size: clamp(20px, 3.5vh, 32px);
    }

    .gd-menu-settings-overlay[data-ui-scale="large"] {
      --modal-panel-gap: 16px;
      --modal-panel-padding: 24px 28px;
      --modal-section-gap: 12px;
      --modal-section-padding: 14px 16px;
      --modal-row-height: 44px;
      --modal-row-gap: 16px;
      --modal-label-size: 20px;
      --modal-control-size: 20px;
      --modal-control-height: 44px;
      --modal-section-title-size: 22px;
      --modal-title-size: clamp(32px, 5.5vh, 48px);
    }

    .gd-menu-settings-panel {
      width: min(760px, calc(100vw - 48px));
      max-height: calc(100vh - 80px);
      display: flex;
      flex-direction: column;
      gap: var(--modal-panel-gap);
      padding: var(--modal-panel-padding);
      color: #f5f2e6;
      background-color: rgba(10, 10, 14, 0.94);
      background-image: url("assets/1-Background/1-Menu/Settings_Background.png");
      background-size: cover;
      background-position: center;
      border: 4px solid rgba(184,134,11,0.82);
      border-radius: 8px;
      box-shadow: 0 22px 70px rgba(0,0,0,0.85), inset 0 0 0 2px rgba(255,204,0,0.12);
      pointer-events: auto;
      overflow: hidden;
    }

    .gd-menu-settings-title {
      flex: 0 0 auto;
      text-align: center;
      color: #ffd678;
      font-size: var(--modal-title-size);
      line-height: 1;
      text-shadow: 0 3px 0 #000, 0 0 14px rgba(255,204,0,0.32);
    }

    .gd-menu-settings-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 2px 6px 16px 2px;
      scrollbar-width: thin;
      scrollbar-color: #ffcc00 rgba(0,0,0,0.35);
    }

    .gd-menu-settings-body::-webkit-scrollbar { width: 8px; }
    .gd-menu-settings-body::-webkit-scrollbar-thumb {
      background: #ffcc00;
      border-radius: 2px;
    }

    .gd-menu-settings-section {
      display: flex;
      flex-direction: column;
      gap: var(--modal-section-gap);
      padding: var(--modal-section-padding);
      background: rgba(0,0,0,0.32);
      border: 2px solid rgba(184,134,11,0.45);
      border-radius: 6px;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
    }

    .gd-menu-settings-section-title {
      color: #ffd678;
      font-size: var(--modal-section-title-size);
      line-height: 1;
      text-shadow: 0 2px 0 #000;
    }

    .gd-menu-settings-row {
      display: grid;
      grid-template-columns: minmax(150px, 0.8fr) minmax(220px, 1.2fr);
      align-items: center;
      gap: var(--modal-row-gap);
      min-height: var(--modal-row-height);
    }

    .gd-menu-settings-label {
      color: #f5f2e6;
      font-size: var(--modal-label-size);
      line-height: 1.15;
      text-align: left;
      text-shadow: 0 2px 0 #000;
      overflow-wrap: anywhere;
    }

    .gd-menu-settings-control {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      min-width: 0;
    }

    .gd-menu-select,
    .gd-menu-key-button,
    .gd-menu-toggle,
    .gd-menu-panel-button,
    .gd-menu-segment {
      min-height: var(--modal-control-height);
      color: #fff;
      background: rgba(28, 28, 34, 0.94);
      border: 2px solid rgba(184,134,11,0.82);
      border-radius: 4px;
      text-shadow: 0 2px 0 #000;
      box-shadow: 0 6px 16px rgba(0,0,0,0.45);
      cursor: pointer;
    }

    .gd-menu-select {
      width: min(300px, 100%);
      padding: 0 12px;
      font-size: var(--modal-control-size);
    }

    .gd-menu-toggle {
      width: 86px;
      font-size: var(--modal-control-size);
      letter-spacing: 0;
    }

    .gd-menu-toggle[data-enabled="true"],
    .gd-menu-segment[data-active="true"] {
      color: #17120a !important;
      background: #ffcc00;
      border-color: #fff0a8;
      text-shadow: none;
    }

    .gd-menu-slider-wrap {
      width: min(330px, 100%);
      display: grid;
      grid-template-columns: minmax(120px, 1fr) 58px;
      align-items: center;
      gap: 12px;
    }

    .gd-menu-slider {
      width: 100%;
      min-width: 0;
    }

    .gd-menu-slider-value {
      color: #ffd678;
      font-size: 14px;
      text-align: right;
      text-shadow: 0 2px 0 #000;
    }

    .gd-menu-segmented {
      width: min(330px, 100%);
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .gd-menu-segment {
      width: 100%;
      font-size: var(--modal-control-size);
      padding: 0 8px;
    }

    .gd-menu-key-button {
      width: min(220px, 100%);
      font-size: var(--modal-control-size);
      padding: 0 10px;
    }

    .gd-menu-settings-footer {
      flex: 0 0 auto;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 14px;
      padding-top: 4px;
    }

    .gd-menu-panel-button {
      width: min(220px, 42vw);
      font-size: var(--modal-control-size);
      padding: 0 14px;
    }

    .gd-menu-panel-button-secondary {
      border-color: rgba(255,214,120,0.72);
    }

    .gd-menu-select:focus,
    .gd-menu-key-button:focus,
    .gd-menu-toggle:focus,
    .gd-menu-panel-button:focus,
    .gd-menu-segment:focus {
      outline: 2px solid #fff0a8;
      outline-offset: 2px;
    }

    @media (max-width: 680px) {
      .gd-menu-settings-panel {
        width: calc(100vw - 24px);
        max-height: calc(100vh - 24px);
        padding: 18px;
      }

      .gd-menu-settings-row {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .gd-menu-settings-control {
        justify-content: stretch;
      }

      .gd-menu-select,
      .gd-menu-slider-wrap,
      .gd-menu-segmented,
      .gd-menu-key-button {
        width: 100%;
      }

      .gd-menu-settings-footer {
        flex-direction: column-reverse;
        align-items: stretch;
      }

      .gd-menu-panel-button {
        width: 100%;
      }
    }

    /* Terminal Styles */
    #game-terminal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 700px;
        height: 450px;
        background: rgba(15, 15, 20, 0.98);
        border: 3px solid #ffcc00;
        box-shadow: 0 0 30px rgba(0,0,0,0.9), inset 0 0 15px rgba(255,204,0,0.1);
        padding: 0;
        display: flex;
        flex-direction: column;
        font-family: 'MyFont', Courier, monospace;
        color: white;
        z-index: 20000;
        pointer-events: auto;
        border-radius: 8px;
        overflow: hidden;
    }
    #terminal-header {
        background: #ffcc00;
        color: #000;
        padding: 8px 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: bold;
        letter-spacing: 1px;
        font-size: 14px;
    }
    #terminal-close {
        opacity: 0.7;
        font-size: 12px;
    }
    #terminal-history {
        flex: 1;
        overflow-y: auto;
        margin: 0;
        padding: 20px;
        scrollbar-width: thin;
        scrollbar-color: #ffcc00 transparent;
        font-size: 16px;
        line-height: 1.4;
    }
    #terminal-history::-webkit-scrollbar { width: 6px; }
    #terminal-history::-webkit-scrollbar-thumb { background: #ffcc00; border-radius: 3px; }

    #terminal-input-row {
        display: flex;
        align-items: center;
        border-top: 2px solid rgba(255,204,0,0.3);
        padding: 15px 20px;
        background: rgba(0,0,0,0.3);
    }
    #terminal-prompt {
        margin-right: 12px;
        font-weight: bold;
        color: #ffcc00;
        font-size: 20px;
    }
    #terminal-input {
        background: transparent;
        border: none;
        color: white;
        font-family: 'MyFont', monospace;
        font-size: 18px;
        width: 100%;
        outline: none;
    }
    #terminal-input::placeholder {
        color: rgba(255,255,255,0.2);
    }
    .terminal-log { margin-bottom: 6px; color: rgba(255,255,255,0.9); }
    .terminal-success { margin-bottom: 6px; color: #ffff00; font-weight: bold; text-shadow: 0 0 5px rgba(255,255,0,0.3); }
    .terminal-error { margin-bottom: 6px; color: #ff4444; font-weight: bold; }
    .terminal-input-echo { margin-bottom: 6px; color: #ffcc00; opacity: 0.8; }
  `);

  style.id = 'custom-menu-styles';
  style.parent(document.head);
}
