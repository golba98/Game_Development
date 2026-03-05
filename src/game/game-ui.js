// game-ui.js — In-game menus, transitions, victory/game-over, audio helpers
// Extracted from 4-Game.js

// --- UI Layout Constants ---
const MENU_PANEL_W          = 420;  // px width of standard in-game overlay panels
const MENU_PANEL_H          = 320;  // px height of standard in-game overlay panels
const MENU_TITLE_OFFSET_PX  = -100; // px above the panel top where the title is positioned
const MENU_TITLE_FONT_SIZE  = '48px';
const MENU_BTN_W            = 260;  // px width of menu buttons
const MENU_BTN_H            = 48;   // px height of menu buttons
const MENU_BTN_MARGIN_PX    = '20px';
const MENU_MSG_FONT_SIZE    = '20px';
const MENU_MSG_MARGIN_PX    = '30px';
const TRANSITION_FADE_SPEED = 4;    // alpha units added per frame during level transition
const TRANSITION_HOLD_MS    = 500;  // ms held at full black before resuming

// Appends a styled title div above a panel. Shared by pause/victory/game-over screens.
function _addPanelTitle(panel, text) {
  const title = createDiv(text);
  title.parent(panel);
  title.style('position',    'absolute');
  title.style('width',       '100%');
  title.style('text-align',  'center');
  title.style('top',         MENU_TITLE_OFFSET_PX + 'px');
  title.style('left',        '0');
  title.style('font-size',   MENU_TITLE_FONT_SIZE);
  title.style('font-weight', 'bold');
  title.style('color',       '#000');
  title.style('text-shadow', 'none');
  return title;
}

// Creates a styled menu button and attaches it to the panel.
function _addMenuBtn(panel, label, onClick) {
  const btn = createButton(label);
  btn.parent(panel);
  btn.style('margin-bottom', MENU_BTN_MARGIN_PX);
  applyMenuButtonUI(btn, MENU_BTN_W, MENU_BTN_H);
  btn.mousePressed(onClick);
  return btn;
}

// Opens the pause menu overlay.
function openInGameMenu() {
  if (inGameMenuOverlay) {
    inGameMenuOverlay.close();
    inGameMenuOverlay = null;
  }
  try { loadLocalSettings(); } catch (e) {}
  try { applyCurrentTextSize(); } catch (e) {}
  inGameMenuVisible = true;

  const { panel, close } = createZoomStablePanel(MENU_PANEL_W, MENU_PANEL_H, 'gd-ingame-menu');
  inGameMenuOverlay = { close };
  _addPanelTitle(panel, t('paused'));

  _addMenuBtn(panel, t('resume'), () => closeInGameMenu());
  _addMenuBtn(panel, t('settings'), () => {
    inGameMenuOverlay.close();
    inGameMenuOverlay = null;
    openInGameSettings({ masterVol, musicVol, sfxVol, difficulty: currentDifficulty });
  });
  _addMenuBtn(panel, t('exit'), () => {
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'close-game-overlay' }, '*'); } catch (e) {}
  });
}

// Closes the pause menu overlay and restores focus.
function closeInGameMenu() {
  if (inGameMenuOverlay) {
    inGameMenuOverlay.close();
    inGameMenuOverlay = null;
  }
  inGameMenuVisible = false;
  try { if (typeof applyCurrentTextSize === 'function') applyCurrentTextSize(); } catch (e) {}
}

// Starts the level-transition fade-to-black sequence.
function startLevelTransition() {
  if (isTransitioning) return;
  isTransitioning = true;
  transitionAlpha = 0;
  try { showToast(t('level_clear', currentLevel, currentLevel + 1), 'info', 4000); } catch (e) {}
}

// Drives the fade-out → world-swap → resume cycle each frame while transitioning.
function handleTransitionLogic() {
  if (!isTransitioning) return;
  const dt = gameDelta;

  if (transitionAlpha < 255) {
    transitionAlpha = Math.min(255, transitionAlpha + TRANSITION_FADE_SPEED);
    if (transitionAlpha === 255) {
      // At peak blackout: advance the world, then release after a brief hold
      currentLevel++;
      generateMap();
      playerHealth = maxHealth;
      isPortalActive = false;
      victoryShown = false;
    }
  } else {
    setTimeout(() => { isTransitioning = false; }, TRANSITION_HOLD_MS);
  }
}

// Triggers the game-over state and shows the game-over screen (no-op if already dead).
function triggerGameOver() {
  if (isGameOver) return;
  isGameOver = true;
  showGameOverScreen();
}

// Returns true if any COIN tile is still present on the current map.
function hasAnyCoins() {
  if (!mapStates) return false;
  for (let i = 0; i < mapStates.length; i++) {
    if (mapStates[i] === TILE_TYPES.COIN) return true;
  }
  return false;
}

// Marks the map as won and locks movement before showing the victory screen.
function triggerVictory() {
  if (victoryShown) return;
  victoryShown = true;
  isPortalActive = true;
  isMoving = false;
  queuedMove = null;
  prevKeyA = prevKeyD = prevKeyW = prevKeyS = false;
  if (holdState) {
    holdState.A.start = holdState.D.start = holdState.W.start = holdState.S.start = 0;
  }
  showVictoryScreen();
}

// Shows the victory overlay with the player's final score.
function showVictoryScreen() {
  if (victoryOverlay) {
    victoryOverlay.close();
    victoryOverlay = null;
  }
  const { panel, close } = createZoomStablePanel(MENU_PANEL_W, MENU_PANEL_H, 'gd-victory-menu');
  victoryOverlay = { close };
  _addPanelTitle(panel, t('victory'));

  const msg = createDiv(t('victory_msg', playerScore));
  msg.parent(panel);
  msg.style('text-align',   'center');
  msg.style('margin-bottom', MENU_MSG_MARGIN_PX);
  msg.style('font-size',     MENU_MSG_FONT_SIZE);
  msg.style('color',         '#fff');

  _addMenuBtn(panel, t('continue_btn'), () => {
    if (victoryOverlay) {
      victoryOverlay.close();
      victoryOverlay = null;
    }
  });
}

// Shows the game-over overlay with restart and exit-to-menu options.
function showGameOverScreen() {
  if (gameOverOverlay) {
    gameOverOverlay.close();
    gameOverOverlay = null;
  }
  const { panel, close } = createZoomStablePanel(MENU_PANEL_W, MENU_PANEL_H, 'gd-gameover-menu');
  gameOverOverlay = { close };
  _addPanelTitle(panel, t('game_over'));

  const msg = createDiv(t('gameover_msg', playerScore));
  msg.parent(panel);
  msg.style('text-align',    'center');
  msg.style('margin-bottom', MENU_MSG_MARGIN_PX);
  msg.style('font-size',     MENU_MSG_FONT_SIZE);
  msg.style('color',         '#fff');

  _addMenuBtn(panel, t('restart'),      () => restartGame());
  _addMenuBtn(panel, t('exit_to_menu'), () => exitToMenu());
}

// Resets game-over state and re-spawns all enemies at their initial positions.
function restartGame() {
  if (gameOverOverlay) {
    gameOverOverlay.close();
    gameOverOverlay = null;
  }
  isGameOver = false;
  playerHealth = maxHealth;

  if (initialSpawnPosition) {
    playerPosition = { x: initialSpawnPosition.x, y: initialSpawnPosition.y };
    renderX = playerPosition.x;
    renderY = playerPosition.y;
    renderStartX = renderX;
    renderStartY = renderY;
    renderTargetX = renderX;
    renderTargetY = renderY;
    isMoving = false;
  }

  projectiles = [];
  if (initialEnemies && initialEnemies.length > 0) {
    enemies = [];
    for (const e of initialEnemies) spawnEnemy(e.type, e.x, e.y);
  }
  try { if (typeof applyCurrentTextSize === 'function') applyCurrentTextSize(); } catch (e) {}
}

// Navigates back to the main menu (or closes the game overlay if embedded).
function exitToMenu() {
  try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'close-game-overlay' }, '*'); } catch (e) {}
  window.location.href = '1-Menu_Index.html';
}

// No-op stub: in-game menu is now rendered via DOM overlay (drawInGameMenu_OLD removed).
function drawInGameMenu() { return; }

// Starts game music playback once the AudioContext is unlocked.
function attemptStartGameMusic(reason = 'unknown') {
  if (!pendingGameMusicStart || gameMusicStarted || !gameMusic) return;
  verboseLog(`[game] attemptStartGameMusic reason=${reason}`);

  const startPlayback = () => {
    if (gameMusicStarted || !gameMusic) return;
    try { gameMusic.setVolume(musicVol * masterVol); } catch (e) {}
    try {
      if      (typeof gameMusic.loop  === 'function') gameMusic.loop();
      else if (typeof gameMusic.play  === 'function') gameMusic.play();
      else { console.warn('[game] gameMusic has no loop/play'); return; }
      gameMusicStarted = true;
      pendingGameMusicStart = false;
      verboseLog('[game] gameMusic playback started');
    } catch (startErr) { console.warn('[game] startPlayback failed', startErr); }
  };

  const tryResumeAudioContext = () => {
    if (typeof getAudioContext !== 'function') return false;
    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state === 'running') return false;
      const resumeResult = ctx.resume?.();
      if (resumeResult && typeof resumeResult.then === 'function') {
        resumeResult
          .then(() => { verboseLog('[game] AudioContext.resume resolved'); startPlayback(); })
          .catch(() => startPlayback());
        return true;
      }
    } catch (e) { console.warn('[game] tryResumeAudioContext threw', e); }
    return false;
  };

  if (typeof userStartAudio === 'function') {
    try {
      const maybePromise = userStartAudio();
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise
          .then(() => { verboseLog('[game] userStartAudio resolved'); startPlayback(); })
          .catch(() => { if (!tryResumeAudioContext()) startPlayback(); });
        return;
      }
    } catch (e) { console.warn('[game] userStartAudio threw', e); }
  }
  if (tryResumeAudioContext()) return;
  startPlayback();
}

// Plays the UI click sound effect at the current volume.
function playClickSFX() {
  if (clickSFX) {
    clickSFX.setVolume(sfxVol * masterVol);
    clickSFX.play();
  }
}

// Unlocks the AudioContext on first user interaction then starts the menu music.
function unlockAudioAndStart(cb) {
  if (audioUnlocked) { cb?.(); return; }
  const afterUnlock = () => {
    audioUnlocked = true;
    startMenuMusicIfNeeded();
    cb?.();
  };
  try {
    if (typeof userStartAudio === 'function') {
      userStartAudio()
        .then(afterUnlock)
        .catch(() => {
          try { getAudioContext().resume().then(afterUnlock).catch(afterUnlock); }
          catch (e) { afterUnlock(); }
        });
    } else {
      try { getAudioContext().resume(); } catch (e) {}
      afterUnlock();
    }
  } catch (e) { afterUnlock(); }
}

// Starts or resumes the background menu music once audio is unlocked.
function startMenuMusicIfNeeded() {
  if (!bgMusic) { console.warn('[startMenuMusicIfNeeded] bgMusic not loaded yet'); return; }
  try {
    if (typeof bgMusic.setVolume === 'function') bgMusic.setVolume(musicVol * masterVol);
    if (typeof bgMusic.isPlaying === 'function') {
      if (!bgMusic.isPlaying()) { bgMusic.loop(); verboseLog('[startMenuMusicIfNeeded] bgMusic.loop() called'); }
    } else if (typeof bgMusic.loop === 'function') {
      bgMusic.loop(); verboseLog('[startMenuMusicIfNeeded] bgMusic.loop() fallback called');
    } else if (typeof bgMusic.play === 'function') {
      bgMusic.play(); verboseLog('[startMenuMusicIfNeeded] bgMusic.play() fallback called');
    }
  } catch (err) { console.warn('[startMenuMusicIfNeeded] playback error', err); }
}

// Applies transparent-background styling to a small icon button.
function styleSmallButton(btn) {
  btn.style('background',   'transparent');
  btn.style('border',       'none');
  btn.style('cursor',       'pointer');
  btn.style('color',        'white');
  btn.style('text-shadow',  '0 0 8px #ffffff60');
  btn.style('border-radius','2px');
  if (btn.elt) {
    btn.elt.style.position = 'absolute';
    btn.style('background-image', `url('${MENU_BUTTON_TEXTURE_PATH}')`);
    btn.elt.style.zIndex = '10001';
  }
}

// Creates or resizes the off-screen buffer used to freeze the frame during noLoop() pauses.
function ensureLoopFallbackBuffer() {
  if (!loopFallbackBuffer || loopFallbackBuffer.width !== width || loopFallbackBuffer.height !== height) {
    if (loopFallbackBuffer && typeof loopFallbackBuffer.remove === 'function') {
      try { loopFallbackBuffer.remove(); } catch (e) {}
    }
    loopFallbackBuffer = createGraphics(width, height);
    enforceCanvasSharpness(loopFallbackBuffer.drawingContext);
    loopFallbackBuffer.noSmooth();
  }
}

// Displays a temporary toast notification in the top-right corner.
function showToast(message, type = 'info', duration = 3000) {
  try {
    if (typeof document === 'undefined') return;
    const id = 'game-toast-overlay';
    let container = document.getElementById(id);
    if (!container) {
      container = document.createElement('div');
      container.id = id;
      container.style.position      = 'fixed';
      container.style.right         = '18px';
      container.style.top           = '18px';
      container.style.zIndex        = 99999;
      container.style.display       = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap           = '8px';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className    = 'game-toast ' + String(type || 'info');
    el.style.minWidth    = '180px';
    el.style.maxWidth    = '420px';
    el.style.background  = type === 'error' ? '#7b1e1e' : (type === 'warn' ? '#8a6d1f' : '#1f6f8f');
    el.style.color       = '#fff';
    el.style.padding     = '10px 12px';
    el.style.borderRadius= '8px';
    el.style.boxShadow   = '0 6px 18px rgba(0,0,0,0.35)';
    el.style.fontFamily  = 'Arial, sans-serif';
    el.style.fontSize    = '13px';
    el.style.opacity     = '0';
    el.style.transition  = 'opacity 220ms ease, transform 220ms ease';
    el.style.transform   = 'translateY(-6px)';
    el.textContent = message;
    container.appendChild(el);

    void el.offsetWidth; // force reflow so the transition fires
    el.style.opacity   = '1';
    el.style.transform = 'translateY(0)';

    const dismiss = () => {
      try {
        el.style.opacity   = '0';
        el.style.transform = 'translateY(-6px)';
        setTimeout(() => { try { el.parentNode?.removeChild(el); } catch (e) {} }, 240);
      } catch (e) {}
    };
    const timeout = setTimeout(dismiss, duration || 3000);
    el.addEventListener('click', () => { clearTimeout(timeout); dismiss(); });
  } catch (err) {
    console.warn('[game] showToast failed', err);
  }
}


// ── Error display helper ──
(function () {
  function ensureError1El() {
    let el = document.getElementById('error1');
    if (!el) {
      el = document.createElement('div');
      el.id = 'error1';
      Object.assign(el.style, {
        position: 'fixed', right: '12px', bottom: '12px',
        background: 'rgba(220,20,60,0.95)', color: '#fff',
        padding: '10px 14px', borderRadius: '6px',
        zIndex: 9999, fontFamily: 'sans-serif', fontSize: '14px',
        display: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.4)'
      });
      if (document.body) document.body.appendChild(el);
      else document.addEventListener('DOMContentLoaded', () => { try { document.body.appendChild(el); } catch (e) {} });
    }
    return el;
  }

  function showError1(name) {
    const el = ensureError1El();
    let msg = 'Error 1: Has no functionality yet will be added later';
    try { if (name) { const s = String(name).trim(); if (s) msg += ' (' + s + ')'; } } catch (e) {}
    el.textContent = msg;
    el.style.display = 'block';
    try { clearTimeout(el.__hideTimeout); } catch (e) {}
    el.__hideTimeout = setTimeout(() => { try { el.style.display = 'none'; } catch (e) {} }, 5000);
    console.warn(msg);
  }

  const combinedSelector = '#showTutorials, input[name="showTutorials"], .show-tutorials, #ShowTutorials, #enabledHub, input[name="enabledHub"], .enabled-hub, #EnabledHub, #enabledHUB';
  const delegatedHandler = (e) => {
    try {
      const t = e.target;
      if (!t) return;
      if (typeof t.matches === 'function' && t.matches(combinedSelector)) { showError1(); return; }
      if (t.closest?.(combinedSelector)) showError1();
    } catch (e) {}
  };
  document.addEventListener('change', delegatedHandler, true);
  document.addEventListener('input',  delegatedHandler, true);
  try { window.showError1 = showError1; } catch (e) {}
})();


// ── Audio unlock on first interaction ──
['pointerdown', 'keydown'].forEach((evt) => {
  window.addEventListener(evt, () => {
    if (pendingGameMusicStart && !gameMusicStarted) attemptStartGameMusic(`user-${evt}`);
  });
});


// Opens a settings sub-panel for the given category label.
function showSubSettings(label) {
  clearSubSettings();

  const cx = width / 2, cy = height / 2;
  const panelW = 0.7 * width, panelH = 0.7 * height;
  const panelLeft = cx - panelW / 2, panelRight = cx + panelW / 2;
  const paddingX = panelW * 0.08;
  const labelX   = panelLeft + paddingX;
  const controlX = panelLeft + panelW * 0.42;
  const controlWidth = panelRight - paddingX - controlX;
  const spacingY = panelH * 0.14;

  const ctx = createSettingsContext({
    labelX, controlX, controlWidth, panelH,
    startY: cy - panelH / 2 + panelH * 0.18,
    spacingY
  });

  const builder = CATEGORY_BUILDERS[label];
  if (builder) builder(ctx);

  const backY     = cy + panelH / 2 - panelH * 0.12;
  const backWidth = panelW * 0.3;
  const backBG  = createBgImg('assets/3-GUI/Button_BG.png', cx - backWidth / 2, backY - BACK_BUTTON_VERTICAL_OFFSET, backWidth, panelH * 0.08, '3');
  const backBtn = makeSmallBtn('← Back', cx - backWidth / 2, backY - BACK_BUTTON_VERTICAL_OFFSET, backWidth, panelH * 0.08, () => {
    playClickSFX(); clearSubSettings(); showSettingsMenu();
  });
  activeSettingElements.push(backBG, backBtn);
  applyCurrentTextSize();
}


try {
  ensureLoadingOverlayDom();
  overlayMessage = 'Loading assets...';
  updateLoadingOverlayDom();
} catch (e) {}
