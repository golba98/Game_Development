// === Lifecycle / Setup / Rendering ===
function preload() {
  rectSkin = loadImage("assets/1-Background/1-Menu/Settings_Background.png");
  myFont   = loadFont("assets/3-GUI/font.ttf");
  bgVideo  = createVideo(MENU_VIDEO_PATH);
  bgMusic      = loadSound('assets/8-Music/menu_music.wav');
  clickSFX     = loadSound('assets/9-Sounds/Button_Press.mp3');
  bgPlayButton = loadImage('assets/1-Background/1-Menu/Background.png');
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.style('z-index', '1');

  canvas.style('pointer-events', 'none');

  textFont(myFont);
  noStroke();

  loadAllSettings();
  injectCustomStyles();

  videoBuffer = createGraphics(width, height);
  initializeMenuBackgroundVideo(bgVideo);

  applyVolumes();
  startMenuMusicIfNeeded();
  const resumeOnFirstGesture = () => {
    try {
      console.log('[setup] first user gesture detected — attempting to unlock audio and start music');
      unlockAudioAndStart(() => {
        startMenuMusicIfNeeded();
      });
    } catch (e) {
      console.warn('[setup] resumeOnFirstGesture failed', e);
    }
  };
  window.addEventListener('pointerdown', resumeOnFirstGesture, { once: true });
  window.addEventListener('keydown', resumeOnFirstGesture, { once: true });
  calculateLayout();
  createMainMenu();
  installMenuZoomLogger();

  try {
    const ac = typeof getAudioContext === 'function' ? getAudioContext() : null;
    if (ac?.suspend) ac.suspend();
  } catch (e) {}
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
              type: 'update-audio-settings',
              masterVol, musicVol, sfxVol,
              difficulty: difficultySetting
            }, '*');
          }
        } catch (e) {}
      }

      else if (ev.data.type === 'sync-settings') {
        console.log('[menu] received settings sync from game', ev.data);


        if (typeof ev.data.masterVol === 'number') masterVol = ev.data.masterVol;
        if (typeof ev.data.musicVol === 'number') musicVol = ev.data.musicVol;
        if (typeof ev.data.sfxVol === 'number') sfxVol = ev.data.sfxVol;
        if (typeof ev.data.difficulty === 'string') difficultySetting = ev.data.difficulty;


        applyVolumes();


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

// === Draw / Render Loop ===
function draw() {
  if (inGame) return;

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

  if (showingSettings) {
    const cx = width / 2;
    const cy = height / 2;
    let panelW = 0.7 * width;
    let panelH = 0.7 * height;

    if (activeCategory === 'Controls') {
      panelW = 0.8 * width;
      panelH = 0.85 * height;
    }

    push();
    imageMode(CENTER);
    tint(255, 220);
    image(rectSkin, cx, cy, panelW, panelH);
    pop();

    textSize(headingFontPx || 0.055 * height);
    fill(0);
    textAlign(CENTER, TOP);
    text("Settings", cx, cy - panelH / 2 - 170);
  }

  if (fadeAlpha > 0) {
    fill(0, fadeAlpha);
    rect(0, 0, width, height);
    fadeAlpha = max(0, fadeAlpha - 10);
  }
}

// === Window / Resize Handling ===
function windowResized() {
  try { clearTimeout(_menuResizeTimer); } catch (e) {}
  _menuLastSize = { w: window.innerWidth, h: window.innerHeight };
  const vv = window.visualViewport;
  _menuResizeInitialScale = vv ? (vv.scale || 1) : 1;
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


    if (skipNextMenuReload) {
      console.log('[menu] windowResized: skipping one-time programmatic reload');
      skipNextMenuReload = false;
      return;
    }


    const vvNow = window.visualViewport;
    const currentScale = vvNow ? (vvNow.scale || 1) : 1;
    const matchesSize = (_menuLastSize.w === window.innerWidth && _menuLastSize.h === window.innerHeight);
    if (matchesSize) {
      if (Math.abs(currentScale - _menuResizeInitialScale) > 0.01) {
        console.log('[menu] resize ignored because only zoom/viewport scale changed', { oldScale: _menuResizeInitialScale, newScale: currentScale });
        return;
      }
      try {
        location.reload();
      } catch (e) {
        console.warn('[menu] failed to reload after resize', e);
      }
    } else {
      windowResized();
    }
  }, 200);
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
