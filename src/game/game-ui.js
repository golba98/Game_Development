// game-ui.js — In-game menus, transitions, victory/game-over, audio helpers
// Extracted from 4-Game.js

// --- UI Layout Constants ---
const MENU_PANEL_W          = 420;  // px width of standard in-game overlay panels
const MENU_PANEL_H          = 320;  // px height of standard in-game overlay panels
const MENU_TITLE_FONT_SIZE  = '38px';
const MENU_BTN_W            = 260;  // px width of menu buttons
const MENU_BTN_H            = 48;   // px height of menu buttons
const MENU_BTN_MARGIN_PX    = '20px';
const MENU_MSG_FONT_SIZE    = '20px';
const MENU_MSG_MARGIN_PX    = '30px';
const TRANSITION_FADE_SPEED = 4;    // alpha units added per frame during level transition
const TRANSITION_HOLD_MS    = 500;  // ms held at full black before resuming

// Appends a readable title inside the themed panel.
function _addPanelTitle(panel, text) {
  const title = createDiv(text);
  title.parent(panel);
  title.style('width',       '100%');
  title.style('text-align',  'center');
  title.style('font-size',   MENU_TITLE_FONT_SIZE);
  title.style('font-weight', 'bold');
  title.style('color',       'var(--gd-overlay-title, #fff)');
  title.style('text-shadow', 'var(--gd-overlay-title-shadow, 0 2px 0 #000)');
  title.style('margin-bottom', '28px');
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
    exitToMenu();
  });
}

// Closes the pause menu overlay and restores focus.
function closeInGameMenu() {
  if (typeof characterMenuOverlay !== 'undefined' && characterMenuOverlay) {
    characterMenuOverlay.close();
    return;
  }
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

  // Clear all movement state so no stale move from before death fires post-respawn
  queuedMove = null;
  isMoving = false;
  prevKeyA = false;
  prevKeyD = false;
  prevKeyW = false;
  prevKeyS = false;
  if (holdState) {
    holdState.A.start = 0; holdState.A.last = 0;
    holdState.D.start = 0; holdState.D.last = 0;
    holdState.W.start = 0; holdState.W.last = 0;
    holdState.S.start = 0; holdState.S.last = 0;
  }

  if (initialSpawnPosition) {
    playerPosition = { x: initialSpawnPosition.x, y: initialSpawnPosition.y };
    renderX = playerPosition.x;
    renderY = playerPosition.y;
    renderStartX = renderX;
    renderStartY = renderY;
    renderTargetX = renderX;
    renderTargetY = renderY;
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
  if (window.parent && window.parent !== window) {
    try {
      if (window.parent.location.origin === window.location.origin && typeof window.parent.removeGameOverlay === 'function') {
        window.parent.removeGameOverlay();
        return;
      }
    } catch (e) {}
    try {
      window.parent.postMessage({ type: 'close-game-overlay' }, window.location.origin);
      return;
    } catch (e) {}
  }
  window.location.replace('menu.html');
}

// Night ghosts are optional encounters and never block level completion.
function hasRemainingVictoryEnemies() {
  return Array.isArray(enemies) && enemies.some(enemy => enemy && enemy.type !== 'ghost');
}

let characterMenuOverlay = null;

function openCharacterMenu() {
  if (characterMenuOverlay) {
    characterMenuOverlay.close();
    return;
  }
  if (inGameMenuVisible || isGameOver) return;

  inGameMenuVisible = true;
  const { panel, close } = createZoomStablePanel(450, 440, 'gd-character-menu');
  characterMenuOverlay = { close: () => { close(); characterMenuOverlay = null; inGameMenuVisible = false; } };
  _addPanelTitle(panel, 'CHARACTER STATS');

  const content = createDiv('');
  content.parent(panel);
  content.style('width', '80%');
  content.style('color', 'var(--gd-panel-text, #fff2cc)');
  content.style('font-family', 'Arial, sans-serif');

  const addStatRow = (label, value, onUpgrade) => {
    const row = createDiv('');
    row.parent(content);
    row.style('width', '100%');
    row.style('display', 'flex');
    row.style('justify-content', 'space-between');
    row.style('align-items', 'center');
    row.style('margin-bottom', '10px');
    createSpan(label).parent(row);
    const valueGroup = createDiv('');
    valueGroup.parent(row);
    valueGroup.style('display', 'flex');
    valueGroup.style('gap', '10px');
    valueGroup.style('align-items', 'center');
    createSpan(String(value)).parent(valueGroup);
    if (statPoints <= 0 || !onUpgrade) return;
    const button = createButton('+');
    button.parent(valueGroup);
    button.style('padding', '2px 8px');
    button.style('cursor', 'pointer');
    button.style('background', '#2a2a2a');
    button.style('color', '#ffd700');
    button.style('border', '1px solid #ffd700');
    button.mousePressed(() => {
      onUpgrade();
      try { playClickSFX(); } catch (e) {}
      characterMenuOverlay.close();
      openCharacterMenu();
    });
  };

  addStatRow('LEVEL', playerLevel);
  addStatRow('XP', `${Math.floor(playerXP)} / ${xpToNextLevel}`);
  addStatRow('STATS AVAILABLE', statPoints);
  addStatRow('MAX HEALTH', maxHealth, () => {
    if (maxHealth >= 20) { showToast('Maximum Health Reached (20)!', 'warn'); return; }
    maxHealth++; playerHealth++; statPoints--;
  });
  addStatRow('BASE DAMAGE', playerBaseDamage, () => { playerBaseDamage++; statPoints--; });
  addStatRow('MAX MANA', maxMana, () => { maxMana += 25; playerMana += 25; statPoints--; });
  addStatRow('STAMINA', playerMaxStamina, () => { playerMaxStamina += 20; statPoints--; });

  const closeBtn = _addMenuBtn(panel, 'CLOSE', () => {
    characterMenuOverlay.close();
  });
  closeBtn.style('margin-top', '18px');
}

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

// Displays a centred, non-blocking phase title while the lighting continues to
// crossfade underneath it. Reusing one node prevents stacked banners after lag.
function showTimeTransition(title, subtitle, phase = 'day') {
  try {
    const old = document.getElementById('game-time-transition');
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = 'game-time-transition';
    el.dataset.phase = phase;
    el.style.cssText = [
      'position:fixed', 'top:13%', 'left:50%', 'z-index:99990',
      'transform:translate(-50%,-12px)', 'pointer-events:none',
      'min-width:min(420px,72vw)', 'padding:12px 24px', 'text-align:center',
      'font-family:PixelGameFont,monospace', 'border:2px solid rgba(255,214,120,.75)',
      'border-radius:4px', 'background:rgba(5,8,18,.82)',
      'box-shadow:0 12px 34px rgba(0,0,0,.65),inset 0 0 18px rgba(90,130,255,.12)',
      'opacity:0', 'transition:opacity .6s ease,transform .6s ease'
    ].join(';');

    const colors = { dusk: '#ffbd73', night: '#a9c8ff', dawn: '#ffe0a3', day: '#fff4bd' };
    const heading = document.createElement('div');
    heading.textContent = title;
    heading.style.cssText = `color:${colors[phase] || colors.day};font-size:clamp(20px,3vw,34px);text-shadow:0 3px 0 #000;letter-spacing:1px`;
    const detail = document.createElement('div');
    detail.textContent = subtitle;
    detail.style.cssText = 'margin-top:6px;color:#f5f2e6;font-size:clamp(10px,1.4vw,14px);text-shadow:0 2px 0 #000';
    el.append(heading, detail);
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,0)';
    });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-12px)';
      setTimeout(() => el.remove(), 650);
    }, 3000);
  } catch (error) {
    console.warn('[game] time transition UI failed', error);
  }
}


// ── Audio unlock on first interaction ──
['pointerdown', 'keydown'].forEach((evt) => {
  window.addEventListener(evt, () => {
    if (pendingGameMusicStart && !gameMusicStarted) attemptStartGameMusic(`user-${evt}`);
  });
});


try {
  ensureLoadingOverlayDom();
  overlayMessage = 'Loading assets...';
  updateLoadingOverlayDom();
} catch (e) {}
