let virtualW, virtualH;
let pendingGameActivated = false;
let enemies = [];
let initialEnemies = [];
let projectiles = [];

// --- Enemy Sprites ---
let mantisMoveSprite = null;
let mantisAttackSprite = null;
let beetleMoveSprite = null;
let beetleAttackSprite = null;
let maggotWalkSprite = null;
let maggotSpitSprite = null;
let acidBlobSprite = null;
let acidSplatSprite = null;
let eggsplosionSprite = null;
let powerupSprite = null;
let healthPotionSprite = null;
let powerupPotionSprite = null;
let chestSprite = null;

// --- Portal ---
let portalActiveSheet = null;
let portalInactiveSheet = null;
let portalPos = null;
let isPortalActive = false;
let victoryShown = false;

// --- Player State ---
let vfx = [];
let playerHealth = 7;
let maxHealth = 7;
let playerInventory = { 'potion': 0, 'speed': 0 };
let lastHealthChange = 0;
let lastScoreChange = 0;
let heartImage = null;
let playerHurtTimer = 0;
let isGameOver = false;
let playerScore = 0;

// --- Tutorial Flags ---
let isTutorialMap = (localStorage.getItem('tutorialComplete') !== 'true');
let tutorialStep = 0;
let tutorialMoved = false;
let tutorialAttacked = false;
let tutorialCollected = false;
let tutorialStepTimer = 0;
let tutorialSprintDetected = false;
let tutorialHitLanded = false;
let tutorialCoinSnapshot = 0;
let tutorialMessage = '';
let tutorialMessageTimer = 0;
let tutorialArrowBlink = 0;
let activeTutorial = null;
let hasShownWelcomeTutorial = (localStorage.getItem('hasShownWelcomeTutorial') === 'true');
let initialSpawnPosition = { x: 0, y: 0 };

// --- HUD & Overlay Buffers ---
let gameOverOverlay = null;
let victoryOverlay = null;
let gameOverTimer = 0;
let minimapImage = null;

// --- VFX & Screen Effects ---
let gameDelta = 0;
let screenShakeTimer = 0;
let screenShakeAmount = 0;
let rippleTimer = 0;
let transitionAlpha = 0;
let isTransitioning = false;
let currentLevel = 1;

// `willReadFrequently: true` must be set at canvas creation time. We patch the global
// getContext so every canvas created by p5.js inherits this flag, which prevents
// a browser-side deoptimization warning and improves pixel-read performance (used by
// cleanImageBrown and minimap rendering).
if (typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype) {
  const canvasProto = HTMLCanvasElement.prototype;
  if (!canvasProto.__gdWillReadFrequentlyPatched) {
    const originalGetContext = canvasProto.getContext;
    const patchedGetContext = function(type, options) {
      if (type === '2d') {
        const optionSource = options && typeof options === 'object' ? options : {};
        const patchedOptions = Object.assign({}, optionSource, { willReadFrequently: true });
        return originalGetContext.call(this, type, patchedOptions);
      }
      return originalGetContext.apply(this, arguments);
    };
    canvasProto.getContext = patchedGetContext;
    canvasProto.__gdWillReadFrequentlyPatched = true;
  }
}

let mapLoadComplete = false;

let cloudImages = [];
let clouds = [];

const MAX_CLOUDS = 150;
const CLOUD_SPAWN_INTERVAL = 3000;

let lastCloudSpawn = 0;

const CLOUD_IMAGE_COUNT = 4;

let showLoadingOverlay = true;
let showMinimap = false;
let smoothCamX = null;
let smoothCamY = null;
let overlayMessage = 'Loading map...';
let lastLoadingScale = null;
let overlayProgress = 0;
let overlayProgressActive = false;
let overlayProgressLastUpdate = 0;
const LOADING_PROGRESS_RATE = 35;

let inGameMenuVisible = false;
let isTerminalOpen = false;
let terminalEl = null;
let terminalHistory = [];
let terminalHistoryIndex = -1;
let inGameMenuButtonRects = [];
let inGameMenuHovered = null;
let inGameMenuHoverScales = {};
let inGameMenuPrevHovered = null;

let activeSettingElements = [];
let textSizeSetting = 75;
let difficultySetting = 'normal';
let sensitivitySetting = 5;
let invertYAxis = false;
let hudEnabled = true;
let showTutorialsSetting = true;
let colorModeSetting = 'None';
let languageSetting = 'English';
let settingsOverlayDiv = null;
let settingsOverlayPanel = null;

const MENU_BUTTON_TEXTURE_PATH = 'assets/3-GUI/Button_BG.png';
const SETTINGS_PANEL_TEXTURE_PATH = 'assets/1-Background/1-Menu/Settings_Background.png';
const MENU_GOLD_COLOR = '#b8860b';
const MENU_GOLD_BORDER = 'rgba(184,134,11,0.65)';
const MENU_GOLD_GLOW = 'rgba(184,134,11,0.35)';

const DEFAULT_KEYBINDS = Object.freeze({
  moveUp: 87, moveDown: 83, moveLeft: 65, moveRight: 68,
  sprint: 16, jump: 32, cut: 69
});
let playerKeybinds = { ...DEFAULT_KEYBINDS };

function keyCodeToLabel(code) {
  if (code === 32) return 'Space';
  if (code === 16) return 'Shift';
  if (code === 27) return 'Esc';
  if (code === 13) return 'Enter';
  if (code === 9)  return 'Tab';
  if (code >= 65 && code <= 90) return String.fromCharCode(code);
  if (code >= 48 && code <= 57) return String.fromCharCode(code);
  if (code >= 112 && code <= 123) return `F${code - 111}`;
  return `[${code}]`;
}

const ALLOW_ACTIVE_MAP_FETCH = false;

const VERBOSE_LOGGING_ENABLED = false;
function verboseLog(...args) {
  if (!VERBOSE_LOGGING_ENABLED) return;
  if (typeof console !== 'undefined' && console.log) {
    console.log(...args);
  }
}


// GameGroups is a late-binding function registry. Each key is a category; each value is
// a wrapper that calls the real implementation once it's defined in a later script file.
// This avoids circular dependency problems in the HTML load order — callers use
// `GameGroups.Map.generateMap()` instead of `generateMap()` directly.
const GameGroups = {
  // Canvas lifecycle: draw loop, canvas creation, sharpness enforcement, video background.
  Core: {
    draw: (...a) => typeof draw === 'function' ? draw(...a) : undefined,
    createMapImage: (...a) => typeof createMapImage === 'function' ? createMapImage(...a) : undefined,
    createFullWindowCanvas: (...a) => typeof createFullWindowCanvas === 'function' ? createFullWindowCanvas(...a) : undefined,
    enforceCanvasSharpness: (...a) => typeof enforceCanvasSharpness === 'function' ? enforceCanvasSharpness(...a) : undefined,
    injectCustomStyles: (...a) => typeof injectCustomStyles === 'function' ? injectCustomStyles(...a) : undefined,
    updateBackgroundVideo: (...a) => typeof updateBackgroundVideo === 'function' ? updateBackgroundVideo(...a) : undefined,
    ensureLoopFallbackBuffer: (...a) => typeof ensureLoopFallbackBuffer === 'function' ? ensureLoopFallbackBuffer(...a) : undefined,
    captureLoopFallbackFrame: (...a) => typeof captureLoopFallbackFrame === 'function' ? captureLoopFallbackFrame(...a) : undefined
  },
  // Terrain generation: Perlin noise, cellular automata hills, flood-fill connectivity.
  Map: {
    generateMap: (...a) => typeof generateMap === 'function' ? generateMap(...a) : undefined,
    generateMap_Part1: (...a) => typeof generateMap_Part1 === 'function' ? generateMap_Part1(...a) : undefined,
    generateMap_Part2: (...a) => typeof generateMap_Part2 === 'function' ? generateMap_Part2(...a) : undefined,
    computeClearArea: (...a) => typeof computeClearArea === 'function' ? computeClearArea(...a) : undefined,
    applyNoiseTerrain: (...a) => typeof applyNoiseTerrain === 'function' ? applyNoiseTerrain(...a) : undefined,
    postProcessRiversAndClearArea: (...a) => typeof postProcessRiversAndClearArea === 'function' ? postProcessRiversAndClearArea(...a) : undefined,
    generateHills: (...a) => typeof generateHills === 'function' ? generateHills(...a) : undefined,
    getHillTileType: (...a) => typeof getHillTileType === 'function' ? getHillTileType(...a) : undefined,
    pruneUnreachable: (...a) => typeof pruneUnreachable === 'function' ? pruneUnreachable(...a) : undefined
  },
  // River carving: drunken-walk rivers, bridges, smoothing, edge connectivity.
  Rivers: {
    carveRivers: (...a) => typeof carveRivers === 'function' ? carveRivers(...a) : undefined,
    carveRiversMaybeThrough: (...a) => typeof carveRiversMaybeThrough === 'function' ? carveRiversMaybeThrough(...a) : undefined,
    carveBranchFromRiver: (...a) => typeof carveBranchFromRiver === 'function' ? carveBranchFromRiver(...a) : undefined,
    layBridgeTile: (...a) => typeof layBridgeTile === 'function' ? layBridgeTile(...a) : undefined,
    smoothRiverTiles: (...a) => typeof smoothRiverTiles === 'function' ? smoothRiverTiles(...a) : undefined,
    roundRiverTips: (...a) => typeof roundRiverTips === 'function' ? roundRiverTips(...a) : undefined,
    ensureInteractiveClearArea: (...a) => typeof ensureInteractiveClearArea === 'function' ? ensureInteractiveClearArea(...a) : undefined,
    ensureEdgeLayerConnectivity: (...a) => typeof ensureEdgeLayerConnectivity === 'function' ? ensureEdgeLayerConnectivity(...a) : undefined
  },
  // Player movement: tile-based walking, sprint, pathfinding, player drawing.
  Movement: {
    handleMovement: (...a) => typeof handleMovement === 'function' ? handleMovement(...a) : undefined,
    tryMoveDirection: (...a) => typeof tryMoveDirection === 'function' ? tryMoveDirection(...a) : undefined,
    handleItemInteraction: (...a) => typeof handleItemInteraction === 'function' ? handleItemInteraction(...a) : undefined,
    canMoveTo: (...a) => typeof canMoveTo === 'function' ? canMoveTo(...a) : undefined,
    isSolid: (...a) => typeof isSolid === 'function' ? isSolid(...a) : undefined,
    startMoveVisual: (...a) => typeof startMoveVisual === 'function' ? startMoveVisual(...a) : undefined,
    updateMovementInterpolation: (...a) => typeof updateMovementInterpolation === 'function' ? updateMovementInterpolation(...a) : undefined,
    updateSprintState: (...a) => typeof updateSprintState === 'function' ? updateSprintState(...a) : undefined,
    getActiveMoveDurationMs: (...a) => typeof getActiveMoveDurationMs === 'function' ? getActiveMoveDurationMs(...a) : undefined,
    getActiveMoveCooldownMs: (...a) => typeof getActiveMoveCooldownMs === 'function' ? getActiveMoveCooldownMs(...a) : undefined,
    getCellSizeSpeedScale: (...a) => typeof getCellSizeSpeedScale === 'function' ? getCellSizeSpeedScale(...a) : undefined,
    drawPlayer: (...a) => typeof drawPlayer === 'function' ? drawPlayer(...a) : undefined,
    deltaToDirection: (...a) => typeof deltaToDirection === 'function' ? deltaToDirection(...a) : undefined,
    directionToDelta: (...a) => typeof directionToDelta === 'function' ? directionToDelta(...a) : undefined,
    findFloodStart: (...a) => typeof findFloodStart === 'function' ? findFloodStart(...a) : undefined,
    neighbors: (...a) => typeof neighbors === 'function' ? neighbors(...a) : undefined,
    getTileState: (...a) => typeof getTileState === 'function' ? getTileState(...a) : undefined
  },
  // Save/load: map serialization, server fetch, localStorage settings persistence.
  IO: {
    buildActiveMapPayload: (...a) => typeof buildActiveMapPayload === 'function' ? buildActiveMapPayload(...a) : undefined,
    saveMap: (...a) => typeof saveMap === 'function' ? saveMap(...a) : undefined,
    downloadMapJSON: (...a) => typeof downloadMapJSON === 'function' ? downloadMapJSON(...a) : undefined,
    autosaveMap: (...a) => typeof autosaveMap === 'function' ? autosaveMap(...a) : undefined,
    persistActiveMapToServer: (...a) => typeof persistActiveMapToServer === 'function' ? persistActiveMapToServer(...a) : undefined,
    tryFetchActiveMap: (...a) => typeof tryFetchActiveMap === 'function' ? tryFetchActiveMap(...a) : undefined,
    applyLoadedMap: (...a) => typeof applyLoadedMap === 'function' ? applyLoadedMap(...a) : undefined,
    loadMapFromStorage: (...a) => typeof loadMapFromStorage === 'function' ? loadMapFromStorage(...a) : undefined,
    showFilePickerToLoadActiveMap: (...a) => typeof showFilePickerToLoadActiveMap === 'function' ? showFilePickerToLoadActiveMap(...a) : undefined,
    persistSavedSettings: (...a) => typeof persistSavedSettings === 'function' ? persistSavedSettings(...a) : undefined,
    saveLocalSettings: (...a) => typeof saveLocalSettings === 'function' ? saveLocalSettings(...a) : undefined,
    saveLocalSettingsDebounced: (...a) => typeof saveLocalSettingsDebounced === 'function' ? saveLocalSettingsDebounced(...a) : undefined,
    loadLocalSettings: (...a) => typeof loadLocalSettings === 'function' ? loadLocalSettings(...a) : undefined
  },
  // Asset loading: image/sound tracking, pixel cleaning, custom asset toggling.
  Assets: {
    trackLoadImage: (...a) => typeof trackLoadImage === 'function' ? trackLoadImage(...a) : undefined,
    trackLoadSound: (...a) => typeof trackLoadSound === 'function' ? trackLoadSound(...a) : undefined,
    AssetTracker: () => AssetTracker,
    cleanImageBrown: (...a) => typeof cleanImageBrown === 'function' ? cleanImageBrown(...a) : undefined,
    backupCustomAssets: (...a) => typeof backupCustomAssets === 'function' ? backupCustomAssets(...a) : undefined,
    removeCustomAssetsRuntime: (...a) => typeof removeCustomAssetsRuntime === 'function' ? removeCustomAssetsRuntime(...a) : undefined,
    restoreCustomAssetsRuntime: (...a) => typeof restoreCustomAssetsRuntime === 'function' ? restoreCustomAssetsRuntime(...a) : undefined,
    toggleCustomAssetsRuntime: (...a) => typeof toggleCustomAssetsRuntime === 'function' ? toggleCustomAssetsRuntime(...a) : undefined
  },
  // Audio: volume control, music start, click SFX, difficulty normalization.
  Audio: {
    applyVolumes: (...a) => typeof applyVolumes === 'function' ? applyVolumes(...a) : undefined,
    attemptStartGameMusic: (...a) => typeof attemptStartGameMusic === 'function' ? attemptStartGameMusic(...a) : undefined,
    unlockAudioAndStart: (...a) => typeof unlockAudioAndStart === 'function' ? unlockAudioAndStart(...a) : undefined,
    startMenuMusicIfNeeded: (...a) => typeof startMenuMusicIfNeeded === 'function' ? startMenuMusicIfNeeded(...a) : undefined,
    playClickSFX: (...a) => typeof playClickSFX === 'function' ? playClickSFX(...a) : undefined,
    normalizeDifficultyValue: (...a) => typeof normalizeDifficultyValue === 'function' ? normalizeDifficultyValue(...a) : undefined,
    setDifficulty: (...a) => typeof setDifficulty === 'function' ? setDifficulty(...a) : undefined,
    getDifficultyDisplayLabel: (...a) => typeof getDifficultyDisplayLabel === 'function' ? getDifficultyDisplayLabel(...a) : undefined
  },
  // Cloud system: spawning, updating, drawing, and environment defaults.
  Clouds: {
    spawnCloud: (...a) => typeof spawnCloud === 'function' ? spawnCloud(...a) : undefined,
    updateClouds: (...a) => typeof updateClouds === 'function' ? updateClouds(...a) : undefined,
    drawClouds: (...a) => typeof drawClouds === 'function' ? drawClouds(...a) : undefined,
    RandomEnvironment: (...a) => typeof RandomEnvironment === 'function' ? RandomEnvironment(...a) : undefined,
    applyEnvironmentDefaults: (...a) => typeof applyEnvironmentDefaults === 'function' ? applyEnvironmentDefaults(...a) : undefined
  },
  // Utilities: toasts, loading overlay, color helpers, flood-fill.
  Utils: {
    showToast: (...a) => typeof showToast === 'function' ? showToast(...a) : undefined,
    updateLoadingOverlayDom: (...a) => typeof updateLoadingOverlayDom === 'function' ? updateLoadingOverlayDom(...a) : undefined,
    ensureLoadingOverlayDom: (...a) => typeof ensureLoadingOverlayDom === 'function' ? ensureLoadingOverlayDom(...a) : undefined,
    getColorForState: (...a) => typeof getColorForState === 'function' ? getColorForState(...a) : undefined,
    floodReachable: (...a) => typeof floodReachable === 'function' ? floodReachable(...a) : undefined
  },
  // Input: mouse/keyboard events, resize confirmation, pause toggle.
  Input: {
    mousePressed: (...a) => typeof mousePressed === 'function' ? mousePressed(...a) : undefined,
    keyPressed: (...a) => typeof keyPressed === 'function' ? keyPressed(...a) : undefined,
    windowResized: (...a) => typeof windowResized === 'function' ? windowResized(...a) : undefined,
    _confirmResize: (...a) => typeof _confirmResize === 'function' ? _confirmResize(...a) : undefined,
    togglePauseMenuFromEscape: (...a) => typeof togglePauseMenuFromEscape === 'function' ? togglePauseMenuFromEscape(...a) : undefined,
    attemptStartGameMusic: (...a) => typeof attemptStartGameMusic === 'function' ? attemptStartGameMusic(...a) : undefined
  }
};

function enforceCanvasSharpness(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  const smoothingProps = ['imageSmoothingEnabled', 'mozImageSmoothingEnabled', 'webkitImageSmoothingEnabled', 'msImageSmoothingEnabled', 'oImageSmoothingEnabled'];
  for (const prop of smoothingProps) {
    try {
      ctx[prop] = false;
    } catch (e) {}
  }
  try { ctx.imageSmoothingQuality = 'low'; } catch (e) {}
}

function startLoadingProgress(value = 0) {
  overlayProgress = Math.max(0, Math.min(100, value));
  overlayProgressActive = true;
  overlayProgressLastUpdate = typeof millis === 'function' ? millis() : Date.now();
}

function updateLoadingProgressTick() {
  if (!overlayProgressActive) return;
  const now = typeof millis === 'function' ? millis() : Date.now();
  if (!overlayProgressLastUpdate) {
    overlayProgressLastUpdate = now;
    return;
  }
  const delta = Math.max(0, now - overlayProgressLastUpdate);
  overlayProgressLastUpdate = now;
  overlayProgress = Math.min(100, overlayProgress + (delta / 1000) * LOADING_PROGRESS_RATE);
}

function completeLoadingProgress() {
  overlayProgress = 100;
  overlayProgressActive = false;
  overlayProgressLastUpdate = 0;
}

const CONTROL_VERTICAL_NUDGE = 8;
const SELECT_VERTICAL_NUDGE = 15;
const TEXTSIZE_BUTTON_Y_OFFSET = 10;
const BACK_BUTTON_VERTICAL_OFFSET = 120;

let genPhase = 0;
let genTimer = 0;
let genTempData = {};


const FIXED_VIRTUAL_HEIGHT = 900;
const FIXED_MAP_WIDTH_TILES = 150;
const FIXED_MAP_HEIGHT_TILES = 150;
let gameScale = 1;


// --- Sprint System ---
let sprintEnergy = 100;
const SPRINT_MAX = 100;
const SPRINT_COST_PER_FRAME = 0.5;
const SPRINT_REGEN_PER_FRAME = 0.2;
let lastRunTime = 0;

let inGameMenuOverlay = null;
let _lastEscToggleAt = 0;


const BASE_DPR = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
let __zoomProbeEl = null;

let lastLoggedZoom = null;
const ZOOM_DIAGNOSTIC_ENABLED = true;

let gameMusic;
let masterVol = 0.8;
let musicVol = 0.6;
let sfxVol = 0.7;

let pendingGameMusicStart = false;
let gameMusicStarted = false;


let persistentGameId = null;
let isNewGame = false;
let localStorageAvailable = true;

try {
  const testKey = '__gd_test__';
  window.localStorage.setItem(testKey, '1');
  window.localStorage.removeItem(testKey);
} catch (e) {
  localStorageAvailable = false;
}

try {
  if (localStorageAvailable) {
    persistentGameId = window.localStorage.getItem('persistentGameId');
    if (!persistentGameId) {
      isNewGame = true;
      persistentGameId = 'game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      try { window.localStorage.setItem('persistentGameId', persistentGameId); } catch (e) { localStorageAvailable = false; }
    }
  } else {
    isNewGame = true;
    persistentGameId = 'game_fallback_' + Date.now();
    console.warn('[game] localStorage not available, using fallback game ID.');
  }
} catch (e) {
  isNewGame = true;
  persistentGameId = 'game_fallback_' + Date.now();
  localStorageAvailable = false;
  console.warn('[game] localStorage error, using fallback game ID.');
}

let _settingsSaveTimer = null;

let _resizeConfirmTimer = null;
let _lastRequestedSize = { w: 0, h: 0 };

let isJumping = false;
let jumpTimer = 0;
let jumpFrame = 0;
let isAttacking = false;
let playerAttackTimer = 0;
let playerAttackFrame = 0;
let hasDealtPlayerDamage = false;
let isAttackingEnvironmentalTriggered = false;
let playerAttackCooldownTimer = 0;
// --- Attack & Dash ---
const PLAYER_ATTACK_COOLDOWN_MS = 450;
const PLAYER_ATTACK_STAMINA_COST = 12;
let playerComboCount = 0;
let lastAttackTime = 0;
let isDashing = false;
let dashTimer = 0;
let dashCooldown = 0;
const DASH_DURATION = 200;
const DASH_COOLDOWN = 1000;

// --- Jump ---
const JUMP_FRAME_COUNT = 5;
const JUMP_ANIM_SPEED = 100;
const JUMP_DURATION = JUMP_FRAME_COUNT * JUMP_ANIM_SPEED;

let jumpStartY = 0;
let facing = 'right';
let lastMoveDX = 0;
let lastMoveDY = 1;
let lastDirection = 'S';

let W, H;
let logicalW, logicalH;
const cellSize = 32;

let mapStates;
let terrainLayer;

let playerPosition = null;

// --- Movement Timing ---
const BASE_MOVE_DURATION_MS = 100;
const BASE_MOVE_COOLDOWN_MS = 160;
const SPRINT_MOVE_DURATION_MS = 75;
const SPRINT_MOVE_COOLDOWN_MS = 150;
const SPRINT_MAX_DURATION_MS = 3000;
const SPRINT_COOLDOWN_MS = 4000;

let renderX = 0;
let renderY = 0;
let renderStartX = 0;
let renderStartY = 0;
let renderTargetX = 0;
let renderTargetY = 0;
let isMoving = false;
let queuedMove = null;
let prevKeyA = false;
let prevKeyD = false;
let prevKeyW = false;
let prevKeyS = false;

let holdState = {
  A: { start: 0, last: 0 },
  D: { start: 0, last: 0 },
  W: { start: 0, last: 0 },
  S: { start: 0, last: 0 }
};

// --- Key Repeat ---
const HOLD_INITIAL_DELAY_MS = 120;    // ms before held key starts repeating (like OS key-repeat delay)
const HOLD_REPEAT_INTERVAL_MS = 70;   // ms between repeated moves while key is held
let moveStartMillis = 0;
let lastMoveDurationMs = BASE_MOVE_DURATION_MS;

const SPAWN_CLEAR_RADIUS = 3; // tiles cleared around player spawn point to ensure walkable start
let lastMoveTime = 0;
let sprintActive = false;
let sprintEndMillis = 0;
let sprintCooldownUntil = 0;
let sprintRemainingMs = SPRINT_MAX_DURATION_MS;
let sprintLastUpdate = 0;
let smoothSprintPct = 1.0; // starts at 1.0 = full bar; animated toward sprintEnergy each frame

let mapImage;
let mapOverlays = [];
let drawablePool = [];
let drawablePoolIdx = 0;
let currentDrawables = [];
let spritesheet = null;
const SPRITESHEET_PATH = 'assets/1-Background/test3.png';
const TILE_TYPES = Object.freeze({
  GRASS: 1,
  FOREST: 2,
  MOB: 3,

  CHEST: 100,
  HEALTH: 101,
  POWERUP: 102,
  COIN: 103,

  CLIFF: 6,
  RAMP: 7,
  LOG: 8,
  FLOWERS: 9,
  CAVE: 10,
  RIVER: 11,
  BORDER: 12,
  HILL_NORTH: 13,
  HILL_NORTHEAST: 14,
  HILL_EAST: 15,
  HILL_SOUTHEAST: 16,
  HILL_SOUTH: 17,
  HILL_SOUTHWEST: 18,
  HILL_WEST: 19,
  HILL_NORTHWEST: 20,
});

const WALKABLE_TILES = new Set([
  TILE_TYPES.GRASS, TILE_TYPES.FLOWERS, TILE_TYPES.RAMP, TILE_TYPES.RIVER, TILE_TYPES.LOG
]);

const ITEM_DATA = Object.freeze({
  [TILE_TYPES.CHEST]:  { label: 'CHEST', spawnRate: 0.01, color: [218, 165, 32] },
  [TILE_TYPES.HEALTH]: { label: 'HEALTH', spawnRate: 0.005, color: [0, 255, 127] },
  [TILE_TYPES.POWERUP]:{ label: 'POWERUP', spawnRate: 0.003, color: [138, 43, 226] },
  [TILE_TYPES.COIN]:   { label: 'COIN', spawnRate: 0.02, color: [255, 215, 0] },
});

const DECOR_ASSET_PATHS = Object.freeze({
  bush_small_1:    'assets/5-Objects/1-More/bush_small_1.png',
  flowers_more_1:  'assets/5-Objects/1-More/flower_more_1.png',
  flowers_pink_1:  'assets/5-Objects/1-More/flower_pink_1.png',
  flower_yellow:   'assets/5-Objects/1-More/flower_yellow.png',
  rock_small_1:    'assets/5-Objects/1-More/rock_small_1.png',
  rock_upward_1:   'assets/5-Objects/1-More/rock_upward_1.png',
  log_horizontal_1:'assets/5-Objects/1-More/log_horizontal_1.png',
  log_upward_1:    'assets/5-Objects/1-More/log_upward_1.png',
  log_vertically_1:'assets/5-Objects/1-More/log_vertically_1.png',
  bush_upward_1:   'assets/5-Objects/1-More/bush_upward_1.png',
  hole_1:          'assets/5-Objects/1-More/hole_1.png'
});

const DECORATIVE_WALKABLE_NAMES = Object.freeze([
  'bush_small_1',
  'flowers_more_1',
  'flowers_pink_1',
  'flower_yellow',
  'rock_small_1',
  'rock_upward_1'
]);

const DECORATIVE_OBSTACLE_NAMES = Object.freeze([
  'bush_upward_1',
  'log_vertically_1',
  'log_upward_1',
  'log_horizontal_1'
]);

const DECOR_SPECIAL_NAMES = Object.freeze(['hole_1']);
const DECOR_ASSET_IMAGES = {};

let decorativeObstaclePositions = new Set(); // Set of tile indices (y*logicalW+x) that block movement
let decorativeObjectsList = [];              // Array of placed decorative object descriptors
let decorObjectsDirty = true;

const SPRITES = {
  [TILE_TYPES.GRASS]: { x: 0, y: 0, w: 16, h: 16 },
  [TILE_TYPES.FOREST]: { x: 862, y: 191, w: 32, h: 32, drawW: 64, drawH: 64 },
  [TILE_TYPES.CLIFF]: { x: 862, y: 0, w: 16, h: 16 },
  [TILE_TYPES.RAMP]: { x: 400, y: 224, w: 64, h: 64 },
  [TILE_TYPES.COIN]: { isImage: true, asset: 'coin_sprite' },
  [TILE_TYPES.HEALTH]: { isImage: true, asset: 'heart' }
};

const TILE_IMAGE_PATHS = {
  [TILE_TYPES.FOREST]: 'assets/1-Background/2-Game/tree_1.png'
};


const TREE_OVERLAY_PATH = 'assets/1-Background/2-Game/1-Forest/tree_1.png';

let TREE_OVERLAY_IMG = null;
let treeObjects = [];

const TREE_SPAWN_CHANCE = 0.00005;

let edgeLayer = null;
let EDGE_LAYER_ENABLED = false;
let EDGE_LAYER_DEBUG = false;
let EDGE_LAYER_COLOR = [76, 175, 80, 200];

function setEdgeLayerColor(r, g, b, a = 200) {
  EDGE_LAYER_COLOR = [Number(r)||0, Number(g)||0, Number(b)||0, Number(a)||0];
  verboseLog('[game] EDGE_LAYER_COLOR=', EDGE_LAYER_COLOR);
}

function setEdgeLayerEnabled(v) {
  EDGE_LAYER_ENABLED = !!v;
  verboseLog('[game] EDGE_LAYER_ENABLED=', EDGE_LAYER_ENABLED);
}

function setEdgeLayerDebug(v) {
  EDGE_LAYER_DEBUG = !!v; verboseLog('[game] EDGE_LAYER_DEBUG=', EDGE_LAYER_DEBUG);
}

try { window.setEdgeLayerEnabled = setEdgeLayerEnabled; window.setEdgeLayerDebug = setEdgeLayerDebug; } catch (e) {}
try { window.setEdgeLayerColor = setEdgeLayerColor; } catch (e) {}

let TILE_IMAGES = { };

let CUSTOM_ASSETS_OFF = false;
let __ASSET_BACKUP = null;

function backupCustomAssets() {
  try {
    __ASSET_BACKUP = {
      tile_1: TILE_IMAGES['tile_1'] || null,
      tree_1: TILE_IMAGES['tree_1'] || null,
      water_1: TILE_IMAGES['water_1'] || null,
      bridge_1: TILE_IMAGES['bridge_1'] || null,
      gentle_forest: TILE_IMAGES['gentle_forest'] || null,
      gentle_trees: TILE_IMAGES['gentle_trees'] || null,
      tree_overlay: TREE_OVERLAY_IMG || null,
      river_alias: TILE_IMAGES[TILE_TYPES.RIVER] || null,
      ramp_alias: TILE_IMAGES[TILE_TYPES.RAMP] || null,
      log_alias: TILE_IMAGES[TILE_TYPES.LOG] || null,
      grass_alias: TILE_IMAGES[TILE_TYPES.GRASS] || null,
      forest_alias: TILE_IMAGES[TILE_TYPES.FOREST] || null
    };
  } catch (e) { __ASSET_BACKUP = null; }
}

function removeCustomAssetsRuntime() {
  try {
    TILE_IMAGES['tile_1'] = null;
    TILE_IMAGES['tree_1'] = null;
    TILE_IMAGES['gentle_forest'] = null;
    TILE_IMAGES['gentle_trees'] = null;
    TILE_IMAGES['water_1'] = null;
    TILE_IMAGES['bridge_1'] = null;
    TREE_OVERLAY_IMG = null;
    try { TILE_IMAGES[TILE_TYPES.RIVER] = null; } catch (e) {}
    try { TILE_IMAGES[TILE_TYPES.RAMP] = null; } catch (e) {}
    try { TILE_IMAGES[TILE_TYPES.LOG] = null; } catch (e) {}
    try { TILE_IMAGES[TILE_TYPES.GRASS] = null; } catch (e) {}
    try { TILE_IMAGES[TILE_TYPES.FOREST] = null; } catch (e) {}
    CUSTOM_ASSETS_OFF = true;
    verboseLog('[game] custom assets removed (runtime)');
  } catch (e) { console.warn('[game] removeCustomAssetsRuntime failed', e); }
}

function restoreCustomAssetsRuntime() {
  try {
    if (!__ASSET_BACKUP) return;
    TILE_IMAGES['tile_1'] = __ASSET_BACKUP.tile_1 || TILE_IMAGES['tile_1'];
    TILE_IMAGES['tree_1'] = __ASSET_BACKUP.tree_1 || TILE_IMAGES['tree_1'];
    TILE_IMAGES['gentle_forest'] = __ASSET_BACKUP.gentle_forest || TILE_IMAGES['gentle_forest'];
    TILE_IMAGES['gentle_trees'] = __ASSET_BACKUP.gentle_trees || TILE_IMAGES['gentle_trees'];
    TILE_IMAGES['water_1'] = __ASSET_BACKUP.water_1 || TILE_IMAGES['water_1'];
    TILE_IMAGES['bridge_1'] = __ASSET_BACKUP.bridge_1 || TILE_IMAGES['bridge_1'];
    TREE_OVERLAY_IMG = __ASSET_BACKUP.tree_overlay || TREE_OVERLAY_IMG;
    try { TILE_IMAGES[TILE_TYPES.RIVER] = __ASSET_BACKUP.river_alias || TILE_IMAGES[TILE_TYPES.RIVER]; } catch (e) {}
    try { TILE_IMAGES[TILE_TYPES.RAMP] = __ASSET_BACKUP.ramp_alias || TILE_IMAGES[TILE_TYPES.RAMP]; } catch (e) {}
    try { TILE_IMAGES[TILE_TYPES.LOG] = __ASSET_BACKUP.log_alias || TILE_IMAGES[TILE_TYPES.LOG]; } catch (e) {}
    try { TILE_IMAGES[TILE_TYPES.GRASS] = __ASSET_BACKUP.grass_alias || TILE_IMAGES[TILE_TYPES.GRASS]; } catch (e) {}
    try { TILE_IMAGES[TILE_TYPES.FOREST] = __ASSET_BACKUP.forest_alias || TILE_IMAGES[TILE_TYPES.FOREST]; } catch (e) {}
    CUSTOM_ASSETS_OFF = false;
    verboseLog('[game] custom assets restored (runtime)');
  } catch (e) { console.warn('[game] restoreCustomAssetsRuntime failed', e); }
}

function toggleCustomAssetsRuntime() {
  if (!CUSTOM_ASSETS_OFF) {
    backupCustomAssets();
    removeCustomAssetsRuntime();
  } else {
    restoreCustomAssetsRuntime();
  }
}

const COLORS = {
  [TILE_TYPES.GRASS]: [50, 205, 50],
  [TILE_TYPES.FOREST]: [0, 100, 0],
  [TILE_TYPES.MOB]: [64, 64, 64],
  [TILE_TYPES.CLIFF]: [205, 133, 63],
  [TILE_TYPES.RAMP]: [210, 180, 140],
  [TILE_TYPES.RIVER]: [65, 105, 225],
  [TILE_TYPES.LOG]: [139, 69, 19],
  [TILE_TYPES.FLOWERS]: [255, 105, 180],
  [TILE_TYPES.CAVE]: [47, 79, 79],
  [TILE_TYPES.BORDER]: [0, 0, 0],
  [TILE_TYPES.CHEST]: ITEM_DATA[TILE_TYPES.CHEST].color,
  [TILE_TYPES.HEALTH]: ITEM_DATA[TILE_TYPES.HEALTH].color,
  [TILE_TYPES.POWERUP]: ITEM_DATA[TILE_TYPES.POWERUP].color,
  player: [128, 128, 128]
};

const RIVER_CLEAR_MODES = Object.freeze({ ALWAYS: 'always', NEVER: 'never', AUTO: 'auto' });
let riverClearMode = RIVER_CLEAR_MODES.AUTO;

const SPRITE_ALLOWED_TILES = new Set([TILE_TYPES.GRASS, TILE_TYPES.FOREST]);


const ENVIRONMENTS = ['Rainforest', 'Grasslands', 'Desert', 'Savannah', 'Forest', 'Wetlands', 'Flower'];


let currentEnvironment = 'Forest';

const DIFFICULTIES = ['easy', 'normal', 'hard'];
const DIFFICULTY_LABELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

const MOB_SPAWN_TUNING = Object.freeze({
  easy:   { mobChance: 0.08, maxMobs: 30 },
  normal: { mobChance: 0.011, maxMobs: 120 },
  hard:   { mobChance: 0.2,  maxMobs: 300 }
});

let currentDifficulty = 'normal';
const DIFFICULTY_SETTINGS = {
  easy:   { mobChance: 0.03,  maxMobs: 40, rampRatio: 0.08 },
  normal: { mobChance: 0.038, maxMobs: 60, rampRatio: 0.15 },
  hard:   { mobChance: 0.10,  maxMobs: 300, rampRatio: 0.20 }
};

let currentGenParams = {};
let showTextures = true;
let counts = {};

let nextGenerateIsManual = false;

const HILL_DIRECTIONS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const HILL_ASSETS = {};
