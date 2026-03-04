// game-io.js — Map save/load, settings persistence, server sync
// Extracted from 4-Game.js

function buildActiveMapPayload() {
  try {
    if (typeof mapStates === 'undefined' || !mapStates) return null;
    return {
      persistentGameId: persistentGameId,
      timestamp: Date.now(),
      logicalW: logicalW || Math.ceil(W / cellSize),
      logicalH: logicalH || Math.ceil(H / cellSize),
      cellSize: cellSize,
      mapStates: Array.from(mapStates),
      terrainLayer: terrainLayer ? Array.from(terrainLayer) : null,
      treeObjects: Array.isArray(treeObjects) ? treeObjects.slice() : [],
      portalPos: portalPos,
      isPortalActive: isPortalActive,
      enemies: Array.isArray(enemies) ? enemies.map(e => ({
          type: e.type,
          x: e.x,
          y: e.y,
          health: e.health,
          maxHealth: e.maxHealth,
          direction: e.direction,
          moveTimer: e.moveTimer
      })) : []
    };
  } catch (err) {
    console.warn('[game] buildActiveMapPayload failed', err);
    return null;
  }
}

function saveMap(name) {
  try {
    const payload = buildActiveMapPayload();
    if (!payload) {
      console.warn('[game] no map to save');
      return false;
    }
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
    try {
      try { showToast(t('map_saved'), 'info', 2200); } catch (e) {}
    } catch (e) {}
    downloadMapJSON(payload, key + '.json');
    persistActiveMapToServer('manual-save');
    return true;
  } catch (err) {
    console.error('[game] saveMap error', err);
    return false;
  }
}

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

function autosaveMap() {
  try {
    const payload = buildActiveMapPayload();
    if (!payload) {
      console.warn('[game] no map to autosave');
      return false;
    }
    const key = 'autosave_map';
    if (localStorageAvailable) {
      try {
        if (typeof localStorage === 'undefined') throw new Error('localStorage undefined');
        localStorage.setItem(key, JSON.stringify(payload));
        verboseLog('[game] map autosaved to localStorage as', key);
        try { showToast(t('map_autosaved'), 'info', 2200); } catch (e) {}
    
      } catch (err) {
        
        console.warn('[game] localStorage write failed; autosave not persisted', err);
        localStorageAvailable = false;
        try { showToast('Autosave failed (storage full or unavailable)', 'warn', 4200); } catch (e) {}
        
        try { lastAutosavePayload = payload; try { showToast('Autosave stored in memory (not persisted)', 'info', 3000); } catch (e) {} } catch (e) {}
        
        return false;
      }
    } else {
      console.warn('[game] localStorage unavailable, storing autosave in memory');
      try { lastAutosavePayload = payload; try { showToast('Autosave stored in memory (not persisted)', 'info', 3000); } catch (e) {} } catch (e) {}
    
    }
    return true;
  } catch (err) {
    console.error('[game] autosaveMap error', err);
    return false;
  }
}

function shouldAttemptMapFetch() {
  if (typeof window === 'undefined' || !window.location) return false;
  if (ALLOW_ACTIVE_MAP_FETCH) return true;
  if (window.location.protocol === 'file:') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('activeMapFetch') === '1') return true;
  } catch (e) {}
  return false;
}

function tryFetchActiveMap() {
  try {
    if (typeof fetch === 'undefined') return Promise.resolve(false);

    if (!shouldAttemptMapFetch()) {
      return Promise.resolve(false);
    }

    
    let url = 'http://localhost:3000/maps/active_map.json';
    if (typeof window !== 'undefined' && window.location && window.location.port === '3000') {
      url = '/maps/active_map.json';
    }

    return fetch(url, { cache: 'no-cache' })
      .then(resp => {
        if (!resp.ok) {
            console.warn('[game] tryFetchActiveMap: Server returned status', resp.status);
            return false;
        }
        return resp.json().then(obj => {
          try { 
             
              const success = applyLoadedMap(obj); 
              if (success) {
                  verboseLog('[game] tryFetchActiveMap: Successfully applied map from server.');
                  return true;
              }
          } catch (e) { console.warn('[game] applyLoadedMap failed', e); }
          return false;
        }).catch(err => { console.warn('[game] failed to parse active_map.json', err); return false; });
      }).catch(err => { 
   
          console.warn('[game] tryFetchActiveMap: Fetch failed', err); 
          return false; 
      });
  } catch (e) { return Promise.resolve(false); }
}

function applyLoadedMap(obj) {
  try {
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.mapStates) || !obj.logicalW || !obj.logicalH) {
      console.warn('[game] applyLoadedMap: invalid payload', obj);
      return false;
    }
    try {
      if (obj.persistentGameId) {
        persistentGameId = obj.persistentGameId;
        try { localStorage.setItem('persistentGameId', persistentGameId); } catch (e) {}
      }
    } catch (e) {}

    logicalW = Number(obj.logicalW) || Math.ceil((virtualW || W) / cellSize);
    logicalH = Number(obj.logicalH) || Math.ceil((virtualH || H) / cellSize);
    if (obj.cellSize && Number(obj.cellSize) > 0) {
      try { cellSize = Number(obj.cellSize); } catch (e) {}
    }
    try { mapStates = new Uint8Array(obj.mapStates); } catch (e) { mapStates = new Uint8Array(Array.from(obj.mapStates || [])); }
    if (obj.terrainLayer && Array.isArray(obj.terrainLayer)) {
      try { terrainLayer = new Uint8Array(obj.terrainLayer); } catch (e) { terrainLayer = new Uint8Array(Array.from(obj.terrainLayer)); }
    } else {
      terrainLayer = mapStates.slice();
    }
    treeObjects = Array.isArray(obj.treeObjects) ? obj.treeObjects.slice() : [];
    
    if (obj.portalPos) portalPos = obj.portalPos;
    else {
        // Generate portal if missing from old save
        for (let i = 0; i < mapStates.length; i++) {
            if (mapStates[i] === TILE_TYPES.GRASS) {
                portalPos = { x: i % logicalW, y: Math.floor(i / logicalW) };
                break;
            }
        }
    }
    if (typeof obj.isPortalActive === 'boolean') isPortalActive = obj.isPortalActive;

    enemies = [];
    if (Array.isArray(obj.enemies)) {
        for (const eData of obj.enemies) {
            let enemy = null;
            if (eData.type === 'mantis') {
                enemy = createMantis(eData.x, eData.y);
            } else if (eData.type === 'maggot') {
                enemy = createMaggot(eData.x, eData.y);
            } else if (eData.type === 'beetle') {
                enemy = createBeetle(eData.x, eData.y);
            }
            if (enemy) {
                if (eData.direction) enemy.direction = eData.direction;
                if (eData.moveTimer) enemy.moveTimer = eData.moveTimer;
                if (eData.health) enemy.health = eData.health;
                if (eData.maxHealth) enemy.maxHealth = eData.maxHealth;
                enemies.push(enemy);
            }
        }
    }
    initialEnemies = enemies.map(e => ({ type: e.type, x: e.x, y: e.y }));

    markDecorObjectsDirty();

    counts = {};
    for (let i = 0; i < mapStates.length; i++) counts[mapStates[i]] = (counts[mapStates[i]] || 0) + 1;

    const centerX = Math.floor((logicalW || Math.ceil(W / (cellSize || 32))) / 2);
    const centerY = Math.floor((logicalH || Math.ceil(H / (cellSize || 32))) / 2);
    playerPosition = { x: centerX, y: centerY };
    initialSpawnPosition = { x: centerX, y: centerY };
    renderX = playerPosition.x; renderY = playerPosition.y; renderStartX = renderX; renderStartY = renderY; renderTargetX = renderX; renderTargetY = renderY; isMoving = false;
    createMapImage();
    redraw();
    try { mapLoadComplete = true; } catch (e) {}
    try { showLoadingOverlay = false; } catch (e) {}
    completeLoadingProgress();
    return true;
  } catch (err) {
    console.warn('[game] applyLoadedMap error', err);
    return false;
  }
}

function loadMapFromStorage() {
  if (isNewGame) {
    verboseLog('[game] new game detected, ignoring stored maps and generating a new one.');
    return false;
  }
  try {
    let raw = null;
    try { raw = localStorage.getItem('autosave_map'); } catch (e) { raw = null; }
    if (!raw) {
      try {
        const keys = Object.keys(localStorage || {});
        let latestKey = null;
        let latestTs = 0;
        for (const k of keys) {
          if (!k || typeof k !== 'string') continue;
          if (k.startsWith('saved_map_')) {
            const parts = k.split('_');
            const ts = Number(parts[parts.length - 1]) || 0;
            if (ts > latestTs) { latestTs = ts; latestKey = k; }
          }
        }
        if (latestKey) {
          try { raw = localStorage.getItem(latestKey); } catch (e) { raw = null; }
        }
      } catch (e) {
        raw = null;
      }
    }
    
    if (!raw) {
      verboseLog('[game] no saved map found in storage for this session');
      return false;
    }
    let obj = null;
    try { obj = JSON.parse(raw); } catch (e) { console.warn('[game] failed to parse stored map JSON', e); return false; }
    if (obj.persistentGameId !== persistentGameId) {
      console.warn(`[game] stored map has wrong game ID (expected ${persistentGameId}, got ${obj.persistentGameId}). Ignoring.`);
      return false;
    }
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.mapStates) || !obj.logicalW || !obj.logicalH) {
      console.warn('[game] stored map payload invalid', obj);
      return false;
    }
    logicalW = Number(obj.logicalW) || Math.ceil((virtualW || W) / cellSize);
    logicalH = Number(obj.logicalH) || Math.ceil((virtualH || H) / cellSize);
    if (obj.cellSize && Number(obj.cellSize) > 0) {
      try { cellSize = Number(obj.cellSize); } catch (e) { }
    }
    try {
      mapStates = new Uint8Array(obj.mapStates);
    } catch (e) {
      mapStates = new Uint8Array(Array.from(obj.mapStates || []));
    }
    if (obj.terrainLayer && Array.isArray(obj.terrainLayer)) {
      try { terrainLayer = new Uint8Array(obj.terrainLayer); } catch (e) { terrainLayer = new Uint8Array(Array.from(obj.terrainLayer)); }
    } else {
      terrainLayer = mapStates.slice();
    }
    treeObjects = Array.isArray(obj.treeObjects) ? obj.treeObjects.slice() : [];
    
    if (obj.portalPos) portalPos = obj.portalPos;
    else {
        // Generate portal if missing from old save
        for (let i = 0; i < mapStates.length; i++) {
            if (mapStates[i] === TILE_TYPES.GRASS) {
                portalPos = { x: i % logicalW, y: Math.floor(i / logicalW) };
                break;
            }
        }
    }
    if (typeof obj.isPortalActive === 'boolean') isPortalActive = obj.isPortalActive;

    enemies = [];
    if (Array.isArray(obj.enemies)) {
        for (const eData of obj.enemies) {
            let enemy = null;
            if (eData.type === 'mantis') {
                enemy = createMantis(eData.x, eData.y);
            } else if (eData.type === 'maggot') {
                enemy = createMaggot(eData.x, eData.y);
            } else if (eData.type === 'beetle') {
                enemy = createBeetle(eData.x, eData.y);
            }
            if (enemy) {
                if (eData.direction) enemy.direction = eData.direction;
                if (eData.moveTimer) enemy.moveTimer = eData.moveTimer;
                if (eData.health) enemy.health = eData.health;
                if (eData.maxHealth) enemy.maxHealth = eData.maxHealth;
                enemies.push(enemy);
            }
        }
    }
    initialEnemies = enemies.map(e => ({ type: e.type, x: e.x, y: e.y }));

    counts = {};
    for (let i = 0; i < mapStates.length; i++) counts[mapStates[i]] = (counts[mapStates[i]] || 0) + 1;
    const centerX = Math.floor((logicalW || Math.ceil(W / (cellSize || 32))) / 2);
    const centerY = Math.floor((logicalH || Math.ceil(H / (cellSize || 32))) / 2);
    playerPosition = { x: centerX, y: centerY };
    initialSpawnPosition = { x: centerX, y: centerY };
    renderX = playerPosition.x;
    renderY = playerPosition.y;
    renderStartX = renderX; renderStartY = renderY; renderTargetX = renderX; renderTargetY = renderY; isMoving = false;
    createMapImage();
    redraw();
    try { showToast('Loaded saved map', 'info', 2200); } catch (e) {}
    try { mapLoadComplete = true; } catch (e) {}
    try { showLoadingOverlay = false; } catch (e) {}
    completeLoadingProgress();
    return true;
  } catch (err) {
    console.warn('[game] loadMapFromStorage error', err);
    return false;
  }
}

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

function persistSavedSettings(immediate = false) {
  const commit = () => {
    try {
      const settings = { masterVol, musicVol, sfxVol, textSizeSetting, difficulty: difficultySetting, sensitivitySetting, invertYAxis, hudEnabled, showTutorialsSetting, colorModeSetting, languageSetting };
      localStorage.setItem('menuSettings', JSON.stringify(settings));
      localStorage.setItem('playerKeybinds', JSON.stringify(playerKeybinds));
      verboseLog('[game] persisted settings', settings);
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'sync-settings', ...settings }, '*');
      }
    } catch (err) {
      console.warn('[game] persistSavedSettings failed', err);
    }
  };

  if (_settingsSaveTimer) {
    clearTimeout(_settingsSaveTimer);
    _settingsSaveTimer = null;
  }

  if (immediate) {
    commit();
    return;
  }

  _settingsSaveTimer = setTimeout(() => {
    commit();
    _settingsSaveTimer = null;
  }, 500);
}

function saveLocalSettings() {
  persistSavedSettings(true);
}

function saveLocalSettingsDebounced() {
  persistSavedSettings(false);
}

function loadLocalSettings() {
  try {
    const stored = localStorage.getItem('menuSettings');
    if (!stored) return;
    const parsed = JSON.parse(stored);
    if (typeof parsed.masterVol === 'number') masterVol = parsed.masterVol;
    if (typeof parsed.musicVol === 'number') musicVol = parsed.musicVol;
    if (typeof parsed.sfxVol === 'number') sfxVol = parsed.sfxVol;
    if (typeof parsed.textSizeSetting === 'number') textSizeSetting = parsed.textSizeSetting;
    if (typeof parsed.difficulty === 'string') {
      const normalized = normalizeDifficultyValue(parsed.difficulty);
      if (normalized) {
        difficultySetting = normalized;
        setDifficulty(normalized, { regenerate: false, reason: 'load-local-settings' });
      }
    }
    if (typeof parsed.sensitivitySetting === 'number') sensitivitySetting = parsed.sensitivitySetting;
    if (typeof parsed.invertYAxis === 'boolean') invertYAxis = parsed.invertYAxis;
    if (typeof parsed.hudEnabled === 'boolean') hudEnabled = parsed.hudEnabled;
    if (typeof parsed.showTutorialsSetting === 'boolean') showTutorialsSetting = parsed.showTutorialsSetting;
    if (typeof parsed.colorModeSetting === 'string') { colorModeSetting = parsed.colorModeSetting; applyColorMode(colorModeSetting); }
    if (typeof parsed.languageSetting === 'string') languageSetting = parsed.languageSetting;
    if (typeof applyVolumes === 'function') applyVolumes();
    verboseLog('[game] loaded saved settings', parsed);
    try {
      const storedKeys = localStorage.getItem('playerKeybinds');
      if (storedKeys) playerKeybinds = { ...DEFAULT_KEYBINDS, ...JSON.parse(storedKeys) };
    } catch (e) { console.warn('[game] loadLocalSettings keybinds failed', e); }
  } catch (err) {
    console.warn('[game] loadLocalSettings failed', err);
  }
}

function applyVolumes() {
  const normalizedVol = Math.max(0, Math.min(1, (musicVol || 0) * (masterVol || 0)));
  if (gameMusic && typeof gameMusic.setVolume === 'function') {
    gameMusic.setVolume(normalizedVol);
  }
}

function persistActiveMapToServer(reason = 'unspecified') {
  try {
    if (typeof fetch === 'undefined') return false;
    const payload = buildActiveMapPayload();
    if (!payload) { console.warn('[game] no payload to persist to server'); return false; }

    let allowServer = false;
    let saveKey = '';
    try {
      if (typeof window !== 'undefined' && window.location) {
        const params = new URLSearchParams(window.location.search);
        allowServer = (window.location.hostname === 'localhost') || (params.get('useServer') === '1');
        saveKey = params.get('saveKey') || '';
      }
    } catch (e) { allowServer = false; }
    if (!allowServer) return false;

    return fetch('http://localhost:3000/save-map', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Map-Key': saveKey
      },
      body: JSON.stringify(payload)
    }).then(resp => resp.json().catch(() => ({}))).then((data) => {
      if (data && data.ok) {
        verboseLog(`[game] workspace active_map.json saved (${reason})`);
      } else {
        console.warn('[game] workspace save-map response not ok', data);
      }
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
  try {
    switch (ev.data.type) {
        case 'game-activated': {
          try {
            pendingGameActivated = true;
            if (typeof _confirmResize === 'function') {
              try { _confirmResize(); pendingGameActivated = false; } catch (e) { console.warn('[game] _confirmResize failed', e); }
            } else {
              try { window.dispatchEvent(new Event('resize')); } catch (e) {}
            }
            // Ensure this iframe window has keyboard focus for WASD input
            try { window.focus(); } catch (e) {}
            try { const c = document.querySelector('canvas'); if (c) c.focus(); } catch (e) {}
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
        } catch (stopErr) {
          console.warn('[game] failed to stop gameMusic', stopErr);
        }
        try {
          window.parent && window.parent.postMessage && window.parent.postMessage({ type: 'game-music-stopped' }, '*');
        } catch (ackErr) {
          console.warn('[game] failed to send game-music-stopped ack', ackErr);
        }
        break;
      }
      case 'start-game-music': {
        pendingGameMusicStart = true;
        attemptStartGameMusic('message:start-game-music');
        break;
      }
      case 'update-audio-settings': {
        try {
          if (typeof ev.data.masterVol === 'number') masterVol = ev.data.masterVol;
          if (typeof ev.data.musicVol === 'number') musicVol = ev.data.musicVol;
          if (typeof ev.data.sfxVol === 'number') sfxVol = ev.data.sfxVol;
          if (typeof ev.data.difficulty === 'string') {
            setDifficulty(ev.data.difficulty, { reason: 'message:update-audio-settings' });
          }
          if (gameMusic && typeof gameMusic.setVolume === 'function') {
            gameMusic.setVolume(musicVol * masterVol);
            verboseLog('[game] applied updated audio settings to gameMusic');
          }
        } catch (settingsErr) {
          console.warn('[game] failed to apply updated audio settings', settingsErr);
        }
        break;
      }
      case 'release-game-assets': {
        try {
          releaseGameAssets();
          verboseLog && verboseLog('[game] released assets on request');
        } catch (releaseErr) {
          console.warn('[game] releaseGameAssets failed', releaseErr);
        }
        break;
      }
      case 'all-settings': {
        try {
          
          const payload = ev.data || {};
          try { openInGameSettings(payload); } catch (e) { console.warn('[game] openInGameSettings failed', e); }
        } catch (e) { console.warn('[game] failed to handle all-settings', e); }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.warn('[game] message handler error', err);
  }
}, false);

