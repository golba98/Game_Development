// game-io.js — Map save/load, settings persistence, server sync
// Extracted from 4-Game.js

// --- IO Tuning Constants ---
const SETTINGS_SAVE_DEBOUNCE_MS = 500; // delay before writing settings to localStorage
const AUTOSAVE_KEY              = 'autosave_map';
const SETTINGS_KEY              = SETTINGS_STORAGE_KEY;
const KEYBINDS_KEY              = 'playerKeybinds';
const SERVER_MAP_URL_ABSOLUTE   = 'http://localhost:3000/maps/active_map.json';
const SERVER_MAP_URL_RELATIVE   = '/maps/active_map.json';
const SERVER_SAVE_URL           = 'http://localhost:3000/save-map';

// Map-server access is opt-in under normal Wrangler/Cloudflare development.
// Port 3000 is the bundled map server; useServer=1 enables reads and writes;
// activeMapFetch=1 remains a read-only compatibility switch.
function getMapServerMode() {
  if (typeof window === 'undefined' || !window.location) {
    return { read: false, write: false };
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const isMapServerOrigin = window.location.port === '3000';
    const useServer = params.get('useServer') === '1';
    const fetchOnly = params.get('activeMapFetch') === '1';
    return {
      read: !!ALLOW_ACTIVE_MAP_FETCH || isMapServerOrigin || useServer || fetchOnly,
      write: isMapServerOrigin || useServer,
    };
  } catch (e) {
    return { read: !!ALLOW_ACTIVE_MAP_FETCH, write: false };
  }
}

// Serialises the current map state into a JSON-safe object for save/network transfer.
function buildActiveMapPayload() {
  try {
    if (typeof mapStates === 'undefined' || !mapStates) return null;
    return {
      persistentGameId,
      timestamp: Date.now(),
      logicalW: logicalW || Math.ceil(W / cellSize),
      logicalH: logicalH || Math.ceil(H / cellSize),
      cellSize,
      mapStates: Array.from(mapStates),
      terrainLayer: terrainLayer ? Array.from(terrainLayer) : null,
      treeObjects: Array.isArray(treeObjects) ? treeObjects.slice() : [],
      decorativeObjects: decorativeObjectsList.map(object => ({ ...object })),
      playerPosition,
      portalPos,
      isPortalActive,
      enemies: Array.isArray(enemies) ? enemies.map(e => ({
          type: e.type, x: e.x, y: e.y,
          health: e.health, maxHealth: e.maxHealth,
          direction: e.direction, moveTimer: e.moveTimer
      })) : []
    };
  } catch (err) {
    console.warn('[game] buildActiveMapPayload failed', err);
    return null;
  }
}

// Recreates live enemy objects from the serialised enemy array in a save payload.
function _deserialiseEnemies(enemyData) {
  const result = [];
  if (!Array.isArray(enemyData)) return result;
  for (const eData of enemyData) {
    let enemy = null;
    if      (eData.type === 'mantis') enemy = createMantis(eData.x, eData.y);
    else if (eData.type === 'maggot') enemy = createMaggot(eData.x, eData.y);
    else if (eData.type === 'beetle') enemy = createBeetle(eData.x, eData.y);
    if (enemy) {
      if (eData.direction)  enemy.direction  = eData.direction;
      if (eData.moveTimer)  enemy.moveTimer  = eData.moveTimer;
      if (Number.isFinite(eData.health)) enemy.health = eData.health;
      if (eData.maxHealth)  enemy.maxHealth  = eData.maxHealth;
      result.push(enemy);
    }
  }
  return result;
}

// Finds the first GRASS tile and returns its position as a portal fallback.
function _findFallbackPortalPos() {
  for (let i = 0; i < mapStates.length; i++) {
    if (mapStates[i] === TILE_TYPES.GRASS) {
      return { x: i % logicalW, y: Math.floor(i / logicalW) };
    }
  }
  return null;
}

// Resets all render-position state to match the current playerPosition.
function _resetRenderPosition() {
  renderX = playerPosition.x; renderY = playerPosition.y;
  renderStartX = renderX;     renderStartY = renderY;
  renderTargetX = renderX;    renderTargetY = renderY;
  isMoving = false;
}

// Saves the current map to localStorage and triggers a JSON file download.
function saveMap(name) {
  try {
    const payload = buildActiveMapPayload();
    if (!payload) { console.warn('[game] no map to save'); return false; }
    const key = name || ('saved_map_' + payload.timestamp);
    if (localStorageAvailable) {
      try {
        localStorage.setItem(key, JSON.stringify(payload));
        verboseLog('[game] map saved to localStorage as', key);
      } catch (err) {
        console.warn('[game] failed to save to localStorage', err);
        localStorageAvailable = false;
      }
    } else {
      console.warn('[game] localStorage unavailable, skipping save');
    }
    try { showToast(t('map_saved'), 'info', 2200); } catch (e) {}
    downloadMapJSON(payload, key + '.json');
    persistActiveMapToServer('manual-save');
    return true;
  } catch (err) {
    console.error('[game] saveMap error', err);
    return false;
  }
}

// Triggers a browser file download of a map payload as JSON.
function downloadMapJSON(obj, filename) {
  try {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || ('map_' + Date.now() + '.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    verboseLog('[game] map download started', a.download);
  } catch (err) {
    console.error('[game] downloadMapJSON error', err);
  }
}

// Writes the current map to localStorage as 'autosave_map'; falls back to in-memory on failure.
function autosaveMap() {
  try {
    const payload = buildActiveMapPayload();
    if (!payload) { console.warn('[game] no map to autosave'); return false; }
    if (localStorageAvailable) {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
        verboseLog('[game] map autosaved to localStorage as', AUTOSAVE_KEY);
        try { showToast(t('map_autosaved'), 'info', 2200); } catch (e) {}
      } catch (err) {
        console.warn('[game] localStorage write failed; autosave not persisted', err);
        localStorageAvailable = false;
        try { showToast('Autosave failed (storage full or unavailable)', 'warn', 4200); } catch (e) {}
        return false;
      }
    } else {
      console.warn('[game] localStorage unavailable; autosave skipped');
    }
    return true;
  } catch (err) {
    console.error('[game] autosaveMap error', err);
    return false;
  }
}

// Returns true if the active-map server fetch should be attempted.
function shouldAttemptMapFetch() {
  if (typeof window === 'undefined' || !window.location) return false;
  if (window.location.protocol === 'file:') return false;
  return getMapServerMode().read;
}

// Fetches the active map from the local map server and applies it if valid.
function tryFetchActiveMap() {
  try {
    if (typeof fetch === 'undefined') return Promise.resolve(false);
    if (!shouldAttemptMapFetch()) return Promise.resolve(false);

    const url = (typeof window !== 'undefined' && window.location?.port === '3000')
      ? SERVER_MAP_URL_RELATIVE
      : SERVER_MAP_URL_ABSOLUTE;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    return fetch(url, { cache: 'no-cache', signal: controller.signal })
      .then(resp => {
        if (!resp.ok) {
            console.warn('[game] tryFetchActiveMap: Server returned status', resp.status);
            return false;
        }
        return resp.json().then(obj => {
          try {
              const success = applyLoadedMap(obj);
              if (success) verboseLog('[game] tryFetchActiveMap: Successfully applied map from server.');
              return success;
          } catch (e) { console.warn('[game] applyLoadedMap failed', e); return false; }
        }).catch(err => { console.warn('[game] failed to parse active_map.json', err); return false; });
      }).catch(err => { console.warn('[game] tryFetchActiveMap: Fetch failed', err); return false; })
      .finally(() => clearTimeout(timeout));
  } catch (e) { return Promise.resolve(false); }
}

// Applies a deserialised map payload object to the live game state.
function rebuildActiveCoinsFromMap() {
  activeCoins = [];
  if (!mapStates || !logicalW || !logicalH) return;
  for (let index = 0; index < mapStates.length; index++) {
    if (mapStates[index] !== TILE_TYPES.COIN) continue;
    activeCoins.push({
      x: index % logicalW,
      y: Math.floor(index / logicalW),
    });
  }
}

// Validate the complete payload before touching the current world.
function validateMapPayload(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const w = obj.logicalW, h = obj.logicalH;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 ||
      w > FIXED_MAP_WIDTH_TILES || h > FIXED_MAP_HEIGHT_TILES) return false;
  if (obj.cellSize !== undefined && obj.cellSize !== cellSize) return false;
  const tiles = new Set(Object.values(TILE_TYPES));
  const validLayer = layer => Array.isArray(layer) && layer.length === w * h &&
    layer.every(tile => Number.isInteger(tile) && tiles.has(tile));
  if (!validLayer(obj.mapStates)) return false;
  if (obj.terrainLayer != null && !validLayer(obj.terrainLayer)) return false;
  const validPosition = position => position && Number.isFinite(position.x) && Number.isFinite(position.y) &&
    position.x >= 0 && position.y >= 0 && position.x < w && position.y < h;
  if (obj.playerPosition != null && (!validPosition(obj.playerPosition) ||
      !Number.isInteger(obj.playerPosition.x) || !Number.isInteger(obj.playerPosition.y))) return false;
  if (obj.portalPos != null && (!validPosition(obj.portalPos) ||
      !Number.isInteger(obj.portalPos.x) || !Number.isInteger(obj.portalPos.y))) return false;
  if (obj.treeObjects != null && (!Array.isArray(obj.treeObjects) || obj.treeObjects.length > w * h ||
      !obj.treeObjects.every(tree => validPosition(tree) && Number.isInteger(tree.x) && Number.isInteger(tree.y)))) return false;
  if (obj.enemies != null && (!Array.isArray(obj.enemies) || obj.enemies.length > w * h ||
      !obj.enemies.every(enemy => validPosition(enemy) && ['mantis', 'maggot', 'beetle'].includes(enemy.type) &&
        ['health', 'maxHealth', 'moveTimer'].every(key => enemy[key] === undefined ||
          (Number.isFinite(enemy[key]) && enemy[key] >= 0))))) return false;
  if (obj.decorativeObjects != null && (!Array.isArray(obj.decorativeObjects) || obj.decorativeObjects.length > w * h ||
      !obj.decorativeObjects.every(object => object && Object.hasOwn(DECOR_ASSET_PATHS, object.id) &&
        ['obstacle', 'walkable', 'special'].includes(object.type) &&
        Number.isInteger(object.tileX) && Number.isInteger(object.tileY) &&
        validPosition({ x: object.tileX, y: object.tileY })))) return false;
  if (obj.persistentGameId != null && typeof obj.persistentGameId !== 'string') return false;
  return obj.mapStates.some(tile => !isSolid(tile));
}

function applyLoadedMap(obj) {
  if (!validateMapPayload(obj)) {
    console.warn('[game] Invalid saved map; generating a new world');
    return false;
  }
  try {
    clearPreviousGameState();
    logicalW = obj.logicalW;
    logicalH = obj.logicalH;
    mapStates = new Uint8Array(obj.mapStates);
    terrainLayer = new Uint8Array(obj.terrainLayer || obj.mapStates);
    treeObjects = (obj.treeObjects || []).map(tree => ({ ...tree }));
    portalPos = obj.portalPos || _findFallbackPortalPos();
    isPortalActive = obj.isPortalActive === true;
    enemies = _deserialiseEnemies(obj.enemies);
    initialEnemies = enemies.map(enemy => ({ type: enemy.type, x: enemy.x, y: enemy.y }));
    const preferred = obj.playerPosition || { x: Math.floor(logicalW / 2), y: Math.floor(logicalH / 2) };
    playerPosition = { ...preferred };
    const index = findFloodStart();
    playerPosition = { x: index % logicalW, y: Math.floor(index / logicalW) };
    initialSpawnPosition = { ...playerPosition };
    _resetRenderPosition();
    rebuildActiveCoinsFromMap();
    counts = {};
    for (const tile of mapStates) counts[tile] = (counts[tile] || 0) + 1;
    if (obj.decorativeObjects) {
      decorativeObjectsList = obj.decorativeObjects.map(object => ({ ...object }));
      decorativeObstaclePositions = new Set(decorativeObjectsList.filter(object => object.type === 'obstacle')
        .map(object => object.tileY * logicalW + object.tileX));
      decorObjectsDirty = false;
    } else {
      spawnDecorativeObjects();
      decorObjectsDirty = false;
    }
    // Legacy saves generated props randomly. Remove blocking props if they
    // cover the restored spawn or isolate a required objective.
    const reachable = floodReachable();
    if (decorativeObstaclePositions.has(playerPosition.y * logicalW + playerPosition.x) ||
        [...activeCoins, ...enemies.filter(enemy => enemy.health > 0), ...(portalPos ? [portalPos] : [])]
          .some(position => !reachable[Math.floor(position.y) * logicalW + Math.floor(position.x)])) {
      decorativeObjectsList = decorativeObjectsList.filter(object => object.type !== 'obstacle');
      decorativeObstaclePositions.clear();
    }
    createMapImage();
    if (obj.persistentGameId) {
      persistentGameId = obj.persistentGameId;
      try { localStorage.setItem('persistentGameId', persistentGameId); } catch (error) {}
    }
    finishGameLoading();
    return true;
  } catch (error) {
    console.warn('[game] Could not restore map', error);
    clearPreviousGameState();
    return false;
  }
}

// Loads the most recent map from localStorage and applies it; skips if this is a new game.
function loadMapFromStorage() {
  if (isNewGame) {
    verboseLog('[game] new game detected, ignoring stored maps and generating a new one.');
    return false;
  }
  try {
    // Prefer autosave, fall back to most-recent named save
    let raw = null;
    try { raw = localStorage.getItem(AUTOSAVE_KEY); } catch (e) { raw = null; }
    if (!raw) {
      try {
        let latestKey = null, latestTs = 0;
        for (const k of Object.keys(localStorage || {})) {
          if (!k || typeof k !== 'string' || !k.startsWith('saved_map_')) continue;
          const ts = Number(k.split('_').pop()) || 0;
          if (ts > latestTs) { latestTs = ts; latestKey = k; }
        }
        if (latestKey) { try { raw = localStorage.getItem(latestKey); } catch (e) { raw = null; } }
      } catch (e) { raw = null; }
    }

    if (!raw) { verboseLog('[game] no saved map found in storage for this session'); return false; }

    let obj = null;
    try { obj = JSON.parse(raw); } catch (e) { console.warn('[game] failed to parse stored map JSON', e); return false; }

    if (!obj || obj.persistentGameId !== persistentGameId) {
      console.warn(`[game] stored map has wrong game ID (expected ${persistentGameId}, got ${obj && obj.persistentGameId}). Ignoring.`);
      return false;
    }
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.mapStates) || !obj.logicalW || !obj.logicalH) {
      console.warn('[game] stored map payload invalid', obj);
      return false;
    }

    return applyLoadedMap(obj);
  } catch (err) {
    console.warn('[game] loadMapFromStorage error', err);
    return false;
  }
}

// Opens a file picker so the player can load a saved map JSON from disk.
function showFilePickerToLoadActiveMap() {
  try {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', (ev) => {
      const f = input.files && input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          if (applyLoadedMap(obj)) {
            try { showToast('Loaded selected map file', 'info', 1800); } catch (e) {}
          } else {
            try { showToast('Selected file is not a valid map', 'error', 2800); } catch (e) {}
          }
        } catch (e) { try { showToast('Failed to read file', 'error', 2200); } catch (ee) {} }
      };
      reader.readAsText(f);
      setTimeout(() => { try { document.body.removeChild(input); } catch (e) {} }, 6000);
    });
    document.body.appendChild(input);
    input.click();
  } catch (e) { console.warn('[game] showFilePicker failed', e); }
}

// Writes all current settings and keybinds to localStorage; debounced unless immediate=true.
let lastPersistedSettingsJson = null;

function persistSavedSettings(immediate = false) {
  const commit = () => {
    try {
      const fpsMode = normalizeFpsMode(targetFps, DEFAULT_SETTINGS.fpsMode);
      const settings = {
        masterVol,
        musicVol,
        sfxVol,
        textSizeSetting,
        uiScale: textSizeSetting,
        difficulty: difficultySetting,
        sensitivitySetting,
        invertYAxis,
        hudEnabled,
        showHUD: hudEnabled,
        showTutorialsSetting,
        showTutorials: showTutorialsSetting,
        colorModeSetting,
        languageSetting,
        fpsMode,
        performanceOverlay: performanceOverlayEnabled,
        showStars,
        screenShakeEnabled,
        showParticles,
        showFireflyLighting,
        v: 1, // settings version
      };
      const settingsJson = JSON.stringify(settings);
      const keybindsJson = JSON.stringify(playerKeybinds);

      if (settingsJson === lastPersistedSettingsJson && keybindsJson === localStorage.getItem(KEYBINDS_KEY)) {
        return; // No actual change, skip writing and posting message
      }

      lastPersistedSettingsJson = settingsJson;
      localStorage.setItem(SETTINGS_KEY, settingsJson);
      localStorage.setItem(KEYBINDS_KEY, keybindsJson);
      verboseLog('[game] persisted settings', settings);
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'sync-settings',
          ...settings,
          targetFps: getFpsTargetForMode(fpsMode),
          performanceOverlayEnabled: performanceOverlayEnabled,
        }, '*');
      }
    } catch (err) {
      console.warn('[game] persistSavedSettings failed', err);
    }
  };

  if (_settingsSaveTimer) { clearTimeout(_settingsSaveTimer); _settingsSaveTimer = null; }

  if (immediate) { commit(); return; }

  _settingsSaveTimer = setTimeout(() => { commit(); _settingsSaveTimer = null; }, SETTINGS_SAVE_DEBOUNCE_MS);
}

// Immediately saves settings (alias for persistSavedSettings(true)).
function saveLocalSettings() { persistSavedSettings(true); }

// Debounced settings save (alias for persistSavedSettings(false)).
function saveLocalSettingsDebounced() { persistSavedSettings(false); }

// Reads saved settings and keybinds from localStorage and applies them to live globals.
function loadLocalSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
    if (!stored) return;
    let parsed = JSON.parse(stored);

    // Migration: Migrate implicit bug-induced "unlimited" defaults to stable 60 FPS
    if (parsed && !parsed.v) {
      if (parsed.fpsMode === "unlimited" || parsed.targetFps === 0) {
        parsed.fpsMode = "60";
        parsed.targetFps = 60;
      }
      parsed.v = 1;
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
      } catch (e) {}
    }

    lastPersistedSettingsJson = JSON.stringify(parsed);

    if (typeof parsed.masterVol        === 'number')  masterVol           = parsed.masterVol;
    if (typeof parsed.musicVol         === 'number')  musicVol            = parsed.musicVol;
    if (typeof parsed.sfxVol           === 'number')  sfxVol              = parsed.sfxVol;
    textSizeSetting = normalizeUiScaleSetting(
      parsed.uiScale ?? parsed.textSizeSetting,
      textSizeSetting,
    );
    if (typeof parsed.difficulty       === 'string') {
      const normalized = normalizeDifficultyValue(parsed.difficulty);
      if (normalized) { difficultySetting = normalized; setDifficulty(normalized, { regenerate: false, reason: 'load-local-settings' }); }
    }
    if (typeof parsed.sensitivitySetting === 'number')  sensitivitySetting  = parsed.sensitivitySetting;
    if (typeof parsed.invertYAxis        === 'boolean') invertYAxis         = parsed.invertYAxis;
    if (typeof parsed.hudEnabled         === 'boolean') hudEnabled          = parsed.hudEnabled;
    else if (typeof parsed.showHUD       === 'boolean') hudEnabled          = parsed.showHUD;
    if (typeof parsed.showTutorialsSetting === 'boolean') showTutorialsSetting = parsed.showTutorialsSetting;
    else if (typeof parsed.showTutorials === 'boolean') showTutorialsSetting = parsed.showTutorials;
    performanceOverlayEnabled = normalizePerformanceOverlaySetting(parsed, performanceOverlayEnabled);
    applyGameFpsMode(parsed.fpsMode ?? parsed.targetFps, "load-settings");
    if (typeof parsed.showStars          === 'boolean') showStars           = parsed.showStars;
    if (typeof parsed.screenShakeEnabled === 'boolean') {
      screenShakeEnabled = parsed.screenShakeEnabled;
      if (!screenShakeEnabled && typeof CameraShake !== 'undefined') CameraShake.reset();
    }
    if (typeof parsed.showParticles      === 'boolean') {
      showParticles = parsed.showParticles;
      if (!showParticles && typeof WeatherSystem !== 'undefined') WeatherSystem.particles.length = 0;
    }
    if (typeof parsed.showFireflyLighting === 'boolean') showFireflyLighting = parsed.showFireflyLighting;
    if (typeof parsed.colorModeSetting   === 'string') { colorModeSetting = parsed.colorModeSetting; applyColorMode(colorModeSetting); }
    if (typeof parsed.languageSetting    === 'string')  languageSetting     = parsed.languageSetting;
    if (typeof applyVolumes === 'function') applyVolumes();
    verboseLog('[game] loaded saved settings', parsed);
    try {
      const storedKeys = localStorage.getItem(KEYBINDS_KEY);
      if (storedKeys) playerKeybinds = { ...DEFAULT_KEYBINDS, ...JSON.parse(storedKeys) };
    } catch (e) { console.warn('[game] loadLocalSettings keybinds failed', e); }
  } catch (err) {
    console.warn('[game] loadLocalSettings failed', err);
  }
}

// Applies the current masterVol/musicVol values to the running game music track.
function applyVolumes() {
  const normalizedVol = Math.max(0, Math.min(1, (musicVol || 0) * (masterVol || 0)));
  if (gameMusic && typeof gameMusic.setVolume === 'function') gameMusic.setVolume(normalizedVol);
}

// POSTs the current map state to the local map server (only when running on localhost).
function persistActiveMapToServer(reason = 'unspecified') {
  try {
    if (typeof fetch === 'undefined') return false;
    const payload = buildActiveMapPayload();
    if (!payload) { console.warn('[game] no payload to persist to server'); return false; }

    let allowServer = false, saveKey = '';
    try {
      if (typeof window !== 'undefined' && window.location) {
        const params = new URLSearchParams(window.location.search);
        allowServer = getMapServerMode().write;
        saveKey = params.get('saveKey') || '';
      }
    } catch (e) { allowServer = false; }
    if (!allowServer) return false;

    return fetch(SERVER_SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Map-Key': saveKey },
      body: JSON.stringify(payload)
    }).then(resp => resp.json().catch(() => ({}))).then((data) => {
      if (data && data.ok) verboseLog(`[game] workspace active_map.json saved (${reason})`);
      else console.warn('[game] workspace save-map response not ok', data);
      return !!(data && data.ok);
    }).catch((err) => { console.warn('[game] persistActiveMapToServer failed', err); return false; });
  } catch (err) {
    console.warn('[game] persistActiveMapToServer error', err);
    return false;
  }
}


// ── Game message handler ──
window.addEventListener('message', (ev) => {
  if (!ev || !ev.data) return;
  if (window.parent !== window && (ev.origin !== window.location.origin || ev.source !== window.parent)) return;
  try {
    switch (ev.data.type) {
      case 'game-activated': {
        console.log('[game] game-activated received');
        try {
          loadLocalSettings();
          applySettingsMessage(ev.data);
          pendingGameActivated = true;
          if (typeof _confirmResize === 'function') {
            try { _confirmResize(); pendingGameActivated = false; } catch (e) { console.warn('[game] _confirmResize failed', e); }
          } else {
            try { window.dispatchEvent(new Event('resize')); } catch (e) {}
          }
          try { window.focus(); } catch (e) {}
          try { const c = document.querySelector('canvas:not(#pixi-canvas)'); if (c) c.focus(); } catch (e) {}
        } catch (e) {}
        break;
      }
      case 'stop-game-music': {
        try {
          if (gameMusic && typeof gameMusic.isPlaying === 'function' && gameMusic.isPlaying()) {
            gameMusic.stop();
            gameMusicStarted = false;
            pendingGameMusicStart = false;
            verboseLog('[game] stopped gameMusic on request');
          }
        } catch (stopErr) { console.warn('[game] failed to stop gameMusic', stopErr); }
        try { window.parent?.postMessage?.({ type: 'game-music-stopped' }, window.location.origin); } catch (ackErr) {}
        break;
      }
      case 'start-game-music': {
        pendingGameMusicStart = true;
        attemptStartGameMusic('message:start-game-music');
        break;
      }
      case 'update-audio-settings': {
        try {
          applySettingsMessage(ev.data);
          if (gameMusic && typeof gameMusic.setVolume === 'function') {
            gameMusic.setVolume(musicVol * masterVol);
            verboseLog('[game] applied updated audio settings to gameMusic');
          }
        } catch (settingsErr) { console.warn('[game] failed to apply updated audio settings', settingsErr); }
        break;
      }
      case 'release-game-assets': {
        try { releaseGameAssets(); verboseLog?.('[game] released assets on request'); }
        catch (releaseErr) { console.warn('[game] releaseGameAssets failed', releaseErr); }
        break;
      }
      case 'all-settings': {
        try { openInGameSettings(ev.data || {}); }
        catch (e) { console.warn('[game] openInGameSettings failed', e); }
        break;
      }
      default: break;
    }
  } catch (err) {
    console.warn('[game] message handler error', err);
  }
}, false);

function applySettingsMessage(data) {
  if (!data || typeof data !== 'object') return;
  if (typeof data.masterVol === 'number') masterVol = data.masterVol;
  if (typeof data.musicVol === 'number') musicVol = data.musicVol;
  if (typeof data.sfxVol === 'number') sfxVol = data.sfxVol;
  if (typeof data.difficulty === 'string') {
    setDifficulty(data.difficulty, { reason: 'message:update-settings' });
  }
  if (typeof data.fpsMode !== 'undefined' || typeof data.targetFps === 'number') {
    applyGameFpsMode(data.fpsMode ?? data.targetFps, "settings-message");
  }
  if (typeof data.hudEnabled === 'boolean') hudEnabled = data.hudEnabled;
  else if (typeof data.showHUD === 'boolean') hudEnabled = data.showHUD;
  performanceOverlayEnabled = normalizePerformanceOverlaySetting(data, performanceOverlayEnabled);
  textSizeSetting = normalizeUiScaleSetting(data.uiScale ?? data.textSizeSetting, textSizeSetting);
  if (typeof data.showStars === 'boolean') showStars = data.showStars;
  if (typeof data.screenShakeEnabled === 'boolean') {
    screenShakeEnabled = data.screenShakeEnabled;
    if (!screenShakeEnabled && typeof CameraShake !== 'undefined') CameraShake.reset();
  }
  if (typeof data.showParticles === 'boolean') showParticles = data.showParticles;
  if (typeof data.showFireflyLighting === 'boolean') showFireflyLighting = data.showFireflyLighting;
  if (typeof data.colorModeSetting === 'string') colorModeSetting = data.colorModeSetting;
  if (typeof data.invertYAxis === 'boolean') invertYAxis = data.invertYAxis;
  if (typeof data.sensitivitySetting === 'number') sensitivitySetting = data.sensitivitySetting;
  if (typeof data.languageSetting === 'string') languageSetting = data.languageSetting;
  if (typeof applyVolumes === 'function') applyVolumes();
  if (typeof applyCurrentTextSize === 'function') applyCurrentTextSize();
  if (typeof applyColorMode === 'function') applyColorMode(colorModeSetting);
}
