let virtualW, virtualH;
let pendingGameActivated = false;
let enemies = [];
let mantisMoveSprite = null;
let mantisAttackSprite = null;
let playerHealth = 7;
let maxHealth = 7;
let heartImage = null;
let playerHurtTimer = 0;
let minimapImage = null;
let gameDelta = 0;

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

const MAX_CLOUDS = 100;
const CLOUD_SPAWN_INTERVAL = 8000;

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
let inGameMenuButtonRects = [];
let inGameMenuHovered = null;
let inGameMenuHoverScales = {};
let inGameMenuPrevHovered = null;

let activeSettingElements = [];
let textSizeSetting = 75;
let difficultySetting = 'normal';
let settingsOverlayDiv = null;
let settingsOverlayPanel = null;

const MENU_BUTTON_TEXTURE_PATH = 'assets/3-GUI/Button_BG.png';
const SETTINGS_PANEL_TEXTURE_PATH = 'assets/1-Background/1-Menu/Settings_Background.png';
const MENU_GOLD_COLOR = '#b8860b';
const MENU_GOLD_BORDER = 'rgba(184,134,11,0.65)';
const MENU_GOLD_GLOW = 'rgba(184,134,11,0.35)';

const SETTINGS_CATEGORIES = Object.freeze(["Audio", "Gameplay", "Controls", "Accessibility", "Language"]);
const DEFAULT_SETTINGS = Object.freeze({
  masterVol: 0.8, musicVol: 0.6, sfxVol: 0.7, textSize: 75, difficulty: 'normal'
});

const ALLOW_ACTIVE_MAP_FETCH = false;

const VERBOSE_LOGGING_ENABLED = false;
function verboseLog(...args) {
  if (!VERBOSE_LOGGING_ENABLED) return;
  if (typeof console !== 'undefined' && console.log) {
    console.log(...args);
  }
}


const GameGroups = {
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
  Clouds: {
    spawnCloud: (...a) => typeof spawnCloud === 'function' ? spawnCloud(...a) : undefined,
    updateClouds: (...a) => typeof updateClouds === 'function' ? updateClouds(...a) : undefined,
    drawClouds: (...a) => typeof drawClouds === 'function' ? drawClouds(...a) : undefined,
    RandomEnvironment: (...a) => typeof RandomEnvironment === 'function' ? RandomEnvironment(...a) : undefined,
    applyEnvironmentDefaults: (...a) => typeof applyEnvironmentDefaults === 'function' ? applyEnvironmentDefaults(...a) : undefined
  },
  Utils: {
    showToast: (...a) => typeof showToast === 'function' ? showToast(...a) : undefined,
    updateLoadingOverlayDom: (...a) => typeof updateLoadingOverlayDom === 'function' ? updateLoadingOverlayDom(...a) : undefined,
    ensureLoadingOverlayDom: (...a) => typeof ensureLoadingOverlayDom === 'function' ? ensureLoadingOverlayDom(...a) : undefined,
    getColorForState: (...a) => typeof getColorForState === 'function' ? getColorForState(...a) : undefined,
    floodReachable: (...a) => typeof floodReachable === 'function' ? floodReachable(...a) : undefined
  },
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
// preload() -
// setup() -
// draw() -
// windowResized() -
// _confirmResize() -
// createFullWindowCanvas() -
// mousePressed() -
// keyPressed() -
 
let genTempData = {};  


const FIXED_VIRTUAL_HEIGHT = 900; 
const FIXED_MAP_WIDTH_TILES = 150;
const FIXED_MAP_HEIGHT_TILES = 150;
let gameScale = 1;


let sprintEnergy = 100;
const SPRINT_MAX = 100;
const SPRINT_COST_PER_FRAME = 0.5; 
const SPRINT_REGEN_PER_FRAME = 0.2;
let lastRunTime = 0;

// --- CORE LIFECYCLE ---
// preload() -
// setup() -
// draw() -
// windowResized() -
// _confirmResize() -
// createFullWindowCanvas() -
// mousePressed() -
// keyPressed() -
function preload() {
  try { ensureLoadingOverlayDom(); overlayMessage = 'Loading assets...'; updateLoadingOverlayDom(); } catch (e) {}
  
  HILL_DIRECTIONS.forEach(dir => {
    const path = `assets/1-Background/2-Game/1-Forest/1-hill_${dir}.png`;
    trackLoadImage(`hill_${dir}`, path, (img) => {
        try {
          
          if (typeof img.loadPixels === 'function') img.loadPixels();
          if (img.pixels && img.pixels.length) {
            for (let i = 0; i < img.pixels.length; i += 4) {
              const r = img.pixels[i];
              const g = img.pixels[i + 1];
              const b = img.pixels[i + 2];
              if (r > 240 && g > 240 && b > 240) { 
                img.pixels[i + 3] = 0; 
              } else if (g > 100 && r < 80 && b < 80) { 
                img.pixels[i + 3] = 0; 
              }
            }
            try { img.updatePixels(); } catch (e) {}
          }
          
          try { const fixed = cleanImageBrown(img); if (fixed) verboseLog('[preload] cleaned brown pixels from hill asset', dir, 'fixed=', fixed); } catch (e) {}
        } catch (e) {}
        HILL_ASSETS[dir] = img;
    });
  });

  
  try {
    trackLoadImage('button_bg', 'assets/3-GUI/Button_BG.png', (img) => { BUTTON_BG = img; verboseLog('[game] loaded BUTTON_BG', img && img.width, 'x', img && img.height); }, (err) => { console.warn('[game] failed to load BUTTON_BG', err); BUTTON_BG = null; });
  } catch (e) {}

  try {
    trackLoadImage('settings_overlay', 'assets/1-Background/1-Menu/Settings_Background.png', (img) => { SETTINGS_OVERLAY = img; verboseLog('[game] loaded SETTINGS_OVERLAY', img && img.width, 'x', img && img.height); }, (err) => { console.warn('[game] failed to load SETTINGS_OVERLAY', err); SETTINGS_OVERLAY = null; });
  } catch (e) {}

  try {
    trackLoadImage('esc_menu_background', 'assets/1-Background/1-Menu/Background.png', (img) => { ESC_MENU_BACKGROUND = img; verboseLog('[game] loaded ESC_MENU_BACKGROUND'); }, (err) => { console.warn('[game] failed to load ESC_MENU_BACKGROUND', err); ESC_MENU_BACKGROUND = null; });
  } catch (e) {}

  TILE_IMAGES['forest'] = null;
  TILE_IMAGES['gentle_forest'] = null;
  TILE_IMAGES['gentle_trees'] = null;
  TILE_IMAGES['tile_1'] = null;
  TILE_IMAGES['tree_1'] = null;
  TILE_IMAGES['water_1'] = null;
  TILE_IMAGES['bridge_1'] = null;
  try {
    
    
    
    
    
    
    
    
    trackLoadImage('tile_1', 'assets/1-Background/2-Game/1-Forest/tile_1.png',
      (img) => { TILE_IMAGES['tile_1'] = img; },
      (err) => { TILE_IMAGES['tile_1'] = null; }
    );
    trackLoadImage('tree_1', 'assets/1-Background/2-Game/1-Forest/tree_1.png',
      (img) => { TILE_IMAGES['tree_1'] = img; },
      (err) => { TILE_IMAGES['tree_1'] = null; }
    );
    trackLoadImage('water_1', 'assets/1-Background/2-Game/1-Forest/water_1.png',
      (img) => { TILE_IMAGES['water_1'] = img; try { TILE_IMAGES[TILE_TYPES.RIVER] = img; } catch (e) {} },
      (err) => { TILE_IMAGES['water_1'] = null; }
    );
    trackLoadImage('bridge_1', 'assets/1-Background/2-Game/1-Forest/bridge_1.png',
      (img) => { TILE_IMAGES['bridge_1'] = img; try { TILE_IMAGES[TILE_TYPES.RAMP] = img; TILE_IMAGES[TILE_TYPES.LOG] = img; } catch (e) {} },
      (err) => { TILE_IMAGES['bridge_1'] = null; }
    );
  } catch (e) {}
  
  if (TREE_OVERLAY_PATH) {
    try {
      trackLoadImage('treeoverlay:' + TREE_OVERLAY_PATH, TREE_OVERLAY_PATH,
        (img) => { TREE_OVERLAY_IMG = img; verboseLog('[game] loaded tree overlay', TREE_OVERLAY_PATH, img.width, 'x', img.height); },
        (err) => { console.warn('[game] failed to load tree overlay', TREE_OVERLAY_PATH, err); TREE_OVERLAY_IMG = null; }
      );
    } catch (e) {}
  }
  Object.entries(DECOR_ASSET_PATHS).forEach(([name, path]) => {
    try {
      trackLoadImage(`decor:${name}`, path,
        (img) => { DECOR_ASSET_IMAGES[name] = img; },
        (err) => { console.warn('[game] failed to load decor asset', name, err); }
      );
    } catch (e) {
      console.warn('[game] failed to queue decor asset', name, e);
    }
  });
  
  uiFont = loadFont(UI_FONT_PATH, () => {}, (err) => {
    console.warn('[game] failed to load UI font', err);
    uiFont = null;
  });
  scheduleDeferredCharacterAssets();
  try { logAssetTrackerStatus('after preload queue'); } catch (e) {}

  try { trackLoadSound('gameMusic:assets/8-Music/game_music.wav', 'assets/8-Music/game_music.wav', (snd) => { gameMusic = snd; }, (err) => { gameMusic = null; }); } catch (e) { try { gameMusic = loadSound('assets/8-Music/game_music.wav'); } catch (ee) { gameMusic = null; } }
  try { trackLoadSound('clickSFX:assets/9-Sounds/Button_Press.mp3', 'assets/9-Sounds/Button_Press.mp3', (snd) => { clickSFX = snd; }, (err) => { clickSFX = null; }); } catch (e) { try { clickSFX = loadSound('assets/9-Sounds/Button_Press.mp3'); } catch (ee) { clickSFX = null; } }

  try {
    trackLoadImage('mantis_move', 'assets/2-Characters/5-Enemies/MantisMove.png',
      (img) => { mantisMoveSprite = img; verboseLog('[game] loaded MantisMove.png'); },
      (err) => { console.warn('[game] failed to load MantisMove.png', err); }
    );

    trackLoadImage('mantis_attack', 'assets/2-Characters/5-Enemies/MantisAttack.png',
      (img) => { mantisAttackSprite = img; verboseLog('[game] loaded MantisAttack.png'); },
      (err) => { console.warn('[game] failed to load MantisAttack.png', err); }
    );

    trackLoadImage('heart', 'assets/3-GUI/Heart.png',
      (img) => { heartImage = img; verboseLog('[game] loaded Heart.png'); },
      (err) => { console.warn('[game] failed to load Heart.png', err); }
    );
  } catch (e) {}
}

function setup() {
  verboseLog("!!! NEW VERSION LOADED !!! - FIXED_VIRTUAL_HEIGHT = " + FIXED_VIRTUAL_HEIGHT);
  
  W = windowWidth;
  H = windowHeight;

  let canvasStyle = document.createElement('style');
  canvasStyle.innerHTML = `
    canvas {
      image-rendering: crisp-edges !important;
      -ms-interpolation-mode: nearest-neighbor !important;
    }
    body, html {
      margin: 0;
      padding: 0;
      background-color: #0a1f04;
      background-image:
        linear-gradient(rgba(0, 0, 0, 0.8), rgba(12, 36, 10, 0.3)),
        linear-gradient(0deg, rgba(0, 0, 0, 0.7) 0%, transparent 20%, transparent 80%, rgba(0, 0, 0, 0.7) 100%),
        url('assets/1-Background/2-Game/1-Forest/tile_1.png');
      background-size: 220px 220px, cover, 420px 420px;
      background-repeat: repeat, no-repeat, repeat;
      background-attachment: fixed;
      background-blend-mode: multiply, normal;
    }
    @supports (image-rendering: -moz-crisp-edges) {
      canvas { image-rendering: -moz-crisp-edges !important; }
    }
    @supports (image-rendering: -o-pixelated) {
      canvas { image-rendering: -o-pixelated !important; }
    }
    @supports (image-rendering: -webkit-pixelated) {
      canvas { image-rendering: -webkit-pixelated !important; }
    }
    @supports (image-rendering: pixelated) {
      canvas { image-rendering: pixelated !important; }
    }
    #gd-loading-content {
      transform-origin: center center;
      transition: transform 0.1s ease-out;
    }
  `;
  document.head.appendChild(canvasStyle);

 
  pixelDensity(window.devicePixelRatio || 1);


  gameScale = H / FIXED_VIRTUAL_HEIGHT;
  virtualW = W / gameScale;
  virtualH = H / gameScale;

  let cnv = createCanvas(W, H);
  ensureTextSizeOverride();
  
  try {
    enforceCanvasSharpness(drawingContext);
    if (cnv && cnv.elt) {
      const cnvCtx = typeof cnv.elt.getContext === 'function' ? cnv.elt.getContext('2d', { willReadFrequently: true }) : null;
      enforceCanvasSharpness(cnvCtx);
      cnv.elt.style.imageRendering = "pixelated"; 
    }
    noSmooth(); 
  } catch (e) {}

  try { injectCustomStyles(); } catch (e) {}
  
  loadLocalSettings();
  applyCurrentTextSize();
  const urlParams = new URLSearchParams(window.location.search);
  const urlMasterVol = parseFloat(urlParams.get('masterVol'));
  const urlMusicVol = parseFloat(urlParams.get('musicVol'));
  const urlSfxVol = parseFloat(urlParams.get('sfxVol'));
  if (!Number.isNaN(urlMasterVol)) masterVol = urlMasterVol;
  if (!Number.isNaN(urlMusicVol)) musicVol = urlMusicVol;
  if (!Number.isNaN(urlSfxVol)) sfxVol = urlSfxVol;
  const urlDifficulty = urlParams.get('difficulty');
  if (urlDifficulty) setDifficulty(urlDifficulty, { regenerate: false, reason: 'url-param' });
  
  const urlRiverClear = (urlParams.get('riverClear') || '').toLowerCase();
  if (urlRiverClear === RIVER_CLEAR_MODES.ALWAYS || urlRiverClear === 'true') {
    riverClearMode = RIVER_CLEAR_MODES.ALWAYS;
  } else if (urlRiverClear === RIVER_CLEAR_MODES.NEVER || urlRiverClear === 'false') {
    riverClearMode = RIVER_CLEAR_MODES.NEVER;
  } else {
    riverClearMode = RIVER_CLEAR_MODES.AUTO;
  }


  try {
    document.addEventListener('pointerdown', (ev) => {
      try {
        const el = ev.target;
        if (!el) return;
        const isButton = (el.tagName === 'BUTTON') || (el.closest && el.closest('button')) || (el.getAttribute && el.getAttribute('role') === 'button');
        if (!isButton) return;
        try {
          unlockAudioAndStart(() => {
            try { playClickSFX(); } catch (e) {}
          });
        } catch (e) {
          try { playClickSFX(); } catch (ee) {}
        }
      } catch (e) {}
    }, { capture: true });
  } catch (e) {}
  
  let loadedFromStorage = false;
  let loadedFromServer = false;
  let serverFetchPromise = Promise.resolve(false);

  try {
    const loc = window.location;
    const isLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
    const forceServer = urlParams.get('useServer') === '1';
    if (isLocal || forceServer) {
      serverFetchPromise = tryFetchActiveMap();
    }
  } catch (e) {}

  AssetTracker.waitReady(3500).then((ready) => {
    if (ready) {
      verboseLog('[game] assets loaded. Pre-warming clouds...');
      
     
      const wWidth = width / (height / 3000); 
      for(let i = 0; i < 25; i++) {
          spawnCloud(Math.random() * wWidth); 
      }
    }

    const runAutoGenerator = () => { generateMap(); };

    serverFetchPromise.then((serverLoaded) => {
      if (serverLoaded) {
         if (persistentGameId && persistentGameId.startsWith('server_default_')) {
             runAutoGenerator();
         }
         return; 
      }
      if (loadMapFromStorage()) return;
      runAutoGenerator();
    }).catch((err) => { runAutoGenerator(); });
    
    try {
      serverFetchPromise.finally(() => {
          setTimeout(() => {
             if (typeof mapLoadComplete === 'undefined' || !mapLoadComplete) {
                 if (genPhase === 0) generateMap();
             }
          }, 1000);
      });
    } catch(e) {}
    
    if (!ready) {
      try {
        AssetTracker.onReady(() => {
          try { createMapImage(); redraw(); } catch (e) {}
        });
      } catch (e) {}
    }
  });
  
  if (gameMusic) gameMusic.setVolume(musicVol * masterVol);
  if (pendingGameActivated) { try { _confirmResize(); pendingGameActivated = false; } catch (e) {} }
}

function windowResized() {
  try {
    clearTimeout(_resizeConfirmTimer);
  } catch (e) {}
  _lastRequestedSize = { w: windowWidth, h: windowHeight };
  _resizeConfirmTimer = setTimeout(() => {
    if (_lastRequestedSize.w === windowWidth && _lastRequestedSize.h === windowHeight) {
      _confirmResize();
    } else {
      windowResized();
    }
  }, 200);
}

function _confirmResize() {
  _resizeConfirmTimer = null;

  W = windowWidth;
  H = windowHeight;


  pixelDensity(window.devicePixelRatio || 1);
  

  const mapW = (logicalW || 0) * cellSize;
  const mapH = (logicalH || 0) * cellSize;
  if (mapW <= 0 || mapH <= 0) {
    resizeCanvas(W, H);
    return;
  }

  // Use fixed virtual height for consistent zoom
  gameScale = Math.max(0.001, H / FIXED_VIRTUAL_HEIGHT);
  virtualW = W / gameScale;
  virtualH = H / gameScale;

  resizeCanvas(W, H);
  

  try {
    enforceCanvasSharpness(drawingContext);
    const cnv = select('canvas');
    if (cnv && cnv.elt) {
      const cnvCtx = typeof cnv.elt.getContext === 'function' ? cnv.elt.getContext('2d', { willReadFrequently: true }) : null;
      enforceCanvasSharpness(cnvCtx);
      cnv.elt.style.imageRendering = "pixelated";
    }
  } catch (e) {}

  if (typeof mapStates === 'undefined' || !mapStates || mapStates.length === 0) {
    return;
  }

  try { createMapImage(); } catch (e) { console.warn('createMapImage failed', e); }
  redraw();
}

function createFullWindowCanvas() {
  W = windowWidth;
  H = windowHeight;
  createCanvas(W, H);
  pixelDensity(1);
}

function mousePressed() {
  try {
    
    const mx = mouseX / gameScale;
    const my = mouseY / gameScale;

    
  } catch (e) {}
}

function togglePauseMenuFromEscape() {
  const now = Date.now();
  if (now - _lastEscToggleAt < 50) return; 
  _lastEscToggleAt = now;

  try {
    try { if (typeof applyCurrentTextSize === 'function') applyCurrentTextSize(); } catch(e) {}
    try { if (typeof persistSavedSettings === 'function') persistSavedSettings(true); } catch(e) {}
    if (settingsOverlayDiv) {
      if (settingsOverlayDiv.closeZoomPanel) settingsOverlayDiv.closeZoomPanel();
      else settingsOverlayDiv.remove();
      settingsOverlayDiv = null;
      openInGameMenu();
      return;
    }

    if (inGameMenuVisible) {
      closeInGameMenu();
    } else {
      openInGameMenu();
    }
  } catch (e) { console.warn('[game] toggling inGameMenuVisible failed', e); }
}

function keyPressed() {
  if (key === ' ' && !isJumping && !isMoving) {
    
    isJumping = true;
    jumpFrame = 0;
    jumpTimer = 0;

    
    try {
      const nowA = (typeof keyIsDown === 'function') ? keyIsDown(65) : false;
      const nowD = (typeof keyIsDown === 'function') ? keyIsDown(68) : false;
      const nowW = (typeof keyIsDown === 'function') ? keyIsDown(87) : false;
      const nowS = (typeof keyIsDown === 'function') ? keyIsDown(83) : false;
      const dx = (nowD ? 1 : 0) - (nowA ? 1 : 0);
      const dy = (nowS ? 1 : 0) - (nowW ? 1 : 0);
      
      if (dx === 0 && dy === 0) {
        
      } else {
        const dir = deltaToDirection(dx, dy);
        const d = directionToDelta(dir);
      const maxTileX = (logicalW || 0) - 1;
      const maxTileY = (logicalH || 0) - 1;
      let targetX = (typeof playerPosition.x === 'number' ? playerPosition.x : 0) + d.dx;
      let targetY = (typeof playerPosition.y === 'number' ? playerPosition.y : 0) + d.dy;
      targetX = Math.max(0, Math.min(targetX, maxTileX));
      targetY = Math.max(0, Math.min(targetY, maxTileY));
        if (canMoveTo(playerPosition.x, playerPosition.y, targetX, targetY)) {
        handleItemInteraction(targetX, targetY);
        const prevX = playerPosition.x;
        const prevY = playerPosition.y;
        if (isMoving) {
          queuedMove = { prevX, prevY, targetX, targetY };
        } else {
          playerPosition.x = targetX;
          playerPosition.y = targetY;
          lastMoveDX = playerPosition.x - prevX;
          lastMoveDY = playerPosition.y - prevY;
          lastDirection = deltaToDirection(lastMoveDX, lastMoveDY);
          startMoveVisual(prevX, prevY, playerPosition.x, playerPosition.y);
        }
      }
      }
    } catch (e) { console.warn('[game] jump-forward movement failed', e); }
    return;
  }
  if (key === 'Escape' || keyCode === 27) { togglePauseMenuFromEscape(); return false; }

  if (key === 'm' || key === 'M') {
      showMinimap = !showMinimap;
      return;
  }

  if (key === 'f' || key === 'F') {
    fullscreen(!fullscreen());
    return;
  }

  if (key === 't' || key === 'T') {
    try {
      toggleCustomAssetsRuntime();
      try { createMapImage(); redraw(); } catch (e) { console.warn('[game] createMapImage failed after custom asset toggle', e); }
    } catch (e) { console.warn('[game] error toggling custom assets', e); }
    return;
  }

  if (key === 'p' || key === 'P') {
    try {
      verboseLog('[game] key P pressed — generating new map (previous autosave will be archived)');
      nextGenerateIsManual = true;
      generateMap();
    } catch (e) {
      console.warn('[game] generateMap() failed from key press', e);
    }
    return;
  }

  
  if (key === 'o' || key === 'O') {
    try {
      verboseLog('[game] debug key O pressed — forcing inGameMenuVisible = true');
      inGameMenuVisible = true;
    } catch (e) { console.warn('[game] debug O failed', e); }
    return;
  }
}


try {
  window.addEventListener('keydown', (ev) => {
    if (ev && ev.key === 'Escape') {
      ev.preventDefault();
      togglePauseMenuFromEscape();
    }
  }, { capture: true });
} catch (e) {
  console.warn('[game] failed to attach global Escape handler', e);
}



function generateMap() {
  clearPreviousGameState();
  genPhase = 1;
}

function generateMap_Part1() {
  verboseLog('[game] Generating Part 1 (Base)...');
  
  if (!W || !H) return;
  logicalW = FIXED_MAP_WIDTH_TILES;
  logicalH = FIXED_MAP_HEIGHT_TILES;

  mapStates = new Uint8Array(logicalW * logicalH);
  terrainLayer = new Uint8Array(logicalW * logicalH);

  
  const clearArea = computeClearArea();
  applyNoiseTerrain(clearArea.centerX, clearArea.centerY, clearArea.baseClearWidth, clearArea.baseClearHeight);
  
  
  genTempData = { clearArea };
}

function generateMap_Part2() {
  verboseLog('[game] Generating Part 2 (Roughness)...');
  
  const { clearArea } = genTempData;
  
  const spawn = postProcessRiversAndClearArea(clearArea.clearStartX, clearArea.clearEndX, clearArea.clearStartY, clearArea.clearEndY);

  

  generateHills(mapStates, logicalW, logicalH);

  
  pruneUnreachable(spawn.spawnX, spawn.spawnY);
  
  terrainLayer = mapStates.slice();
  counts = {};
  for (let i = 0; i < mapStates.length; i++) counts[mapStates[i]] = (counts[mapStates[i]] || 0) + 1;

  playerPosition = { x: spawn.spawnX, y: spawn.spawnY };
  renderX = playerPosition.x; renderY = playerPosition.y;
  renderStartX = renderX; renderStartY = renderY; renderTargetX = renderX; renderTargetY = renderY;
  isMoving = false;

  markDecorObjectsDirty();
  createMapImage();

  try {
     let enemyCount = 12;
     if (difficultySetting === 'hard') enemyCount = 24;
     else if (difficultySetting === 'easy') enemyCount = 6;
     
     for (let i = 0; i < enemyCount; i++) {
        let ex, ey;
        let attempts = 0;
        do {
           ex = Math.floor(Math.random() * logicalW);
           ey = Math.floor(Math.random() * logicalH);
           attempts++;
        } while (attempts < 50 && isSolid(mapStates[ey * logicalW + ex]));
        
        if (!isSolid(mapStates[ey * logicalW + ex])) {
            spawnEnemy('mantis', ex, ey);
        }
     }
  } catch(e) {}

  treeObjects = [];
  if (TREE_OVERLAY_IMG) {
    for (let y = 0; y < logicalH; y++) {
      for (let x = 0; x < logicalW; x++) {
        const idx = y * logicalW + x;
        if (mapStates[idx] !== TILE_TYPES.FOREST) continue;
        if (x === spawn.spawnX && y === spawn.spawnY) continue;
        if (Math.random() < TREE_SPAWN_CHANCE) treeObjects.push({ x, y });
      }
    }
    createMapImage();
  }
  
  
  genTempData = {};
  
  redraw();
  autosaveMap();
  persistActiveMapToServer('generated');
}

function computeClearArea() {
    const centerX = logicalW / 2;
    const centerY = logicalH / 2;
    const clearAreaRatio = 0.75 + Math.random() * 0.15;
    const baseClearWidth = logicalW * clearAreaRatio;
    const baseClearHeight = logicalH * clearAreaRatio;
    return {
      centerX, centerY, baseClearWidth, baseClearHeight,
      clearStartX: centerX - baseClearWidth / 2,
      clearEndX: centerX + baseClearWidth / 2,
      clearStartY: centerY - baseClearHeight / 2,
      clearEndY: centerY + baseClearHeight / 2
    };
}

function applyNoiseTerrain(centerX, centerY, baseClearWidth, baseClearHeight) {
    const noiseScale = 0.12;
    
    const radiusX = logicalW / 2;
    const radiusY = logicalH / 2;

    for (let y = 0; y < logicalH; y++) {
      for (let x = 0; x < logicalW; x++) {
        const idx = y * logicalW + x;

   
        const dx = (x - centerX) / radiusX;
        const dy = (y - centerY) / radiusY;
        const dist = Math.sqrt(dx*dx + dy*dy);

        const n = noise(x * noiseScale, y * noiseScale);
        const wobble = (n - 0.5) * 0.3; 

        if (dist + wobble > 0.80) {
            mapStates[idx] = TILE_TYPES.FOREST;
        } else {
            mapStates[idx] = TILE_TYPES.GRASS;
        }
      }
    }
}

function postProcessRiversAndClearArea(clearStartX, clearEndX, clearStartY, clearEndY) {
    const RIVER_TILE = (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RIVER) ? TILE_TYPES.RIVER : null;

    carveRivers(mapStates, logicalW, logicalH, { clearStartX, clearEndX, clearStartY, clearEndY, RIVER_TILE });

    const spawnX = Math.floor(logicalW / 2);
    const spawnY = Math.floor(logicalH / 2);
    const allowClearOverride = riverClearMode === RIVER_CLEAR_MODES.AUTO ? null : (riverClearMode === RIVER_CLEAR_MODES.ALWAYS);

    carveRiversMaybeThrough(mapStates, logicalW, logicalH, {
      clearStartX, clearEndX, clearStartY, clearEndY, RIVER_TILE,
      playerX: spawnX, playerY: spawnY, allowClearOverride
    });

    const branchChance = allowClearOverride === true ? 1 : 0.55;
    if (allowClearOverride !== false && Math.random() < branchChance) {
      carveBranchFromRiver(mapStates, logicalW, logicalH, {
        clearStartX, clearEndX, clearStartY, clearEndY, RIVER_TILE, playerX: spawnX, playerY: spawnY
      });
    }

    ensureInteractiveClearArea(mapStates, logicalW, logicalH, {
      clearStartX, clearEndX, clearStartY, clearEndY, playerX: spawnX, playerY: spawnY, RIVER_TILE
    });

    smoothRiverTiles(mapStates, logicalW, logicalH, { RIVER_TILE, clearStartX, clearEndX, clearStartY, clearEndY });
    roundRiverTips(mapStates, logicalW, logicalH, { RIVER_TILE, clearStartX, clearEndX, clearStartY, clearEndY });

    return { spawnX, spawnY };
}

function pruneUnreachable(startX, startY) {
    const startIdx = startY * logicalW + startX;
    if (isSolid(mapStates[startIdx])) return; 
    const q = [{ x: startX, y: startY }];
    const visited = new Set([`${startX},${startY}`]);
    let head = 0;
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
      { dx: 0, dy: 1 },  { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
    ];
    while (head < q.length) {
      const { x, y } = q[head++];
      for (const d of dirs) {
        const nx = x + d.dx; const ny = y + d.dy;
        if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH) {
          const key = `${nx},${ny}`; const idx = ny * logicalW + nx;
          if (!visited.has(key) && !isSolid(mapStates[idx])) {
            visited.add(key); q.push({ x: nx, y: ny });
          }
        }
      }
    }
    for (let i = 0; i < mapStates.length; i++) {
      const x = i % logicalW; 
      const y = Math.floor(i / logicalW);
      
      if (!isSolid(mapStates[i]) && !visited.has(`${x},${y}`)) {
        mapStates[i] = TILE_TYPES.FOREST;
      }
    }
}

function generateHills(map, w, h) {
  // --- SETTINGS ---
  const scale = 0.035; 
  const threshold = 0.48;
  const seed = Math.random() * 99999;
  let grid = new Uint8Array(w * h);

  // 1. Initial Noise Pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < 4 || x > w - 5 || y < 4 || y > h - 5) continue;
      const n = noise((x * scale) + seed, (y * scale) + seed);
      if (n > threshold) grid[y * w + x] = 1;
    }
  }

  // 2. Cellular Automata Smoothing (5 Iterations)
  for (let i = 0; i < 5; i++) {
    const nextGrid = new Uint8Array(grid);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (grid[(y + dy) * w + (x + dx)] === 1) neighbors++;
          }
        }
        if (grid[idx] === 1) nextGrid[idx] = (neighbors >= 4) ? 1 : 0;
        else nextGrid[idx] = (neighbors >= 5) ? 1 : 0;
      }
    }
    grid = nextGrid;
  }

  // 3. Strict Pruning Pass (Remove Thin/Unsupported Shapes)
  for (let p = 0; p < 8; p++) {
    let changed = false;
    const nextGrid = new Uint8Array(grid);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (grid[idx] === 0) continue;

        const n = grid[(y - 1) * w + x];
        const s = grid[(y + 1) * w + x];
        const e = grid[y * w + (x + 1)];
        const wDir = grid[y * w + (x - 1)];

        const cardinalHillCount = n + s + e + wDir;

        // Rule A: Isolated or Tip (0 or 1 neighbor) -> Kill
        if (cardinalHillCount < 2) {
          nextGrid[idx] = 0;
          changed = true;
          continue;
        }

        // Rule B: Thin Bar (2 neighbors, but opposite) -> Kill
        if (cardinalHillCount === 2) {
          if ((n && s) || (e && wDir)) {
            nextGrid[idx] = 0;
            changed = true;
            continue;
          }
        }
        
        // Keep valid shape (Corner or Solid)
        nextGrid[idx] = 1;
      }
    }
    grid = nextGrid;
    if (!changed) break;
  }

  // 4. Render to Map
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (grid[idx] === 1) {
        const tileType = getHillTileType(grid, x, y, w);
        if (tileType !== 0 && tileType !== TILE_TYPES.GRASS) {
          map[idx] = tileType;
        }
      }
    }
  }
}

function getHillTileType(grid, x, y, w) {
  
  
  const isHill = (dx, dy) => {
    const nx = x + dx;
    const ny = y + dy;
    const h = grid.length / w; 
    
    
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) return false;
    
    return grid[ny * w + nx] === 1;
  };

  
  const n = isHill(0, -1);  
  const s = isHill(0, 1);   
  const e = isHill(1, 0);   
  const wDir = isHill(-1, 0); 

  
  
  
  
  
  if (!n && !wDir) return TILE_TYPES.HILL_NORTHWEST;
  if (!n && !e)    return TILE_TYPES.HILL_NORTHEAST;
  if (!s && !wDir) return TILE_TYPES.HILL_SOUTHWEST;
  if (!s && !e)    return TILE_TYPES.HILL_SOUTHEAST;

  
  
  
  
  
  if (!n) return TILE_TYPES.HILL_NORTH;
  if (!s) return TILE_TYPES.HILL_SOUTH;
  if (!wDir) return TILE_TYPES.HILL_WEST;
  if (!e) return TILE_TYPES.HILL_EAST;

  
  
  
  
  
  
  return TILE_TYPES.GRASS; 
}

function carveRivers(map, w, h, opts) {
  const { clearStartX, clearEndX, clearStartY, clearEndY } = opts;
  const RIVER_TILE = opts.RIVER_TILE;
  const riverId = () => (RIVER_TILE !== null ? RIVER_TILE : TILE_TYPES.FOREST);
  
  function isInsideClear(x, y) {
    return x > clearStartX && x < clearEndX && y > clearStartY && y < clearEndY;
  }

  // --- 1. MAIN RIVER (Guaranteed Middle) ---
  const isHorizontal = Math.random() < 0.5;
  let mx = isHorizontal ? 0 : w / 2 + (Math.random() - 0.5) * (w * 0.1);
  let my = isHorizontal ? h / 2 + (Math.random() - 0.5) * (h * 0.1) : 0;
  
  let curMX = mx;
  let curMY = my;
  let mainRiverPoints = [];

  const mainSteps = Math.max(w, h) * 1.5;
  for (let s = 0; s < mainSteps; s++) {
    // Variable thickness for a natural look
    const radius = 0.8 + noise(s * 0.1, 123) * 1.0;
    for (let dy = -Math.ceil(radius); dy <= radius; dy++) {
      for (let dx = -Math.ceil(radius); dx <= radius; dx++) {
        const nx = Math.floor(curMX + dx);
        const ny = Math.floor(curMY + dy);
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          if (dx * dx + dy * dy <= radius * radius) map[ny * w + nx] = riverId();
        }
      }
    }
    mainRiverPoints.push({x: curMX, y: curMY});

    if (isHorizontal) {
      curMX += 1.0;
      curMY += (noise(curMX * 0.04, 555) - 0.5) * 1.8;
      if (curMX >= w) break;
    } else {
      curMY += 1.0;
      curMX += (noise(curMY * 0.04, 777) - 0.5) * 1.8;
      if (curMY >= h) break;
    }
  }

  // --- 2. NATURAL BRANCHES ---
  const numBranches = 2 + Math.floor(Math.random() * 2);
  for (let b = 0; b < numBranches; b++) {
    // Pick a point on the main river to start the branch
    const startIdx = Math.floor(Math.random() * (mainRiverPoints.length * 0.6)) + Math.floor(mainRiverPoints.length * 0.2);
    const startP = mainRiverPoints[startIdx];
    
    let curBX = startP.x;
    let curBY = startP.y;
    
    // Choose a general direction away from the main path
    let angle = isHorizontal ? (Math.random() < 0.5 ? -HALF_PI : HALF_PI) : (Math.random() < 0.5 ? 0 : PI);
    angle += (Math.random() - 0.5) * 0.5;

    for (let s = 0; s < 40; s++) {
      const radius = 0.6 + noise(s * 0.1, b * 10) * 0.8;
      for (let dy = -Math.ceil(radius); dy <= radius; dy++) {
        for (let dx = -Math.ceil(radius); dx <= radius; dx++) {
          const nx = Math.floor(curBX + dx);
          const ny = Math.floor(curBY + dy);
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            if (dx * dx + dy * dy <= radius * radius) map[ny * w + nx] = riverId();
          }
        }
      }
      curBX += Math.cos(angle);
      curBY += Math.sin(angle);
      angle += (noise(s * 0.1, b * 50) - 0.5) * 0.3;
      if (curBX < 0 || curBX >= w || curBY < 0 || curBY >= h) break;
    }
  }
}

function layBridgeTile(map, w, h, x, y, RIVER_TILE, BRIDGE_TILE) {
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const idx = y * w + x;
  map[idx] = BRIDGE_TILE;

  // Determine river flow direction (horizontal or vertical)
  let horizontalRiver = 0;
  let verticalRiver = 0;
  const range = 3; // Check a small area around the bridge
  
  for (let d = -range; d <= range; d++) {
    if (x + d >= 0 && x + d < w && map[y * w + (x + d)] === RIVER_TILE) horizontalRiver++;
    if (y + d >= 0 && y + d < h && map[(y + d) * w + x] === RIVER_TILE) verticalRiver++;
  }

  const isVerticalBridge = horizontalRiver > verticalRiver;
  
  // Extend bridge until it hits solid ground on both sides
  const extendBridge = (dx, dy) => {
    let curX = x + dx;
    let curY = y + dy;
    while (curX >= 0 && curX < w && curY >= 0 && curY < h) {
      const cIdx = curY * w + curX;
      if (map[cIdx] === RIVER_TILE) {
        map[cIdx] = BRIDGE_TILE;
      } else {
        break; // Hit ground
      }
      curX += dx;
      curY += dy;
    }
  };

  if (isVerticalBridge) {
    extendBridge(0, 1);
    extendBridge(0, -1);
  } else {
    extendBridge(1, 0);
    extendBridge(-1, 0);
  }
}

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
      enemies: Array.isArray(enemies) ? enemies.map(e => ({
          type: e.type,
          x: e.x,
          y: e.y,
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
      try { showToast('Map saved locally', 'info', 2200); } catch (e) {}
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
        try { showToast('Map autosaved', 'info', 2200); } catch (e) {}
    
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
    
    enemies = [];
    if (Array.isArray(obj.enemies)) {
        for (const eData of obj.enemies) {
            if (eData.type === 'mantis') {
                const mantis = createMantis(eData.x, eData.y);
                if (eData.direction) mantis.direction = eData.direction;
                if (eData.moveTimer) mantis.moveTimer = eData.moveTimer;
                enemies.push(mantis);
            }
        }
    }

    markDecorObjectsDirty();

    counts = {};
    for (let i = 0; i < mapStates.length; i++) counts[mapStates[i]] = (counts[mapStates[i]] || 0) + 1;

    const centerX = Math.floor((logicalW || Math.ceil(W / (cellSize || 32))) / 2);
    const centerY = Math.floor((logicalH || Math.ceil(H / (cellSize || 32))) / 2);
    playerPosition = { x: centerX, y: centerY };
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
    
    enemies = [];
    if (Array.isArray(obj.enemies)) {
        for (const eData of obj.enemies) {
            if (eData.type === 'mantis') {
                const mantis = createMantis(eData.x, eData.y);
                if (eData.direction) mantis.direction = eData.direction;
                if (eData.moveTimer) mantis.moveTimer = eData.moveTimer;
                enemies.push(mantis);
            }
        }
    }

    counts = {};
    for (let i = 0; i < mapStates.length; i++) counts[mapStates[i]] = (counts[mapStates[i]] || 0) + 1;
    const centerX = Math.floor((logicalW || Math.ceil(W / (cellSize || 32))) / 2);
    const centerY = Math.floor((logicalH || Math.ceil(H / (cellSize || 32))) / 2);
    playerPosition = { x: centerX, y: centerY };
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

function createMapImage() {
  if (!logicalW || !logicalH) {
    console.warn('[createMapImage] aborted: logical size not set yet');
    return;
  }
  const w = logicalW * cellSize;
  const h = logicalH * cellSize;
  
  if (mapImage && typeof mapImage.remove === 'function') {
    try { mapImage.remove(); } catch (e) {}
  }
  mapImage = createGraphics(w, h);
  
 
  mapImage.pixelDensity(1); 
  

  try {
 
    enforceCanvasSharpness(mapImage.drawingContext);
    mapImage.noSmooth(); 
  } catch(e) {}

    if (decorObjectsDirty) {
      spawnDecorativeObjects();
      decorObjectsDirty = false;
    }

  const useSprites = showTextures && spritesheet && spritesheet.width > 1;
 
  

  const overlays = [];
  const TREE_PIXEL_SIZE = 64;

  for (let ly = 0; ly < logicalH; ly++) {
    for (let lx = 0; lx < logicalW; lx++) {
      const tileState = getTileState(lx, ly);
      const px = lx * cellSize;
      const py = ly * cellSize;
      let img = null;
      let imgDestW = cellSize;
      let imgDestH = cellSize;
      
      if (tileState === TILE_TYPES.FOREST && TILE_IMAGES['gentle_forest']) {
        img = TILE_IMAGES['gentle_forest'];
        imgDestW = img.width;
        imgDestH = img.height;
      } else if (tileState === TILE_TYPES.GRASS && TILE_IMAGES['tile_1']) {
        img = TILE_IMAGES['tile_1'];
        imgDestW = cellSize;
        imgDestH = cellSize;
      } else if (tileState === TILE_TYPES.TREE && TILE_IMAGES['tree_1']) {
        img = TILE_IMAGES['tree_1'];
        imgDestW = TREE_PIXEL_SIZE;
        imgDestH = TREE_PIXEL_SIZE;
      } else if (tileState === TILE_TYPES.RIVER && (TILE_IMAGES['water_1'] || TILE_IMAGES[TILE_TYPES.RIVER])) {
        img = TILE_IMAGES['water_1'] || TILE_IMAGES[TILE_TYPES.RIVER];
        imgDestW = cellSize;
        imgDestH = cellSize;
      } else if ((tileState === TILE_TYPES.RAMP || tileState === TILE_TYPES.LOG) && (TILE_IMAGES['bridge_1'] || TILE_IMAGES[TILE_TYPES.RAMP] || TILE_IMAGES[TILE_TYPES.LOG])) {
        img = TILE_IMAGES['bridge_1'] || TILE_IMAGES[TILE_TYPES.RAMP] || TILE_IMAGES[TILE_TYPES.LOG];
        imgDestW = cellSize;
        imgDestH = cellSize;
      } else if (TILE_IMAGES[tileState]) {
        img = TILE_IMAGES[tileState];
        imgDestW = img.width;
        imgDestH = img.height;
      }
      else if (tileState >= TILE_TYPES.HILL_NORTH && tileState <= TILE_TYPES.HILL_NORTHWEST) {
        
        const grassColor = getColorForState(TILE_TYPES.GRASS);
        const baseTileImg = (TILE_IMAGES && TILE_IMAGES['tile_1']) ? TILE_IMAGES['tile_1'] : null;
        if (baseTileImg) {
          mapImage.image(baseTileImg, px, py, cellSize, cellSize);
        } else {
          mapImage.fill(grassColor[0], grassColor[1], grassColor[2]);
          mapImage.noStroke();
          mapImage.rect(px, py, cellSize, cellSize);
        }

        const direction = Object.keys(TILE_TYPES).find(key => TILE_TYPES[key] === tileState).replace('HILL_', '').toLowerCase();
        img = HILL_ASSETS[direction];
        if (img) {
          imgDestW = cellSize;
          imgDestH = cellSize;
        }
      }
      
      if (img) {
        const drawX = px + Math.floor((cellSize - imgDestW) / 2);
        const drawY = py + (cellSize - imgDestH);
        
        // --- BRIDGE SHADOW ---
        if (tileState === TILE_TYPES.RAMP || tileState === TILE_TYPES.LOG) {
            mapImage.push();
            mapImage.noStroke();
            mapImage.fill(0, 0, 0, 80);
            mapImage.rect(px + 4, py + 4, cellSize, cellSize); // Simple drop shadow
            mapImage.pop();
        }

        mapImage.image(img, drawX, drawY, imgDestW, imgDestH);
      } else {
        const c = getColorForState(tileState);
        mapImage.fill(c[0], c[1], c[2]);
        mapImage.noStroke();
        mapImage.rect(px, py, cellSize, cellSize);
      }

      // --- RIVER BANKS ---
      if (tileState === TILE_TYPES.GRASS) {
          // Check for adjacent water
          const neighbors = [
              {dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1}
          ];
          let isNearWater = false;
          for (const n of neighbors) {
              if (getTileState(lx + n.dx, ly + n.dy) === TILE_TYPES.RIVER) {
                  isNearWater = true;
                  break;
              }
          }
          if (isNearWater) {
              mapImage.push();
              mapImage.noStroke();
              mapImage.fill(0, 0, 0, 40); // Subtle darkening for the bank
              mapImage.rect(px, py, cellSize, cellSize);
              mapImage.pop();
          }
      }

      if (tileState >= TILE_TYPES.HILL_NORTH && tileState <= TILE_TYPES.HILL_NORTHWEST) {
        try {
          const gradH = Math.max(8, Math.min(Math.floor(cellSize * 0.5), 48));
          const maxAlpha = 220;
          const grassImg = (TILE_IMAGES && TILE_IMAGES['tile_1']) ? TILE_IMAGES['tile_1'] : null;
          if (grassImg) {
            for (let row = 0; row < gradH; row++) {
              const y = cellSize - gradH + row;
              const alpha = map(row, 0, Math.max(1, gradH - 1), 0, maxAlpha);
              mapImage.noStroke();
              mapImage.tint(255, alpha);
              try {
                const srcH = Math.max(1, Math.floor((grassImg.height || 1) - 1));
                mapImage.image(grassImg, px, py + y, cellSize, 1, 0, srcH, grassImg.width, 1);
              } catch (e) {
                mapImage.image(grassImg, px, py + y, cellSize, 1);
              }
              mapImage.noTint();
            }
          } else {
            const grassColor2 = getColorForState(TILE_TYPES.GRASS);
            for (let y = cellSize - gradH; y < cellSize; y++) {
              let alpha = map(y, cellSize - gradH, cellSize, 0, maxAlpha);
              mapImage.noStroke();
              mapImage.fill(grassColor2[0], grassColor2[1], grassColor2[2], alpha);
              mapImage.rect(px, py + y, cellSize, 1);
            }
          }
        } catch (e) {}
      }
    }
  }

  if (Array.isArray(treeObjects) && treeObjects.length) {
    for (const t of treeObjects) {
      const px = t.x * cellSize;
      const py = t.y * cellSize;
      let destW = cellSize;
      let destH = cellSize;
      if (TREE_OVERLAY_IMG) {
        destW = TREE_PIXEL_SIZE;
        destH = TREE_PIXEL_SIZE;
      } else if (SPRITES && SPRITES[TILE_TYPES.FOREST]) {
        const s = SPRITES[TILE_TYPES.FOREST];
        destW = (s.drawW && Number(s.drawW) > 0) ? s.drawW : cellSize;
        destH = (s.drawH && Number(s.drawH) > 0) ? s.drawH : cellSize;
      }
      overlays.push({
        tileState: TILE_TYPES.FOREST,
        px, py,
        imgType: (TREE_OVERLAY_IMG ? 'image' : 'none'),
        img: TREE_OVERLAY_IMG || null,
        s: null,
        destW,
        destH,
        source: 'treeObject'
      });
    }
  }

  try {
    for (let ly = 0; ly < logicalH; ly++) {
      for (let lx = 0; lx < logicalW; lx++) {
        const ts = getTileState(lx, ly);
        if (ts !== TILE_TYPES.FOREST) continue;
        const px = lx * cellSize;
        const py = ly * cellSize;
        const exists = overlays.some(o => o && o.px === px && o.py === py);
        if (exists) continue;
        let destW = cellSize;
        let destH = cellSize;
        if (TREE_OVERLAY_IMG) {
            destW = TREE_PIXEL_SIZE;
            destH = TREE_PIXEL_SIZE;
        } else if (SPRITES && SPRITES[TILE_TYPES.FOREST]) {
          const s = SPRITES[TILE_TYPES.FOREST];
          destW = (s.drawW && Number(s.drawW) > 0) ? s.drawW : cellSize;
          destH = (s.drawH && Number(s.drawH) > 0) ? s.drawH : cellSize;
        }
        overlays.push({ tileState: TILE_TYPES.FOREST, px, py, imgType: (TREE_OVERLAY_IMG ? 'image' : 'none'), img: TREE_OVERLAY_IMG || null, s: null, destW, destH, source: 'mapForest' });
      }
    }
  } catch (e) {}

  overlays.sort((a, b) => ( (a.py + (cellSize - a.destH)) - (b.py + (cellSize - b.destH)) ));
  try {
    const total = (logicalW || 0) * (logicalH || 0);
    if (!edgeLayer || !(edgeLayer instanceof Uint8Array) || edgeLayer.length !== total) {
      edgeLayer = new Uint8Array(total);
    } else {
      edgeLayer.fill(0);
    }

    verboseLog('[game] overlays total=', overlays.length, 'sample=', overlays.slice(0,6).map(o=>({px:o.px,py:o.py,destW:o.destW,destH:o.destH,imgType:o.imgType})));
    for (const o of overlays) {
      if (!o || o.tileState !== TILE_TYPES.FOREST) continue;
      const drawX = o.px + Math.floor((cellSize - o.destW) / 2);
      const drawY = o.py + (cellSize - o.destH);
      const drawRight = drawX + o.destW;
      const drawBottom = drawY + o.destH;
      const minTileX = Math.max(0, Math.floor(drawX / cellSize));
      const maxTileX = Math.min(logicalW - 1, Math.floor((drawRight - 1) / cellSize));
      const minTileY = Math.max(0, Math.floor(drawY / cellSize));
      const maxTileY = Math.min(logicalH - 1, Math.floor((drawBottom - 1) / cellSize));
      const fromTreeObject = o.source === 'treeObject';
      const baseTileX = Math.max(0, Math.min(logicalW - 1, Math.floor(o.px / cellSize)));
      const baseTileY = Math.max(0, Math.min(logicalH - 1, Math.floor(o.py / cellSize)));
      let markedCount = 0;
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        if (fromTreeObject && ty !== baseTileY) continue;
        for (let tx = minTileX; tx <= maxTileX; tx++) {
          if (fromTreeObject && tx !== baseTileX) continue;
          try {
            const idx = ty * logicalW + tx;
            const ts = getTileState(tx, ty);
            if (isSolid(ts)) continue;
            let shouldMark = false;
            const tileLeft = tx * cellSize;
            const tileTop = ty * cellSize;
            const tileRight = tileLeft + cellSize;
            const tileBottom = tileTop + cellSize;
            const overlapLeft = Math.max(drawX, tileLeft);
            const overlapTop = Math.max(drawY, tileTop);
            const overlapRight = Math.min(drawRight, tileRight);
            const overlapBottom = Math.min(drawBottom, tileBottom);
            const overlapWidth = Math.max(0, overlapRight - overlapLeft);
            const overlapHeight = Math.max(0, overlapBottom - overlapTop);
            const coverage = (overlapWidth * overlapHeight) / (cellSize * cellSize);
            const coverageThreshold = fromTreeObject ? 0.05 : 0.45;
            if (coverage >= coverageThreshold) {
              shouldMark = true;
            } else if (fromTreeObject && tx === baseTileX && ty === baseTileY) {
              shouldMark = true;
            }
            if (!shouldMark) continue;
        
          } catch (e) {}
        }
      }
      try {
        for (const t of treeObjects) {
          if (!t) continue;
          if ((t.x * cellSize) === o.px && (t.y * cellSize) === o.py) {
            t._overlay = t._overlay || {};
            t._overlay.coveredTiles = { minTileX, maxTileX, minTileY, maxTileY };
          }
        }
      } catch (e) {}
    }
  } catch (e) {
    console.warn('[game] compute edgeLayer failed', e);
  }
  try {
    ensureEdgeLayerConnectivity();
  } catch (e) {
    console.warn('[game] ensureEdgeLayerConnectivity failed', e);
  }
  try {
    mapOverlays = overlays.slice();
  } catch (e) { mapOverlays = overlays; }
  try {
    if (!useSprites && edgeLayer && logicalW && logicalH) {
      if (!EDGE_LAYER_ENABLED) {
        verboseLog('[game] edgeLayer painting skipped because EDGE_LAYER_ENABLED=false');
      } else {
        let cnt = 0;
        for (let i = 0; i < edgeLayer.length; i++) cnt += edgeLayer[i] ? 1 : 0;
        verboseLog('[game] painting edgeLayer into raw mapImage - barrier tiles=', cnt, 'logical=', logicalW, 'x', logicalH, 'useSprites=', useSprites);
        mapImage.noStroke();
        const c = EDGE_LAYER_COLOR || [34, 120, 34, 200];
        mapImage.fill(c[0], c[1], c[2], c[3] || 200);
        for (let yy = 0; yy < logicalH; yy++) {
          for (let xx = 0; xx < logicalW; xx++) {
            const idx = yy * logicalW + xx;
            if (edgeLayer[idx]) {
              mapImage.rect(xx * cellSize, yy * cellSize, cellSize, cellSize);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[game] failed to paint edgeLayer into raw map image', e);
  }
  
  // --- MINIMAP CACHE ---
  if (mapImage) {
    try {
        if (minimapImage) minimapImage.remove();
        minimapImage = createGraphics(200, 200);
        
        const mapAspect = mapImage.width / mapImage.height;
        let drawW = 200;
        let drawH = 200 / mapAspect;
        if (drawH > 200) {
           drawH = 200;
           drawW = 200 * mapAspect;
        }
        
        minimapImage.background(0, 0, 0, 0); // Transparent
        minimapImage.image(mapImage, 0, 0, drawW, drawH);
    } catch(e) { console.warn('[game] failed to create minimap cache', e); }
  }
}

function ensureEdgeLayerConnectivity() {
  
  if (!EDGE_LAYER_ENABLED) return;
  if (!edgeLayer || !logicalW || !logicalH) return;
  const total = logicalW * logicalH;
  if (edgeLayer.length !== total) return;
  const reachableWithoutBarrier = floodReachable({ respectEdgeLayer: false });
  if (!reachableWithoutBarrier || reachableWithoutBarrier.length !== total) return;
  let reachableWithBarrier = floodReachable({ respectEdgeLayer: true });
  if (!reachableWithBarrier || reachableWithBarrier.length !== total) return;
  let needsFix = false;
  for (let i = 0; i < total; i++) {
    if (reachableWithoutBarrier[i] && !reachableWithBarrier[i]) {
      needsFix = true;
      break;
    }
  }
  if (!needsFix) return;
  let adjustments = 0;
  let iterations = 0;
  const maxIterations = 16;
  while (needsFix && iterations < maxIterations) {
    iterations++;
    let opened = 0;
    for (let idx = 0; idx < total; idx++) {
      if (!edgeLayer[idx]) continue;
      if (!reachableWithoutBarrier[idx]) continue;
      if (reachableWithBarrier[idx]) continue;
      const x = idx % logicalW;
      const y = Math.floor(idx / logicalW);
      let touchesReachable = false;
      if (x > 0 && reachableWithBarrier[idx - 1]) touchesReachable = true;
      if (!touchesReachable && x < logicalW - 1 && reachableWithBarrier[idx + 1]) touchesReachable = true;
      if (!touchesReachable && y > 0 && reachableWithBarrier[idx - logicalW]) touchesReachable = true;
      if (!touchesReachable && y < logicalH - 1 && reachableWithBarrier[idx + logicalW]) touchesReachable = true;
      if (!touchesReachable) continue;
      edgeLayer[idx] = 0;
      opened++;
      adjustments++;
      if (EDGE_LAYER_DEBUG) verboseLog('[game] connectivity fix: clearing barrier at', x, y);
    }
    if (!opened) break;
    reachableWithBarrier = floodReachable({ respectEdgeLayer: true });
    needsFix = false;
    for (let i = 0; i < total; i++) {
      if (reachableWithoutBarrier[i] && !reachableWithBarrier[i]) {
        needsFix = true;
        break;
      }
    }
  }
  if (adjustments > 0) {
    verboseLog('[game] ensureEdgeLayerConnectivity removed', adjustments, 'barrier tiles to keep paths accessible');
  }
}

function clearPreviousGameState() {
  try {
    if (mapImage && typeof mapImage.remove === 'function') {
      mapImage.remove();
    }
  } catch (e) {}
  mapImage = null;
  mapOverlays = [];
  decorativeObjects = [];
  decorativeObstacleTiles = new Set();
  treeObjects = [];
  enemies = [];
  counts = {};
  decorObjectsDirty = true;
  edgeLayer = null;
  mapStates = null;
  terrainLayer = null;
  playerPosition = null;
  renderX = renderY = renderStartX = renderStartY = renderTargetX = renderTargetY = 0;
  isMoving = false;
  queuedMove = null;
  isJumping = false;
  clouds.length = 0;
  lastCloudSpawn = 0;
  overlayProgress = 0;
  overlayProgressActive = false;
  overlayProgressLastUpdate = 0;
  showLoadingOverlay = true;
  mapLoadComplete = false;
}



const DECOR_MAX_DENSITY = 0.07;
const DECOR_MAX_OBSTACLE_DENSITY = 0.02;
const DECOR_WALKABLE_SPAWN_CHANCE = 0.06;
const DECOR_OBSTACLE_SPAWN_CHANCE = 0.025;

function markDecorObjectsDirty() {
  decorObjectsDirty = true;
}

function spawnDecorativeObjects() {
  if (!logicalW || !logicalH || !mapStates) return;
  decorativeObjects = [];
  decorativeObstacleTiles = new Set();
  const grassTiles = [];
  for (let y = 0; y < logicalH; y++) {
    for (let x = 0; x < logicalW; x++) {
      if (getTileState(x, y) === TILE_TYPES.GRASS) {
        grassTiles.push({ x, y });
      }
    }
  }
  if (!grassTiles.length) return;
  const maxDecor = Math.max(4, Math.round(grassTiles.length * DECOR_MAX_DENSITY));
  const maxObstacles = Math.max(1, Math.round(grassTiles.length * DECOR_MAX_OBSTACLE_DENSITY));
  let obstaclesPlaced = 0;
  const ordered = grassTiles.slice();
  shuffleArray(ordered);
  const occupied = new Set();

  const placeRandomDecor = (tile, type, pool) => {
    if (!pool || !pool.length) return false;
    const name = pool[Math.floor(Math.random() * pool.length)];
    decorativeObjects.push({ id: name, type, tileX: tile.x, tileY: tile.y });
    const idx = tile.y * logicalW + tile.x;
    occupied.add(idx);
    if (type === 'obstacle') decorativeObstacleTiles.add(idx);
    return true;
  };

  for (const tile of ordered) {
    if (decorativeObjects.length >= maxDecor) break;
    const tileIdx = tile.y * logicalW + tile.x;
    if (occupied.has(tileIdx)) continue;
    const roll = Math.random();
    if (obstaclesPlaced < maxObstacles && roll < DECOR_OBSTACLE_SPAWN_CHANCE) {
      if (placeRandomDecor(tile, 'obstacle', DECORATIVE_OBSTACLE_NAMES)) {
        obstaclesPlaced++;
      }
    } else if (roll < DECOR_OBSTACLE_SPAWN_CHANCE + DECOR_WALKABLE_SPAWN_CHANCE) {
      placeRandomDecor(tile, 'walkable', DECORATIVE_WALKABLE_NAMES);
    }
  }

  const anchorX = Math.max(0, Math.min(logicalW - 1, Math.floor(logicalW / 2)));
  const anchorY = Math.max(0, Math.min(logicalH - 1, Math.floor(logicalH / 2)));
  const holeCandidates = grassTiles.slice().sort((a, b) => {
    return (Math.hypot(a.x - anchorX, a.y - anchorY) - Math.hypot(b.x - anchorX, b.y - anchorY));
  });
  for (const tile of holeCandidates) {
    const idx = tile.y * logicalW + tile.x;
    if (occupied.has(idx)) continue;
    decorativeObjects.push({ id: DECOR_SPECIAL_NAMES[0], type: 'special', tileX: tile.x, tileY: tile.y });
    occupied.add(idx);
    break;
  }
}

function shuffleArray(array) {
  if (!Array.isArray(array) || array.length <= 1) return;
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}




// --- ENEMIES ---
function spawnEnemy(type, x, y) {
  if (type === 'mantis') {
    enemies.push(createMantis(x, y));
  }
}

function createMantis(startX, startY) {
  return {
    type: 'mantis',
    x: startX,
    y: startY,
    renderX: startX,
    renderY: startY,
    direction: 'S', // S, E, W, N
    moving: false,
    animFrame: 0,
    animTimer: 0,
    moveTimer: 0,
    
    // Attack properties
    attacking: false,
    attackFrame: 0,
    attackTimer: 0,
    attackCooldown: 0,
    hasDealtDamage: false,
    
    update: function() {
      const now = millis();
      const dt = gameDelta;

      // --- ATTACK STATE ---
      if (this.attacking) {
         this.attackTimer += dt;
         if (this.attackTimer > 100) { // Speed of attack animation
             this.attackTimer = 0;
             this.attackFrame++;
             
             // Damage Frame (e.g., frame 4)
             if (this.attackFrame === 4 && !this.hasDealtDamage) {
                 if (playerPosition) {
                     const dist = Math.hypot(playerPosition.x - this.x, playerPosition.y - this.y);
                     if (dist < 1.5) { // Still in range
                         playerHealth = Math.max(0, playerHealth - 1);
                         this.hasDealtDamage = true;
                         playerHurtTimer = 500; // Flash red for 500ms
                         // try { showToast('Took damage!', 'warn', 1000); } catch(e) {}
                     }
                 }
             }

             if (this.attackFrame >= 7) {
                 this.attacking = false;
                 this.attackCooldown = 1500; // 1.5s cooldown
                 this.attackFrame = 0;
             }
         }
         return; // Don't move while attacking
      }

      if (this.attackCooldown > 0) this.attackCooldown -= dt;

      // --- MOVEMENT & AGGRO ---
      this.animTimer += dt;
      if (this.animTimer > 200) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 4;
      }
      
      const speed = 0.15;
      if (Math.abs(this.renderX - this.x) > 0.01) this.renderX = lerp(this.renderX, this.x, speed);
      else this.renderX = this.x;
      
      if (Math.abs(this.renderY - this.y) > 0.01) this.renderY = lerp(this.renderY, this.y, speed);
      else this.renderY = this.y;
      
      if (this.moveTimer > 0) {
        this.moveTimer -= dt;
        return;
      }
      
      // AGGRO LOGIC
      let targetX = null;
      let targetY = null;
      let isAggro = false;

      if (playerPosition) {
          const dist = Math.hypot(playerPosition.x - this.x, playerPosition.y - this.y);
          
          // Trigger Attack if close and cooldown ready
          if (dist < 1.5 && this.attackCooldown <= 0) {
              this.attacking = true;
              this.attackFrame = 0;
              this.attackTimer = 0;
              this.hasDealtDamage = false;
              // Face player before attacking
              const dx = playerPosition.x - this.x;
              const dy = playerPosition.y - this.y;
              if (Math.abs(dx) > Math.abs(dy)) {
                  this.direction = dx > 0 ? 'E' : 'W';
              } else {
                  this.direction = dy > 0 ? 'S' : 'N';
              }
              return;
          }

          if (dist < 8) { // Aggro range
             isAggro = true;
             targetX = playerPosition.x;
             targetY = playerPosition.y;
          }
      }

      if (isAggro) {
          const dx = targetX - this.x;
          const dy = targetY - this.y;
          
          let moveX = 0;
          let moveY = 0;
          let newDir = this.direction;

          if (Math.abs(dx) > Math.abs(dy)) {
              if (dx > 0) { moveX = 1; newDir = 'E'; }
              else { moveX = -1; newDir = 'W'; }
          } else {
              if (dy > 0) { moveY = 1; newDir = 'S'; }
              else { moveY = -1; newDir = 'N'; }
          }
          
          // Try primary direction
          let nx = this.x + moveX;
          let ny = this.y + moveY;
          let canMove = false;
          
          if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH && typeof isSolid === 'function' && !isSolid(getTileState(nx, ny))) {
              canMove = true;
          } else {
             // Try secondary axis if primary blocked
             moveX = 0; moveY = 0;
             if (Math.abs(dx) > Math.abs(dy)) { // Original was X, try Y
                 if (dy > 0) { moveY = 1; newDir = 'S'; } else if (dy < 0) { moveY = -1; newDir = 'N'; }
             } else { // Original was Y, try X
                 if (dx > 0) { moveX = 1; newDir = 'E'; } else if (dx < 0) { moveX = -1; newDir = 'W'; }
             }
             if (moveX !== 0 || moveY !== 0) {
                 nx = this.x + moveX;
                 ny = this.y + moveY;
                 if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH && typeof isSolid === 'function' && !isSolid(getTileState(nx, ny))) {
                     canMove = true;
                 }
             }
          }

          if (canMove) {
              this.x = nx;
              this.y = ny;
              this.direction = newDir;
              let waitTime = 400;
              if (getTileState(this.x, this.y) === TILE_TYPES.RIVER) waitTime *= 2.0;
              this.moveTimer = waitTime; // Faster movement when aggro
              return;
          }
      }

      // IDLE WANDER
      if (Math.random() < 0.02) {
        const dirs = [
            { dx: 0, dy: 1, dir: 'S' },
            { dx: 0, dy: -1, dir: 'N' },
            { dx: 1, dy: 0, dir: 'E' },
            { dx: -1, dy: 0, dir: 'W' }
        ];
        const choice = dirs[Math.floor(Math.random() * dirs.length)];
        const nx = this.x + choice.dx;
        const ny = this.y + choice.dy;
        
        if (nx >= 0 && nx < logicalW && ny >= 0 && ny < logicalH) {
            if (typeof isSolid === 'function' && !isSolid(getTileState(nx, ny))) {
                this.x = nx;
                this.y = ny;
                this.direction = choice.dir;
                let waitTime = 1000 + Math.random() * 2000;
                if (getTileState(this.x, this.y) === TILE_TYPES.RIVER) waitTime *= 2.0;
                this.moveTimer = waitTime;
            }
        }
      }
    },
    
    draw: function() {
        let sprite = mantisMoveSprite;
        let frame = this.animFrame;
        let cols = 4;
        let maxFrames = 4;

        if (this.attacking && mantisAttackSprite) {
            sprite = mantisAttackSprite;
            frame = this.attackFrame;
            cols = 7;
            maxFrames = 7;
        }

        if (!sprite) return;
        
        let row = 0;
        if (this.direction === 'S') row = 0;
        else if (this.direction === 'E') row = 1;
        else if (this.direction === 'W') row = 2;
        else if (this.direction === 'N') row = 3;
        
        const fw = sprite.width / cols;
        const fh = sprite.height / 4;
        
        const sx = frame * fw;
        const sy = row * fh;
        
        const destX = this.renderX * cellSize;
        const destY = this.renderY * cellSize;
        
        // Draw slightly larger than cell
        const drawH = cellSize * 1.2;
        const drawW = drawH * (fw / fh);
        
        const drawX = destX + (cellSize - drawW) / 2;
        const drawY = destY + (cellSize - drawH); // anchor bottom
        
        image(sprite, drawX, drawY, drawW, drawH, sx, sy, fw, fh);
    }
  };
}

function updateEnemies() {
  if (!enemies) return;
  for (const e of enemies) {
    if (e.update) e.update();
  }
}

// --- CHARACTER & MOVEMENT ---
// handleMovement() -
// tryMoveDirection(keyChar)
// handleItemInteraction(targetX, targetY)
// canMoveTo(fromX, fromY, toX, toY)
// isSolid(tileState)
// getTileState(x, y, layer) /
// deltaToDirection(dx, dy)
// directionToDelta(dir)
// startMoveVisual(prevX, prevY, newX, newY)
// updateMovementInterpolation()
// updateSprintState()
// getActiveMoveDurationMs()
// getActiveMoveCooldownMs()
// getCellSizeSpeedScale()
// drawPlayer()
// findFloodStart()
// floodReachable(options) /
// neighbors(x, y)
function handleMovement() {
  updateSprintState();
  if (isJumping || (isMoving && (millis() - lastMoveTime < getActiveMoveCooldownMs()))) return;
  const nowA = keyIsDown(65);
  const nowD = keyIsDown(68);
  const nowW = keyIsDown(87);
  const nowS = keyIsDown(83);
  const now = millis();
  let moved = false;
  let targetX = playerPosition.x;
  let targetY = playerPosition.y;
  const maxTileX = (logicalW || 0) - 1;
  const maxTileY = (logicalH || 0) - 1;
  function keyTriggered(keyNow, prevKey, holdObj) {
    if (keyNow && !prevKey) {
      holdObj.start = now;
      holdObj.last = now;
      return true;
    }
    if (keyNow && prevKey) {
      if (holdObj.start > 0 && (now - holdObj.start >= HOLD_INITIAL_DELAY_MS) && (now - holdObj.last >= HOLD_REPEAT_INTERVAL_MS)) {
        holdObj.last = now;
        return true;
      }
      return false;
    }
    holdObj.start = 0;
    holdObj.last = 0;
    return false;
  }
  const A_trig = keyTriggered(nowA, prevKeyA, holdState.A);
  const D_trig = keyTriggered(nowD, prevKeyD, holdState.D);
  const W_trig = keyTriggered(nowW, prevKeyW, holdState.W);
  const S_trig = keyTriggered(nowS, prevKeyS, holdState.S);
  if (A_trig) { facing = 'left'; targetX--; moved = true; }
  else if (D_trig) { facing = 'right'; targetX++; moved = true; }
  if (W_trig) { targetY--; moved = true; }
  else if (S_trig) { targetY++; moved = true; }
  if (targetX < 0) targetX = 0;
  if (targetY < 0) targetY = 0;
  if (targetX > maxTileX) targetX = maxTileX;
  if (targetY > maxTileY) targetY = maxTileY;
  if (moved) {
    if (canMoveTo(playerPosition.x, playerPosition.y, targetX, targetY)) {
      handleItemInteraction(targetX, targetY);
      const prevX = playerPosition.x;
      const prevY = playerPosition.y;
      if (isMoving) {
        const qx = Math.max(0, Math.min(targetX, maxTileX));
        const qy = Math.max(0, Math.min(targetY, maxTileY));
        queuedMove = { prevX, prevY, targetX: qx, targetY: qy };
      } else {
        playerPosition.x = targetX;
        playerPosition.y = targetY;
        lastMoveDX = playerPosition.x - prevX;
        lastMoveDY = playerPosition.y - prevY;
        lastDirection = deltaToDirection(lastMoveDX, lastMoveDY);
        startMoveVisual(prevX, prevY, playerPosition.x, playerPosition.y);
      }
    }
  }
  prevKeyA = nowA;
  prevKeyD = nowD;
  prevKeyW = nowW;
  prevKeyS = nowS;
}

function tryMoveDirection(keyChar) {
  if (!playerPosition) return;
  const k = keyChar ? keyChar.toUpperCase() : '';
  let targetX = playerPosition.x;
  let targetY = playerPosition.y;
  if (k === 'A') { facing = 'left'; targetX--; }
  else if (k === 'D') { facing = 'right'; targetX++; }
  else if (k === 'W') { targetY--; }
  else if (k === 'S') { targetY++; }
  else return;
  const maxTileX = (logicalW || 0) - 1;
  const maxTileY = (logicalH || 0) - 1;
  targetX = Math.max(0, Math.min(targetX, maxTileX));
  targetY = Math.max(0, Math.min(targetY, maxTileY));
  if (!canMoveTo(playerPosition.x, playerPosition.y, targetX, targetY)) return;
  handleItemInteraction(targetX, targetY);
  const prevX = playerPosition.x;
  const prevY = playerPosition.y;
  if (isMoving) {
    queuedMove = { prevX, prevY, targetX, targetY };
  } else {
    playerPosition.x = targetX;
    playerPosition.y = targetY;
    lastMoveDX = playerPosition.x - prevX;
    lastMoveDY = playerPosition.y - prevY;
    lastDirection = deltaToDirection(lastMoveDX, lastMoveDY);
    startMoveVisual(prevX, prevY, playerPosition.x, playerPosition.y);
  }
  const now = millis();
  if (k === 'A') { holdState.A.start = now; holdState.A.last = now; prevKeyA = true; }
  if (k === 'D') { holdState.D.start = now; holdState.D.last = now; prevKeyD = true; }
  if (k === 'W') { holdState.W.start = now; holdState.W.last = now; prevKeyW = true; }
  if (k === 'S') { holdState.S.start = now; holdState.S.last = now; prevKeyS = true; }
}

function handleItemInteraction(targetX, targetY) {
  const tileIdx = targetY * logicalW + targetX;
  const tileState = mapStates[tileIdx];
  if (!ITEM_DATA.hasOwnProperty(tileState)) return;
  const item = ITEM_DATA[tileState];
  verboseLog(`Player interacted with ${item.label}`);
  switch (tileState) {
    case TILE_TYPES.CHEST:
      break;
    case TILE_TYPES.HEALTH:
      break;
    case TILE_TYPES.POWERUP:
      break;
  }
  const underlyingTerrain = terrainLayer[tileIdx] || TILE_TYPES.GRASS;
  mapStates[tileIdx] = underlyingTerrain;
  const useSprites = showTextures && spritesheet;
  drawTile(mapImage, targetX, targetY, underlyingTerrain, useSprites);
}

function canMoveTo(fromX, fromY, toX, toY) {
  const toState = getTileState(toX, toY);
  const targetIdx = toY * logicalW + toX;
  if (decorativeObstacleTiles.has(targetIdx)) return false;
  
  if (typeof TILE_TYPES !== 'undefined' && TILE_TYPES && typeof TILE_TYPES.HILL_NORTH === 'number') {
    const hillMin = TILE_TYPES.HILL_NORTH;
    const hillMax = TILE_TYPES.HILL_NORTHWEST;
    if (toState >= hillMin && toState <= hillMax) {
      if (isJumping) {
        return true; 
      } else {
        return false;
      }
    }
  }
  if (isSolid(toState)) return false;
  try {
    if (EDGE_LAYER_ENABLED && edgeLayer && logicalW && logicalH) {
      if (toX >= 0 && toX < logicalW && toY >= 0 && toY < logicalH) {
        const idx = toY * logicalW + toX;
        if (edgeLayer[idx]) return false;
      }
    }
  } catch (e) {  }
  return true;
}

function isSolid(tileState) {
  
  if (WALKABLE_TILES.has(tileState)) {
    return false;
  }

  
  if (ITEM_DATA.hasOwnProperty(tileState)) {
    return false;
  }
  
  
  if (tileState === TILE_TYPES.MOB) {
      return false;
  }

  
  return true;
}

function deltaToDirection(dx, dy) {
  const eps = 0.01;
  if (Math.abs(dx) <= eps && Math.abs(dy) <= eps) return lastDirection || 'S';
  if (dx < -eps && dy > eps) return 'SW';
  if (dx < -eps && Math.abs(dy) <= eps) return 'W';
  if (dx < -eps && dy < -eps) return 'NW';
  if (Math.abs(dx) <= eps && dy < -eps) return 'N';
  if (Math.abs(dx) <= eps && dy > eps) return 'S';
  if (dx > eps && dy > eps) return 'SE';
  if (dx > eps && Math.abs(dy) <= eps) return 'E';
  if (dx > eps && dy < -eps) return 'NE';
  return 'S';
}

function directionToDelta(dir) {
  
  switch ((dir || '').toUpperCase()) {
    case 'N':  return { dx: 0, dy: -1 };
    case 'NE': return { dx: 1, dy: -1 };
    case 'E':  return { dx: 1, dy: 0 };
    case 'SE': return { dx: 1, dy: 1 };
    case 'S':  return { dx: 0, dy: 1 };
    case 'SW': return { dx: -1, dy: 1 };
    case 'W':  return { dx: -1, dy: 0 };
    case 'NW': return { dx: -1, dy: -1 };
    default:   return { dx: 0, dy: 0 };
  }
}

function startMoveVisual(prevX, prevY, newX, newY) {
  lastMoveDurationMs = getActiveMoveDurationMs();
  renderStartX = isNaN(renderX) ? prevX : renderX;
  renderStartY = isNaN(renderY) ? prevY : renderY;
  renderTargetX = newX;
  renderTargetY = newY;
  moveStartMillis = millis();
  isMoving = true;
}

function updateMovementInterpolation() {
  if (!isMoving) return;
  const elapsed = millis() - moveStartMillis;
  const duration = Math.max(1, lastMoveDurationMs);
  const t = constrain(elapsed / duration, 0, 1);
  renderX = lerp(renderStartX, renderTargetX, t);
  renderY = lerp(renderStartY, renderTargetY, t);
  if (t >= 1) {
    isMoving = false;
    renderStartX = renderTargetX;
    renderStartY = renderTargetY;
    if (queuedMove) {
      const q = queuedMove;
      queuedMove = null;
      playerPosition.x = q.targetX;
      playerPosition.y = q.targetY;
      lastMoveDX = playerPosition.x - q.prevX;
      lastMoveDY = playerPosition.y - q.prevY;
      lastDirection = deltaToDirection(lastMoveDX, lastMoveDY);
      startMoveVisual(renderStartX, renderStartY, playerPosition.x, playerPosition.y);
    } else {
      lastMoveTime = millis();
    }
  }
}

function updateSprintState() {
  const now = millis();
  const shiftHeld = keyIsDown(16);

  if (typeof sprintLastUpdate !== 'number' || sprintLastUpdate <= 0) sprintLastUpdate = now;
  const dt = Math.max(0, now - sprintLastUpdate);
  sprintLastUpdate = now;

  if (sprintActive) {
  
    sprintRemainingMs = Math.max(0, sprintRemainingMs - dt);
    if (!shiftHeld || sprintRemainingMs <= 0) {
      sprintActive = false;
      sprintCooldownUntil = now + SPRINT_COOLDOWN_MS;
    }
  } else {

    if (sprintRemainingMs < SPRINT_MAX_DURATION_MS) {
      sprintRemainingMs = Math.min(SPRINT_MAX_DURATION_MS, sprintRemainingMs + dt);
    }


    if (sprintRemainingMs >= SPRINT_MAX_DURATION_MS) {
      sprintRemainingMs = SPRINT_MAX_DURATION_MS;
      sprintCooldownUntil = 0;
    }


    if (shiftHeld && now >= sprintCooldownUntil && sprintRemainingMs > 0) {
      sprintActive = true;
      sprintLastUpdate = now;
    }
  }
}

function getActiveMoveDurationMs() {
  const base = sprintActive ? SPRINT_MOVE_DURATION_MS : BASE_MOVE_DURATION_MS;
  let multiplier = 1.0;
  if (playerPosition && getTileState(playerPosition.x, playerPosition.y) === TILE_TYPES.RIVER) {
    multiplier = 1.5;
  }
  return Math.max(1, Math.round(base * multiplier * getCellSizeSpeedScale()));
}

function getActiveMoveCooldownMs() {
  const base = sprintActive ? SPRINT_MOVE_COOLDOWN_MS : BASE_MOVE_COOLDOWN_MS;
  let multiplier = 1.0;
  if (playerPosition && getTileState(playerPosition.x, playerPosition.y) === TILE_TYPES.RIVER) {
    multiplier = 1.5;
  }
  return Math.max(0, Math.round(base * multiplier * getCellSizeSpeedScale()));
}

function getCellSizeSpeedScale() {
  const BASE_CELL_SIZE = 32;
  if (typeof cellSize !== 'number' || cellSize <= 0) return 1;
  return cellSize / BASE_CELL_SIZE;
}

function drawPlayer() {
  if (playerHurtTimer > 0) {
     tint(255, 0, 0);
     playerHurtTimer -= gameDelta;
  }
  _drawPlayerInternal();
  noTint();
}

function _drawPlayerInternal() {
  const inputLeft  = keyIsDown && keyIsDown(65);
  const inputRight = keyIsDown && keyIsDown(68);
  const inputUp    = keyIsDown && keyIsDown(87);
  const inputDown  = keyIsDown && keyIsDown(83);
  const inputWalking = !!(inputLeft || inputRight || inputUp || inputDown);
  const drawTileX = isMoving ? renderX : playerPosition.x;
  const drawTileY = isMoving ? renderY : playerPosition.y;
  const destX = drawTileX * cellSize;
  let destY = drawTileY * cellSize;

  // Determine if in water for visual clipping
  let inWater = false;
  if (getTileState(Math.floor(drawTileX + 0.5), Math.floor(drawTileY + 0.5)) === TILE_TYPES.RIVER) {
      inWater = true;
  }
  const clipFactor = inWater ? 0.75 : 1.0; // Show only top 75% if in water

  if (isJumping) {
    const jumpProgress = (jumpTimer % JUMP_DURATION) / JUMP_DURATION;
    const jumpHeight = Math.sin(jumpProgress * Math.PI) * cellSize * 1.5; 
    destY -= jumpHeight;

    jumpTimer += gameDelta;
    if (jumpTimer >= JUMP_DURATION) {
      isJumping = false;
      jumpTimer = 0;
    }

    jumpFrame = Math.floor((jumpTimer / JUMP_ANIM_SPEED) % JUMP_FRAME_COUNT);
    
    const dir = lastDirection || 'S';
    const sheet = jumpSheets[dir];
    if (sheet) {
        const fw = sheet.width / JUMP_FRAME_COUNT;
        const fh = sheet.height;
        const sx = jumpFrame * fw;
        const sy = 0;
        const desiredHeight = cellSize * 1.25;
        const scale = desiredHeight / fh;
        const drawW = fw * scale;
        const drawH = (fh * scale) * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - (fh * scale); // Top stays same
        push(); noSmooth();
        image(sheet, drawX, drawY, drawW, drawH, sx, sy, fw, fh * clipFactor);
        pop();
        return; 
    }
  }

  let dir = null;
  if (isMoving) {
    const dx = renderTargetX - renderStartX;
    const dy = renderTargetY - renderStartY;
    dir = deltaToDirection(dx, dy);
  } else if (inputWalking) {
    const dx = (inputRight ? 1 : 0) + (inputLeft ? -1 : 0);
    const dy = (inputDown ? 1 : 0) + (inputUp ? -1 : 0);
    dir = deltaToDirection(dx, dy);
    if (dx < 0) facing = 'left';
    else if (dx > 0) facing = 'right';
  } else {
    dir = lastDirection || 'S';
  }
  const movingForAnimation = isMoving || inputWalking;
  const action = movingForAnimation ? (sprintActive ? 'run' : 'walk') : 'idle';
  let cols = IDLE_SHEET_COLS;
  if (action === 'walk') cols = WALK_SHEET_COLS;
  else if (action === 'run') cols = RUN_SHEET_COLS;
  playerAnimTimer += gameDelta;
  if (playerAnimTimer >= playerAnimSpeed) {
    playerAnimTimer -= playerAnimSpeed;
    playerAnimFrame = (playerAnimFrame + 1) % cols;
  }
  const colIndex = Math.floor(playerAnimFrame) % cols;
  if (movingForAnimation) {
    if (action === 'walk') {
      const frameImgWalk = (walkFrames[dir] && walkFrames[dir][colIndex]) ? walkFrames[dir][colIndex] : null;
      if (frameImgWalk) {
        const fw = frameImgWalk.width;
        const fh = frameImgWalk.height;
        const desiredHeight = cellSize * 1.25;
        const scale = desiredHeight / fh;
        const drawW = fw * scale;
        const drawH = (fh * scale) * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - (fh * scale);
        push(); noSmooth(); 
        image(frameImgWalk, drawX, drawY, drawW, drawH, 0, 0, fw, fh * clipFactor); 
        pop();
        return;
      }
      const dirSheetWalk = walkSheets[dir] || null;
      if (dirSheetWalk) {
        const sheet = dirSheetWalk;
        const fw = sheet.width / cols;
        const fh = sheet.height;
        const sx = colIndex * fw;
        const sy = 0;
        const desiredHeight = cellSize * 1.25;
        const scale = desiredHeight / fh;
        const drawW = fw * scale;
        const drawH = (fh * scale) * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - (fh * scale);
        push(); noSmooth();
        if (facing === 'left') image(sheet, drawX + drawW, drawY, -drawW, drawH, sx, sy, fw, fh * clipFactor);
        else image(sheet, drawX, drawY, drawW, drawH, sx, sy, fw, fh * clipFactor);
        pop();
        return;
      }
      if (spritesheetWalk) {
        const fw = spritesheetWalk.width / cols;
        const fh = spritesheetWalk.height;
        const sx = colIndex * fw;
        const sy = 0;
        const desiredHeight = cellSize * 1.25;
        const scale = desiredHeight / fh;
        const drawW = fw * scale;
        const drawH = (fh * scale) * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - (fh * scale);
        push(); noSmooth();
        if (facing === 'left') image(spritesheetWalk, drawX + drawW, drawY, -drawW, drawH, sx, sy, fw, fh * clipFactor);
        else image(spritesheetWalk, drawX, drawY, drawW, drawH, sx, sy, fw, fh * clipFactor);
        pop();
        return;
      }
    } else if (action === 'run') {
      const frameImgRun = (runFrames[dir] && runFrames[dir][colIndex]) ? runFrames[dir][colIndex] : null;
      if (frameImgRun) {
        const fw = frameImgRun.width;
        const fh = frameImgRun.height;
        const desiredHeight = cellSize * 1.25;
        const scale = desiredHeight / fh;
        const drawW = fw * scale;
        const drawH = (fh * scale) * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - (fh * scale);
        push(); noSmooth(); image(frameImgRun, drawX, drawY, drawW, drawH, 0, 0, fw, fh * clipFactor); pop();
        return;
      }
      const dirSheetRun = runSheets[dir] || null;
      if (dirSheetRun) {
        const sheet = dirSheetRun;
        const fw = sheet.width / cols;
        const fh = sheet.height;
        const sx = colIndex * fw;
        const sy = 0;
        const desiredHeight = cellSize * 1.25;
        const scale = desiredHeight / fh;
        const drawW = fw * scale;
        const drawH = (fh * scale) * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - (fh * scale);
        push(); noSmooth();
        if (facing === 'left') image(sheet, drawX + drawW, drawY, -drawW, drawH, sx, sy, fw, fh * clipFactor);
        else image(sheet, drawX, drawY, drawW, drawH, sx, sy, fw, fh * clipFactor);
        pop();
        return;
      }
      if (spritesheetRun) {
        const fw = spritesheetRun.width / cols;
        const fh = spritesheetRun.height;
        const sx = colIndex * fw;
        const sy = 0;
        const desiredHeight = cellSize * 1.25;
        const scale = desiredHeight / fh;
        const drawW = fw * scale;
        const drawH = (fh * scale) * clipFactor;
        const drawX = destX + (cellSize / 2) - (drawW / 2);
        const drawY = destY + cellSize - (fh * scale);
        push(); noSmooth();
        if (facing === 'left') image(spritesheetRun, drawX + drawW, drawY, -drawW, drawH, sx, sy, fw, fh * clipFactor);
        else image(spritesheetRun, drawX, drawY, drawW, drawH, sx, sy, fw, fh * clipFactor);
        pop();
        return;
      }
    }
  }
  const frameImg = (idleFrames[dir] && idleFrames[dir][colIndex]) ? idleFrames[dir][colIndex] : null;
  if (frameImg) {
    const fw = frameImg.width;
    const fh = frameImg.height;
    const desiredHeight = cellSize * 1.25;
    const scale = desiredHeight / fh;
    const drawW = fw * scale;
    const drawH = (fh * scale) * clipFactor;
    const drawX = destX + (cellSize / 2) - (drawW / 2);
    const drawY = destY + cellSize - (fh * scale);
    push(); noSmooth(); image(frameImg, drawX, drawY, drawW, drawH, 0, 0, fw, fh * clipFactor); pop();
    return;
  }
  const dirSheet = idleSheets[dir] || null;
  if (dirSheet) {
    const sheet = dirSheet;
    const fw = sheet.width / cols;
    const fh = sheet.height;
    const sx = colIndex * fw;
    const sy = 0;
    const desiredHeight = cellSize * 1.25;
    const scale = desiredHeight / fh;
    const drawW = fw * scale;
    const drawH = (fh * scale) * clipFactor;
    const drawX = destX + (cellSize / 2) - (drawW / 2);
    const drawY = destY + cellSize - (fh * scale);
    push(); noSmooth();
    if (facing === 'left') image(sheet, drawX + drawW, drawY, -drawW, drawH, sx, sy, fw, fh * clipFactor);
    else image(sheet, drawX, drawY, drawW, drawH, sx, sy, fw, fh * clipFactor);
    pop();
    return;
  }
  if (spritesheetIdle) {
    const rows = IDLE_SHEET_ROWS;
    const fw = spritesheetIdle.width / cols;
    const fh = spritesheetIdle.height / rows;
    let rowIndex = 0;
    let flip = false;
    switch (dir) {
      case 'S': rowIndex = 0; break;
      case 'SW': rowIndex = 1; break;
      case 'W': rowIndex = 2; break;
      case 'NW': rowIndex = 3; break;
      case 'N': rowIndex = 4; break;
      case 'SE': rowIndex = 1; flip = true; break;
      case 'E': rowIndex = 2; flip = true; break;
      case 'NE': rowIndex = 3; flip = true; break;
      default: rowIndex = 0; break;
    }
    if (dir.includes('W')) facing = 'left';
    else if (dir.includes('E')) facing = 'right';
    const sx = colIndex * fw;
    const sy = rowIndex * fh;
    const desiredHeight = cellSize * 1.25;
    const scale = desiredHeight / fh;
    const drawW = fw * scale;
    const drawH = (fh * scale) * clipFactor;
    const drawX = destX + (cellSize / 2) - (drawW / 2);
    const drawY = destY + cellSize - (fh * scale);
    push(); noSmooth();
    if (flip || facing === 'left') image(spritesheetIdle, drawX + drawW, drawY, -drawW, drawH, sx, sy, fw, fh * clipFactor);
    else image(spritesheetIdle, drawX, drawY, drawW, drawH, sx, sy, fw, fh * clipFactor);
    pop();
    return;
  }
  push();
  noStroke();
  fill(COLORS.player);
  rect(destX, destY, cellSize, cellSize);
  pop();
}

function findFloodStart() {
  if (!logicalW || !logicalH) return -1;
  const candidates = [];
  if (playerPosition && typeof playerPosition.x === 'number' && typeof playerPosition.y === 'number') {
    candidates.push({ x: Math.round(playerPosition.x), y: Math.round(playerPosition.y) });
  }
  candidates.push({ x: Math.floor(logicalW / 2), y: Math.floor(logicalH / 2) });
  for (const c of candidates) {
    if (!c) continue;
    const { x, y } = c;
    if (x < 0 || x >= logicalW || y < 0 || y >= logicalH) continue;
    const state = getTileState(x, y);
    if (!isSolid(state)) {
      return y * logicalW + x;
    }
  }
  for (let idx = 0; idx < logicalW * logicalH; idx++) {
    const x = idx % logicalW;
    const y = Math.floor(idx / logicalW);
    const state = getTileState(x, y);
    if (!isSolid(state)) return idx;
  }
  return -1;
}

function neighbors(x, y) {
  const out = [];
  if (x > 0) out.push({ x: x - 1, y });
  if (x < logicalW - 1) out.push({ x: x + 1, y });
  if (y > 0) out.push({ x, y: y - 1 });
  if (y < logicalH - 1) out.push({ x, y: y + 1 });
  return out;
}









//UI & MENUS
// drawInGameMenu()
// openInGameSettings(payload) /
// closeInGameSettings()
// renderSettingsCategories()
// showSubSettings(label)
// showSubSettingsInGame(label)
// createSettingsContext({ cx, startY, spacingY })
// hideCategoryButtons()
// hideBottomButtons()
// hideMainMenu()
// hideSettingsMenu()
// clearSubSettings()
// updateLoadingOverlayDom()
// ensureLoadingOverlayDom()
// showToast(message, type, duration)
// drawDifficultyBadge()
// drawSprintMeter()
// styleButton(btn)
// styleSmallButton(btn)
// stylePixelButton(btn)
// makeBtn(label, x, y, w, h, cb)

let inGameMenuOverlay = null;
let _lastEscToggleAt = 0;


const BASE_DPR = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
let __zoomProbeEl = null;

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
  
    return rect.width / 96;
  } catch (e) { return null; }
}

let lastLoggedZoom = null;
const ZOOM_DIAGNOSTIC_ENABLED = true;
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
    const dprZoom = (window.devicePixelRatio) / (BASE_DPR || 1);
    candidates.push(dprZoom);
  }
  if (window.outerWidth && window.innerWidth) {
    candidates.push(window.outerWidth / window.innerWidth);
  }
  const zoom = candidates.find(v => v && isFinite(v) && v > 0.05 && v < 20) || 1;
  const clamped = Math.max(0.1, Math.min(10, zoom));
  if (ZOOM_DIAGNOSTIC_ENABLED) {
    if (!lastLoggedZoom || Math.abs(clamped - lastLoggedZoom) > 0.01) {
      console.log('[zoom] estimated browser zoom =', clamped, '(candidates', candidates, ')');
      lastLoggedZoom = clamped;
    }
  }
  return clamped;
}


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

function openInGameMenu() {
  if (inGameMenuOverlay) {
    inGameMenuOverlay.close();
    inGameMenuOverlay = null;
  }
  try {
    loadLocalSettings();
  } catch (e) {}
  try { applyCurrentTextSize(); } catch (e) {}
  
  inGameMenuVisible = true;
  
  const { container, panel, close } = createZoomStablePanel(420, 320, 'gd-ingame-menu');
  inGameMenuOverlay = { close, container };

  let title = createDiv('PAUSED');
  title.parent(panel);
  title.style('font-size', '48px');
  title.style('font-weight', 'bold');
  title.style('margin-bottom', '40px');
  title.style('color', MENU_GOLD_COLOR);
  title.style('text-shadow', '3px 3px 0 #000');

  const createMenuBtn = (label, onClick) => {
    let btn = createButton(label);
    btn.parent(panel);
    btn.style('margin-bottom', '20px');
    applyMenuButtonUI(btn, 260, 48);
    btn.mousePressed(onClick);
    return btn;
  };

  createMenuBtn('RESUME', () => {
    closeInGameMenu();
  });

  createMenuBtn('SETTINGS', () => {
    inGameMenuOverlay.close();
    inGameMenuOverlay = null;
    openInGameSettings({ masterVol, musicVol, sfxVol, difficulty: currentDifficulty });
  });

  createMenuBtn('EXIT', () => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'close-game-overlay' }, '*');
      }
    } catch (e) {}
  });
}

function closeInGameMenu() {
  if (inGameMenuOverlay) {
    inGameMenuOverlay.close();
    inGameMenuOverlay = null;
  }
  inGameMenuVisible = false;
  try { if (typeof applyCurrentTextSize === 'function') applyCurrentTextSize(); } catch(e) {}
}

function drawHealthBar() {
  if (!heartImage) return;
  const startX = 20;
  const startY = 20;
  const heartSpacing = 35;
  const heartSize = 32;
  
  push();
  for (let i = 0; i < maxHealth; i++) {
    const x = startX + (i * heartSpacing);
    if (i < playerHealth) {
       // Full heart
       tint(255, 255);
       image(heartImage, x, startY, heartSize, heartSize);
    } else {
       // Empty/Lost heart (dimmed)
       tint(100, 100); 
       image(heartImage, x, startY, heartSize, heartSize);
    }
  }
  noTint();
  pop();
}

function drawInGameMenu() { return; }
function drawInGameMenu_OLD() {
  if (!inGameMenuVisible) return;
  try {
    push();
    
  
    const vW = virtualW || (width / gameScale);
    const vH = virtualH || (height / gameScale);

    
    let currentHoveredId = null;
    const mx = mouseX / gameScale;
    const my = mouseY / gameScale;
    
    if (typeof mx === 'number' && typeof my === 'number') {
      for (let i = inGameMenuButtonRects.length - 1; i >= 0; i--) {
        const r = inGameMenuButtonRects[i];
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          currentHoveredId = r.id;
          break;
        }
      }
    }
    inGameMenuHovered = currentHoveredId;


    noStroke();
    fill(0, 0, 0, 200);
    rect(0, 0, vW, vH); 


    const panelW = 500; 
    const panelH = 400;
    
    const px = Math.floor((vW - panelW) / 2);
    const py = Math.floor((vH - panelH) / 2);


    push();
    stroke(0); strokeWeight(6); fill(40, 40, 44, 255); 
    rect(px, py, panelW, panelH, 12);
    pop();

    try {
      if (ESC_MENU_BACKGROUND) {
        const imgAspect = ESC_MENU_BACKGROUND.width / ESC_MENU_BACKGROUND.height;
        const panelAspect = panelW / panelH;
        let imgW, imgH;
        if (imgAspect > panelAspect) { imgW = panelW; imgH = panelW / imgAspect; } 
        else { imgH = panelH; imgW = panelH * imgAspect; }
        const imgX = px + (panelW - imgW) / 2;
        const imgY = py + (panelH - imgH) / 2;
        image(ESC_MENU_BACKGROUND, imgX, imgY, imgW, imgH);
      }
    } catch (e) {}


    const btnLabels = [ { id: 'continue', label: 'Continue' }, { id: 'settings', label: 'Settings' }, { id: 'exit', label: 'Exit' } ];
    const btnW = 320; 
    const btnH = 60;  
    const gap = 15;
    
    const totalH = btnH * btnLabels.length + gap * (btnLabels.length - 1);
    const startY = py + (panelH - totalH) / 2;

    inGameMenuButtonRects = [];

    for (let i = 0; i < btnLabels.length; i++) {
      const b = btnLabels[i];
      const bx = px + (panelW - btnW) / 2;
      const by = startY + i * (btnH + gap);

      const currentScaleVal = (inGameMenuHoverScales[b.id] || 1);
      const desired = (inGameMenuHovered === b.id) ? 1.05 : 1.0;
      inGameMenuHoverScales[b.id] = lerp(currentScaleVal, desired, 0.2);

      const drawW = Math.floor(btnW * inGameMenuHoverScales[b.id]);
      const drawH = Math.floor(btnH * inGameMenuHoverScales[b.id]);
      const drawX = Math.floor(bx - (drawW - btnW) / 2);
      const drawY = Math.floor(by - (drawH - btnH) / 2);

      try {
        if (BUTTON_BG) image(BUTTON_BG, drawX, drawY, drawW, drawH);
        else { push(); noStroke(); fill(70); rect(drawX, drawY, drawW, drawH, 10); pop(); }
      } catch (e) {}

      try {
        push();
        textFont(uiFont || 'Arial');
        textAlign(CENTER, CENTER);
        gTextSize(28); 
        noStroke();
        fill(0, 140);
        text(b.label, drawX + drawW / 2 + 2, drawY + drawH / 2 + 3);
        if (inGameMenuHovered === b.id) fill(255, 220, 0); else fill(255);
        text(b.label, drawX + drawW / 2, drawY + drawH / 2);
        pop();
      } catch (e) {}
      
      inGameMenuButtonRects.push({ id: b.id, x: drawX, y: drawY, w: drawW, h: drawH });
    }

    try {
      if (inGameMenuPrevHovered !== inGameMenuHovered) {
        inGameMenuPrevHovered = inGameMenuHovered;
        if (document.body) document.body.style.cursor = inGameMenuHovered ? 'pointer' : '';
      }
    } catch (e) {}

    pop();
  } catch (e) {}
}

const CATEGORY_BUILDERS = {
  Audio: buildAudioSettings,
  Gameplay: buildGameplaySettings,
  Controls: buildControlsSettings,
  Accessibility: buildAccessibilitySettings,
  Language: buildLanguageSettings
};

function styleButton(btn) {
  btn.style("background", "transparent");
  btn.style("border", "none");
  btn.style("cursor", "pointer");
  btn.style("color", "white");
  btn.style("font-size", "20px");
  btn.style("text-shadow", "0 0 10px #000");
  btn.style("font-family", "MyFont, sans-serif");
}

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

function applyMenuButtonUI(btn, w = 260, h = 48) {
  if (!btn || !btn.elt) return;
  stylePixelButton(btn);
  btn.style('width', `${w}px`);
  btn.style('height', `${h}px`);
  btn.style('font-size', '28px');
  btn.style('font-family', 'inherit');
  btn.style('font-weight', 'bold');
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

function playClickSFX() {
    
}

function closeInGameSettings() {
  
  if (activeSettingElements && activeSettingElements.length) {
    activeSettingElements.forEach(e => {
      if (e) e.remove();
    });
  }
  activeSettingElements = [];

  
  if (settingsOverlayDiv) {
    settingsOverlayDiv.remove();
    settingsOverlayDiv = null;
    settingsOverlayPanel = null;
  }

  clearSubSettings();
  try { if (typeof applyCurrentTextSize === 'function') applyCurrentTextSize(); } catch(e) {}
  try { if (typeof persistSavedSettings === 'function') persistSavedSettings(true); } catch(e) {}
}

['pointerdown', 'keydown'].forEach((evt) => {
  window.addEventListener(evt, () => {
    if (pendingGameMusicStart && !gameMusicStarted) {
      attemptStartGameMusic(`user-${evt}`);
    }
  });
});


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


function getTextScale() {
  try {
    const defaultVal = 75;
    const raw = (typeof textSizeSetting === 'number') ? textSizeSetting : (parseInt(textSizeSetting, 10) || defaultVal);
    return (raw && isFinite(raw)) ? (raw / defaultVal) : 1;
  } catch (e) { return 1; }
}

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

let _rawTextSizeFn = null;
let _textSizeBaseValue = 14;
let _textSizeOverrideInstalled = false;

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

function applyCurrentTextSize() {
  ensureTextSizeOverride();
  try { if (typeof textSize === 'function') textSize(_textSizeBaseValue || 14); } catch(e) {}
  try {
    const defaultVal = 75;
    const raw = (typeof textSizeSetting === 'number') ? textSizeSetting : (parseInt(textSizeSetting, 10) || defaultVal);
    const scale = (raw && isFinite(raw)) ? (raw / defaultVal) : 1;

    const base = Math.max(10, Math.round(14 * scale));
    const small = Math.max(8, Math.round(12 * scale));
    const label = Math.max(12, Math.round(18 * scale));
    const heading = Math.max(14, Math.round(24 * scale));

    try { if (typeof textSize === 'function') textSize(base); } catch(e) {}

   
    try {
      const labels = document.querySelectorAll('.setting-label');
      labels.forEach(l => { try { l.style.fontSize = label + 'px'; } catch(e){} });
    } catch(e) {}

   
    try {
      const buttons = document.querySelectorAll('button[data-text-size-val]');
      buttons.forEach(b => { try { b.style.fontSize = Math.max(12, Math.round(14 * scale)) + 'px'; } catch(e){} });
    } catch(e) {}

  
    try {
      const rootEl = (typeof settingsMenuContent !== 'undefined' && settingsMenuContent && settingsMenuContent.elt) ? settingsMenuContent.elt : document.getElementById('menu-settings-root');
      const root = (rootEl && rootEl.querySelector) ? rootEl : document.body;
      const selLabels = root.querySelectorAll('.setting-label, .setting-row, .setting-title');
      selLabels.forEach(el => { try { el.style.fontSize = label + 'px'; } catch(e){} });

      const btns = root.querySelectorAll('button, a');
      btns.forEach(el => { try { el.style.fontSize = Math.max(12, Math.round(14 * scale)) + 'px'; } catch(e){} });

      const selects = root.querySelectorAll('select');
      selects.forEach(el => { try { el.style.fontSize = base + 'px'; } catch(e){} });

      const inputs = root.querySelectorAll('input');
      inputs.forEach(el => { try { el.style.fontSize = base + 'px'; } catch(e){} });
    } catch(e) {}

    
    try {
      if (Array.isArray(activeSettingElements)) {
        activeSettingElements.forEach(item => {
          try {
            const node = item && (item.elt || item);
            if (!node || !node.style) return;
            const tag = (node.tagName || '').toLowerCase();
            const controlSize = (tag === 'input' || tag === 'select' || tag === 'button' || tag === 'a') ? Math.max(12, Math.round(14 * scale)) : label;
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

    try { if (typeof updateTextSizeButtonStyles === 'function') updateTextSizeButtonStyles(); } catch(e) {}
  } catch(e) {}
}


try {
  if (typeof window !== 'undefined') {
    window.applyCurrentTextSize = applyCurrentTextSize;
  }
} catch(e) {}



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
          if (typeof window !== 'undefined') s = window.innerHeight / 4000;
          s = Math.max(0.18, Math.min(0.55, s));
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

try { ensureLoadingOverlayDom(); updateLoadingOverlayDom(); } catch (e) {}

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

let lastAutosavePayload = null;


const AssetTracker = {
  expected: 0,
  loaded: 0,
  names: new Set(),
  _resolve: null,
  _readyPromise: null,
  _callbacks: [],
  expect(name) {
    if (!name) name = 'anon:' + (this.expected + 1);
    if (this.names.has(name)) return;
    this.names.add(name);
    this.expected++;
  },
  markLoaded(name) {
    if (!name) name = 'anon';
    if (!this.names.has(name)) {
      this.names.add(name);
      this.expected++;
    }
    this.loaded++;
    if (this.loaded >= this.expected) {
      if (this._resolve) {
        try { this._resolve(true); } catch (e) {}
        this._resolve = null;
        this._readyPromise = null;
      }
      
      try {
        while (this._callbacks && this._callbacks.length) {
          const cb = this._callbacks.shift();
          try { cb(true); } catch (e) { console.warn('[AssetTracker] onReady callback threw', e); }
        }
      } catch (e) {}
    }
  },

  waitReady(timeoutMs = 3000) {
    if (this.loaded >= this.expected) return Promise.resolve(true);
    if (this._readyPromise) return this._readyPromise;
    this._readyPromise = new Promise((res) => {
      this._resolve = res;
      setTimeout(() => {
        if (this._resolve) {
          try { this._resolve(false); } catch (e) {}
          this._resolve = null;
          this._readyPromise = null;
        }
      }, timeoutMs || 3000);
    });
    return this._readyPromise;
  }
  ,
  onReady(cb) {
    if (typeof cb !== 'function') return;
    if (this.loaded >= this.expected) {
      try { cb(true); } catch (e) { console.warn('[AssetTracker] onReady immediate callback threw', e); }
      return;
    }
    this._callbacks.push(cb);
  }
};

function logAssetTrackerStatus(context) {
  try {
    if (typeof AssetTracker === 'undefined') return;
    const loaded = AssetTracker.loaded || 0;
    const expected = AssetTracker.expected || 0;
    const pending = Math.max(0, expected - loaded);
    const registered = (AssetTracker.names && AssetTracker.names.size) || 0;
    const stage = context ? String(context) : 'status';
    const message = `${loaded}/${expected} loaded, pending=${pending}, registered=${registered}`;
    if (typeof verboseLog === 'function') {
      verboseLog('[AssetTracker]', stage, message);
    } else {
      console.info('[AssetTracker]', stage, message);
    }
  } catch (e) {
    console.warn('[AssetTracker] log failed', e);
  }
}





function trackLoadImage(key, path, successCb, errorCb) {
  try { AssetTracker.expect(key || path); } catch (e) {}
  try {
    loadImage(path,
      (img) => {
        try { if (typeof successCb === 'function') successCb(img); } catch (e) {}
        try { AssetTracker.markLoaded(key || path); } catch (e) {}
      },
      (err) => {
        try { if (typeof errorCb === 'function') errorCb(err); } catch (e) {}
        try { AssetTracker.markLoaded(key || path); } catch (e) {}
      }
    );
  } catch (e) {
    try { if (typeof errorCb === 'function') errorCb(e); } catch (ee) {}
    try { AssetTracker.markLoaded(key || path); } catch (ee) {}
  }
}

function trackLoadSound(key, path, successCb, errorCb) {
  try { AssetTracker.expect(key || path); } catch (e) {}
  try {
    loadSound(path,
      (snd) => {
        try { if (typeof successCb === 'function') successCb(snd); } catch (e) {}
        try { AssetTracker.markLoaded(key || path); } catch (e) {}
      },
      (err) => {
        try { if (typeof errorCb === 'function') errorCb(err); } catch (e) {}
        try { AssetTracker.markLoaded(key || path); } catch (e) {}
      }
    );
  } catch (e) {
    try { if (typeof errorCb === 'function') errorCb(e); } catch (ee) {}
    try { AssetTracker.markLoaded(key || path); } catch (ee) {}
  }
}

function carveRiversMaybeThrough(map, w, h, opts = {}) {
  const clearStartX = opts.clearStartX ?? -1;
  const clearEndX   = opts.clearEndX ?? -1;
  const clearStartY = opts.clearStartY ?? -1;
  const clearEndY   = opts.clearEndY ?? -1;

  const RIVER_TILE = (typeof opts.RIVER_TILE !== 'undefined' && opts.RIVER_TILE !== null)
    ? opts.RIVER_TILE
    : (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RIVER ? TILE_TYPES.RIVER : null);

  const BRIDGE_TILE = (typeof opts.BRIDGE_TILE !== 'undefined' && opts.BRIDGE_TILE !== null)
    ? opts.BRIDGE_TILE
    : (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RAMP ? TILE_TYPES.RAMP : TILE_TYPES.GRASS);

  const playerX = Math.floor(opts.playerX ?? Math.floor(w / 2));
  const playerY = Math.floor(opts.playerY ?? Math.floor(h / 2));
  const numRivers = typeof opts.numRivers === 'number' ? opts.numRivers : (1 + Math.floor(Math.random() * 2));
  const allowClearOverride = typeof opts.allowClearOverride === 'boolean' ? opts.allowClearOverride : null;
  const chanceEnterClear = allowClearOverride === null
    ? (typeof opts.chanceEnterClear === 'number' ? Math.max(0, Math.min(1, opts.chanceEnterClear)) : 0.35)
    : (allowClearOverride ? 1 : 0);

  const jitterNoiseScale = typeof opts.jitterNoiseScale === 'number' ? opts.jitterNoiseScale : 0.12;
  const widenProb = typeof opts.widenProb === 'number' ? opts.widenProb : 0.45;
  const maxSteps = Math.max(w, h) * 6;

  function inClear(x, y) {
    if (clearStartX < 0) return false;
    return x > clearStartX && x < clearEndX && y > clearStartY && y < clearEndY;
  }

  function neighbors8(cx, cy) {
    const n = [];
    for (let yy = cy - 1; yy <= cy + 1; yy++) {
      for (let xx = cx - 1; xx <= cx + 1; xx++) {
        if (xx === cx && yy === cy) continue;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h) n.push({ x: xx, y: yy });
      }
    }
    return n;
  }

  function reachedSide(x, y, side) {
    if (side === 0) return y === 0;
    if (side === 1) return x === w - 1;
    if (side === 2) return y === h - 1;
    if (side === 3) return x === 0;
    return false;
  }

  function pickStartAndTarget() {
    const side = Math.floor(Math.random() * 4);
    let sx, sy, tx, ty;
    if (side === 0) { sx = Math.floor(Math.random() * w); sy = 0; tx = Math.floor((w * 0.25) + Math.random() * w * 0.5); ty = h - 1; }
    else if (side === 1) { sx = w - 1; sy = Math.floor(Math.random() * h); tx = 0; ty = Math.floor((h * 0.25) + Math.random() * h * 0.5); }
    else if (side === 2) { sx = Math.floor(Math.random() * w); sy = h - 1; tx = Math.floor((w * 0.25) + Math.random() * w * 0.5); ty = 0; }
    else { sx = 0; sy = Math.floor(Math.random() * h); tx = w - 1; ty = Math.floor((h * 0.25) + Math.random() * h * 0.5); }
    if (inClear(sx, sy)) { if (side === 0) sy = 0; if (side === 1) sx = w - 1; if (side === 2) sy = h - 1; if (side === 3) sx = 0; }
    if (inClear(tx, ty)) { if (side === 0) ty = h - 1; if (side === 1) tx = 0; if (side === 2) ty = 0; if (side === 3) tx = w - 1; }
    return { start: { x: sx, y: sy, side }, target: { x: tx, y: ty, side: (side + 2) % 4 } };
  }

  function placeRiverTile(x, y) {
    const idx = y * w + x;
    if (RIVER_TILE !== null) map[idx] = RIVER_TILE; else map[idx] = TILE_TYPES.FOREST;
  }

  function carveSingleRiver(start, target) {
    let x = start.x, y = start.y;
    let steps = 0;
    let prevDir = null;
    const allowThroughThisRiver = Math.random() < chanceEnterClear;
    while (steps < maxSteps) {
      placeRiverTile(x, y);
      const distToTarget = Math.hypot(target.x - x, target.y - y);
      const localWidenProb = distToTarget < 4 ? widenProb * 0.35 : widenProb;
      for (const n of neighbors8(x, y)) {
        if (Math.random() < localWidenProb) placeRiverTile(n.x, n.y);
      }
      if (reachedSide(x, y, target.side)) {
        if (distToTarget > 2 && Math.random() < 0.4) {
          const extras = neighbors8(x, y).filter(n => reachedSide(n.x, n.y, target.side));
          if (extras.length) { const e = extras[Math.floor(Math.random() * extras.length)]; placeRiverTile(e.x, e.y); }
        }
        break;
      }
      let candidates = neighbors8(x, y);
      let best = null; let bestScore = Infinity;
      for (const c of candidates) {
        const dist = Math.hypot(target.x - c.x, target.y - c.y);
        const jitter = (noise(c.x * jitterNoiseScale, c.y * jitterNoiseScale) - 0.5) * 3;
        const inside = inClear(c.x, c.y);
        const insidePenalty = inside ? (allowThroughThisRiver ? 6 : 1000) : 0;
        const forwardDot = ((target.x - x) * (c.x - x) + (target.y - y) * (c.y - y));
        const backtrackPenalty = forwardDot < 0 ? 6 : 0;
        const dirX = c.x - x;
        const dirY = c.y - y;
        const diagPenalty = (Math.abs(dirX) + Math.abs(dirY) === 2) ? 0.8 : 0;
        const turnPenalty = prevDir && (dirX !== prevDir.dx || dirY !== prevDir.dy) ? 1.4 : 0;
        const score = dist + jitter + insidePenalty + backtrackPenalty + diagPenalty + turnPenalty;
        if (score < bestScore) { bestScore = score; best = c; }
      }
      if (!best) break;
      prevDir = { dx: best.x - x, dy: best.y - y };
      x = best.x; y = best.y; steps++;
      if (steps % 70 === 0 && Math.random() < 0.25) {
        const p = pickStartAndTarget().start; x = Math.max(0, Math.min(w - 1, p.x)); y = Math.max(0, Math.min(h - 1, p.y));
        prevDir = null;
      }
    }
  }

  for (let r = 0; r < numRivers; r++) { const { start, target } = pickStartAndTarget(); carveSingleRiver(start, target); }

  function floodFillWalkable(px, py) {
    const q = [{ x: px, y: py }]; const visited = new Set([`${px},${py}`]); let head = 0;
    while (head < q.length) { const cur = q[head++]; for (const n of neighbors8(cur.x, cur.y)) { const key = `${n.x},${n.y}`; if (visited.has(key)) continue; const t = map[n.y * w + n.x]; const walkable = t === BRIDGE_TILE || t === TILE_TYPES.GRASS || t === TILE_TYPES.FLOWERS || t === TILE_TYPES.LOG; if (walkable) { visited.add(key); q.push({ x: n.x, y: n.y }); } } }
    return visited;
  }

  for (let iter = 0; iter < 5; iter++) {
    const visited = floodFillWalkable(playerX, playerY);
    const unreachable = [];
    for (let yy = 0; yy < h; yy++) { for (let xx = 0; xx < w; xx++) { const key = `${xx},${yy}`; const t = map[yy * w + xx]; if ((t === TILE_TYPES.GRASS || t === TILE_TYPES.FLOWERS || t === TILE_TYPES.LOG) && !visited.has(key)) unreachable.push({ x: xx, y: yy }); } }
    if (unreachable.length === 0) break;
    const candidatesMap = new Map(); const visitedSet = visited;
    for (const g of unreachable) {
      for (const n of neighbors8(g.x, g.y)) {
        const nk = `${n.x},${n.y}`; if (candidatesMap.has(nk)) continue; const t = map[n.y * w + n.x]; if (t === RIVER_TILE) {
          let touchesVisited = false; for (const nn of neighbors8(n.x, n.y)) { if (visitedSet.has(`${nn.x},${nn.y}`)) { const tt = map[nn.y * w + nn.x]; if (tt === TILE_TYPES.GRASS || tt === TILE_TYPES.FLOWERS || tt === TILE_TYPES.LOG || tt === BRIDGE_TILE) { touchesVisited = true; break; } } }
          if (touchesVisited) { const score = Math.hypot(n.x - w/2, n.y - h/2) + Math.random() * 20; candidatesMap.set(nk, { x: n.x, y: n.y, score }); }
        }
      }
    }
    if (candidatesMap.size === 0) break;
    const candidates = Array.from(candidatesMap.values()).sort((a,b) => a.score - b.score);
    const placeCount = Math.min(3, Math.max(1, Math.floor(candidates.length / 6)));
    for (let i = 0; i < placeCount && i < candidates.length; i++) {
      const c = candidates[i];
      layBridgeTile(map, w, h, c.x, c.y, RIVER_TILE, BRIDGE_TILE);
    }
  }
}

function carveBranchFromRiver(map, w, h, opts = {}) {
  const RIVER_TILE = (typeof opts.RIVER_TILE !== 'undefined' && opts.RIVER_TILE !== null)
    ? opts.RIVER_TILE
    : (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RIVER ? TILE_TYPES.RIVER : null);

  if (RIVER_TILE === null) {
    console.warn('carveBranchFromRiver: no RIVER_TILE available; aborting branch carve.');
    return;
  }

  const BRIDGE_TILE = (typeof opts.BRIDGE_TILE !== 'undefined' && opts.BRIDGE_TILE !== null)
    ? opts.BRIDGE_TILE
    : (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RAMP ? TILE_TYPES.RAMP : TILE_TYPES.GRASS);

  const playerX = Math.floor(opts.playerX ?? Math.floor(w / 2));
  const playerY = Math.floor(opts.playerY ?? Math.floor(h / 2));
  const { clearStartX = -1, clearEndX = -1, clearStartY = -1, clearEndY = -1 } = opts;

  function neighbors8(cx, cy) {
    const n = [];
    for (let yy = cy - 1; yy <= cy + 1; yy++) {
      for (let xx = cx - 1; xx <= cx + 1; xx++) {
        if (xx === cx && yy === cy) continue;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h) n.push({ x: xx, y: yy });
      }
    }
    return n;
  }

  function isInsideClear(x, y) {
    if (clearStartX < 0) return false;
    return x > clearStartX && x < clearEndX && y > clearStartY && y < clearEndY;
  }

  const riverTiles = [];
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (map[yy * w + xx] === RIVER_TILE) riverTiles.push({ x: xx, y: yy });
    }
  }

  function pickEdgeStart() {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: Math.floor(Math.random() * w), y: 0 };
    if (side === 1) return { x: w - 1, y: Math.floor(Math.random() * h) };
    if (side === 2) return { x: Math.floor(Math.random() * w), y: h - 1 };
    return { x: 0, y: Math.floor(Math.random() * h) };
  }

  const start = riverTiles.length ? riverTiles[Math.floor(Math.random() * riverTiles.length)] : pickEdgeStart();

  function pickOppositeEdgeTargetFrom(sx, sy) {
    if (sx <= w / 2) return { x: w - 1, y: Math.floor(h * (0.25 + Math.random() * 0.5)) };
    if (sx > w / 2) return { x: 0, y: Math.floor(h * (0.25 + Math.random() * 0.5)) };
    if (sy <= h / 2) return { x: Math.floor(w * (0.25 + Math.random() * 0.5)), y: h - 1 };
    return { x: Math.floor(w * (0.25 + Math.random() * 0.5)), y: 0 };
  }

  const targetEdge = pickOppositeEdgeTargetFrom(start.x, start.y);

  const maxSteps = Math.max(w, h) * 6;
  const jitterNoiseScale = 0.12;
  const widenProb = 0.45;

  function carvePath(sx, sy, tx, ty, stepsLimit = maxSteps) {
    let x = sx, y = sy;
    let steps = 0;
    let prevDir = null;
    while (steps < stepsLimit) {
      const idx = y * w + x;
      map[idx] = RIVER_TILE;

      const distToTarget = Math.hypot(tx - x, ty - y);
      const localWidenProb = distToTarget < 4 ? widenProb * 0.35 : widenProb;
      for (const n of neighbors8(x, y)) {
        const nIdx = n.y * w + n.x;
        if (Math.random() < localWidenProb) map[nIdx] = RIVER_TILE;
      }

      if (Math.hypot(tx - x, ty - y) <= 1.5) break;

      let best = null;
      let bestScore = Infinity;
      for (const c of neighbors8(x, y)) {
        const dist = Math.hypot(tx - c.x, ty - c.y);
        const jitter = (noise(c.x * jitterNoiseScale, c.y * jitterNoiseScale) - 0.5) * 3;
        const throughPlayerBias = (Math.hypot(playerX - c.x, playerY - c.y) < Math.max(w,h)*0.25) ? -2 : 0;
        const dirX = c.x - x;
        const dirY = c.y - y;
        const diagPenalty = (Math.abs(dirX) + Math.abs(dirY) === 2) ? 0.6 : 0;
        const turnPenalty = prevDir && (dirX !== prevDir.dx || dirY !== prevDir.dy) ? 1.2 : 0;
        const score = dist + jitter + throughPlayerBias + diagPenalty + turnPenalty;
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (!best) break;
      prevDir = { dx: best.x - x, dy: best.y - y };
      x = best.x; y = best.y;
      steps++;
    }
    return { x, y, steps };
  }

  carvePath(start.x, start.y, playerX, playerY, Math.floor(maxSteps * 0.6));

  let nearest = null;
  let bestD = Infinity;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (map[yy * w + xx] === RIVER_TILE) {
        const d = Math.hypot(playerX - xx, playerY - yy);
        if (d < bestD) { bestD = d; nearest = { x: xx, y: yy }; }
      }
    }
  }
  if (nearest) {
    carvePath(nearest.x, nearest.y, targetEdge.x, targetEdge.y, maxSteps);
  }

  function floodFillWalkableFrom(px, py) {
    const q = [{ x: px, y: py }];
    const visited = new Set([`${px},${py}`]);
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      for (const n of neighbors8(cur.x, cur.y)) {
        const k = `${n.x},${n.y}`;
        if (visited.has(k)) continue;
        const t = map[n.y * w + n.x];
        const walkable = t === BRIDGE_TILE || t === TILE_TYPES.GRASS || t === TILE_TYPES.FLOWERS || t === TILE_TYPES.LOG;
        if (walkable) {
          visited.add(k);
          q.push({ x: n.x, y: n.y });
        }
      }
    }
    return visited;
  }

  for (let iter = 0; iter < 6; iter++) {
    const visited = floodFillWalkableFrom(playerX, playerY);
    const unreachable = [];
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const k = `${xx},${yy}`;
        const t = map[yy * w + xx];
        if ((t === TILE_TYPES.GRASS || t === TILE_TYPES.FLOWERS || t === TILE_TYPES.LOG) && !visited.has(k)) {
          unreachable.push({ x: xx, y: yy });
        }
      }
    }
    if (unreachable.length === 0) break;

    const candidates = [];
    const seen = new Set();
    for (const g of unreachable) {
      for (const n of neighbors8(g.x, g.y)) {
        const nk = `${n.x},${n.y}`;
        if (seen.has(nk)) continue;
        seen.add(nk);
        const t = map[n.y * w + n.x];
        if (t === RIVER_TILE) {
          let touchesVisited = false;
          for (const nn of neighbors8(n.x, n.y)) {
            if (visited.has(`${nn.x},${nn.y}`)) {
              const tt = map[nn.y * w + nn.x];
              if (tt === TILE_TYPES.GRASS || tt === TILE_TYPES.FLOWERS || tt === TILE_TYPES.LOG || tt === BRIDGE_TILE) {
                touchesVisited = true; break;
              }
            }
          }
          if (touchesVisited) {
            const score = Math.hypot(n.x - w/2, n.y - h/2) + Math.random() * 10;
            candidates.push({ x: n.x, y: n.y, score });
          }
        }
      }
    }
    if (candidates.length === 0) break;
    candidates.sort((a,b) => a.score - b.score);
    const placeCount = Math.min(3, Math.max(1, Math.floor(candidates.length / 6)));
    for (let i = 0; i < placeCount; i++) {
      const c = candidates[i];
      layBridgeTile(map, w, h, c.x, c.y, RIVER_TILE, BRIDGE_TILE);
    }
  }
}

function ensureInteractiveClearArea(map, w, h, opts = {}) {
  const {
    clearStartX = -1,
    clearEndX = -1,
    clearStartY = -1,
    clearEndY = -1,
    playerX = Math.floor(w / 2),
    playerY = Math.floor(h / 2),
    RIVER_TILE = (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RIVER) ? TILE_TYPES.RIVER : null
  } = opts;

  if (clearStartX < 0 || RIVER_TILE === null) return;

  const safeRadius = Math.max(2, Math.floor(Math.min(clearEndX - clearStartX, clearEndY - clearStartY) / 6));

  function insideClear(x, y) {
    return x > clearStartX && x < clearEndX && y > clearStartY && y < clearEndY;
  }

  for (let dy = -safeRadius; dy <= safeRadius; dy++) {
    for (let dx = -safeRadius; dx <= safeRadius; dx++) {
      const x = playerX + dx;
      const y = playerY + dy;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      if (!insideClear(x, y)) continue;
      const idx = y * w + x;
      const tile = map[idx];
      if (tile === RIVER_TILE) {
        map[idx] = TILE_TYPES.LOG;
      } else if (tile === TILE_TYPES.FOREST || tile === TILE_TYPES.CLIFF) {
        map[idx] = TILE_TYPES.GRASS;
      }
    }
  }

  for (let yy = clearStartY + 1; yy < clearEndY; yy++) {
    for (let xx = clearStartX + 1; xx < clearEndX; xx++) {
      if (!insideClear(xx, yy)) continue;
      const idx = yy * w + xx;
      const tile = map[idx];
      if (tile === TILE_TYPES.RIVER) continue;
      if (tile === TILE_TYPES.FOREST || tile === TILE_TYPES.CLIFF) {
        map[idx] = TILE_TYPES.GRASS;
      }
    }
  }
}

function smoothRiverTiles(map, w, h, opts = {}) {
  const {
    RIVER_TILE = (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RIVER) ? TILE_TYPES.RIVER : null,
    clearStartX = -1,
    clearEndX = -1,
    clearStartY = -1,
    clearEndY = -1
  } = opts;

  if (RIVER_TILE === null) return;

  function blockTouchesClear(x, y) {
    if (clearStartX < 0) return false;
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const bx = x + dx;
        const by = y + dy;
        if (bx > clearStartX && bx < clearEndX && by > clearStartY && by < clearEndY) {
          return true;
        }
      }
    }
    return false;
  }

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      if (blockTouchesClear(x, y)) continue;
      const idx = y * w + x;
      const topLeft = map[idx];
      const topRight = map[idx + 1];
      const bottomLeft = map[idx + w];
      const bottomRight = map[idx + w + 1];
      const diagA = topLeft === RIVER_TILE && bottomRight === RIVER_TILE && topRight !== RIVER_TILE && bottomLeft !== RIVER_TILE;
      const diagB = topRight === RIVER_TILE && bottomLeft === RIVER_TILE && topLeft !== RIVER_TILE && bottomRight !== RIVER_TILE;
      if (diagA) {
        map[idx + 1] = RIVER_TILE;
        map[idx + w] = RIVER_TILE;
      } else if (diagB) {
        map[idx] = RIVER_TILE;
        map[idx + w + 1] = RIVER_TILE;
      }
    }
  }
}

function roundRiverTips(map, w, h, opts = {}) {
  const {
    RIVER_TILE = (typeof TILE_TYPES !== 'undefined' && TILE_TYPES.RIVER) ? TILE_TYPES.RIVER : null,
    clearStartX = -1,
    clearEndX = -1,
    clearStartY = -1,
    clearEndY = -1
  } = opts;

  if (RIVER_TILE === null) return;

  function insideClear(x, y) {
    if (clearStartX < 0) return false;
    return x > clearStartX && x < clearEndX && y > clearStartY && y < clearEndY;
  }

  const cardDirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];

  const diagDirs = [
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: -1 }
  ];

  const toGrass = new Set();

  function countCardinalRivers(x, y) {
    let count = 0;
    for (const d of cardDirs) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      if (map[ny * w + nx] === RIVER_TILE) count++;
    }
    return count;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (map[idx] !== RIVER_TILE) continue;
      if (insideClear(x, y)) continue;

      const cardCount = countCardinalRivers(x, y);
      if (cardCount > 1) continue;

      for (const d of diagDirs) {
        const nx = x + d.dx;
        const ny = y + d.dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const nIdx = ny * w + nx;
        if (map[nIdx] !== RIVER_TILE) continue;
        if (insideClear(nx, ny)) continue;
        const diagCard = countCardinalRivers(nx, ny);
        if (diagCard <= 1) {
          toGrass.add(nIdx);
        }
      }
    }
  }

  for (const idx of toGrass) {
    if (map[idx] === RIVER_TILE) {
      map[idx] = TILE_TYPES.GRASS;
    }
  }
}

const UI_FONT_PATH = 'assets/3-GUI/font.ttf';

let spritesheetIdle = null;

const IDLE_SHEET_PATH = 'assets/2-Characters/1-Idle/idle_sheet.png';
const IDLE_SHEET_COLS = 4;
const IDLE_SHEET_ROWS = 6;


const WALK_SHEET_COLS = 4;
const RUN_SHEET_COLS = 6; 
const WALK_SHEET_ROWS = IDLE_SHEET_ROWS;
const RUN_SHEET_ROWS = IDLE_SHEET_ROWS;

let spritesheetWalk = null;
let spritesheetRun = null;

let BUTTON_BG = null;


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
        transition: all 0.18s ease;
      }
      /* Button Hover Effects */
      button:hover {
        transform: scale(1.05);
        text-shadow: 0 0 12px #ffffffaa;
        color: #ffea00 !important;
      }

    function releaseImageReference(img) {
      if (!img) return;
      if (typeof img.remove === 'function') {
        try { img.remove(); } catch (e) {}
      }
    }

    function clearObjectValues(target) {
      if (!target || typeof target !== 'object') return;
      Object.keys(target).forEach((key) => { target[key] = null; });
    }

    function releaseGameAssets() {
      clearPreviousGameState();
      releaseImageReference(spritesheetIdle);
      releaseImageReference(spritesheetWalk);
      releaseImageReference(spritesheetRun);
      spritesheetIdle = null;
      spritesheetWalk = null;
      spritesheetRun = null;

      releaseImageReference(BUTTON_BG);
      releaseImageReference(TREE_OVERLAY_IMG);
      releaseImageReference(uiFont);
      BUTTON_BG = null;
      TREE_OVERLAY_IMG = null;
      uiFont = null;

      clearObjectValues(TILE_IMAGES);
      clearObjectValues(DECOR_ASSET_IMAGES);
      clearObjectValues(HILL_ASSETS);

      if (Array.isArray(cloudImages)) cloudImages.length = 0;

      try {
        if (gameMusic && typeof gameMusic.stop === 'function') {
          gameMusic.stop();
        }
      } catch (stopErr) {}
      gameMusic = null;
      clickSFX = null;

      if (typeof AssetTracker !== 'undefined') {
        AssetTracker.loaded = 0;
        AssetTracker.expected = 0;
        if (AssetTracker.names && typeof AssetTracker.names.clear === 'function') {
          AssetTracker.names.clear();
        }
        AssetTracker._callbacks = [];
        AssetTracker._resolve = null;
        AssetTracker._readyPromise = null;
      }
      genTempData = {};
    }
      /* Inputs */
      input[type="checkbox"], select, input[type="range"] {
        accent-color: #ffcc00;
        cursor: pointer;
      }
      /* Range Sliders (Webkit) */
      input[type="range"] {
        height: 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.25);
        outline: none;
        -webkit-appearance: none;
        appearance: none;
      }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 40px;
        height: 24px;
        border-radius: 12px;
        background: #ffcc00;
        box-shadow: 0 0 6px #ffcc0070;
        border: 2px solid #f5b800;
        cursor: pointer;
        margin-top: -7px; /* Align thumb vertically */
      }
      /* Range Sliders (Firefox) */
      input[type="range"]::-moz-range-thumb {
        width: 40px;
        height: 24px;
        border-radius: 12px;
        background: #ffcc00;
        border: 2px solid #f5b800;
        box-shadow: 0 0 6px #ffcc0070;
        cursor: pointer;
      }
      /* Specific UI Classes */
      .setting-label {
        color: white !important;
        text-shadow: 0 1px 4px black;
        pointer-events: none;
        font-size: 24px;
      }
      .setting-checkbox {
        display: flex;
        align-items: center;
      }
    `));
    document.head.appendChild(style);
  } catch (e) { console.warn('[game] injectCustomStyles failed', e); }
}

let SETTINGS_OVERLAY = null;
let ESC_MENU_BACKGROUND = null;

const WALK_SHEET_COMBINED = 'assets/2-Characters/2-Walking/16x16 Walk-Sheet.png';
const RUN_SHEET_COMBINED = WALK_SHEET_COMBINED;

let playerAnimFrame = 0;
let playerAnimTimer = 0;
let playerAnimSpeed = 150;

const IDLE_DIRS = ['N','NE','E','SE','S','SW','W','NW'];

const IDLE_FRAME_PATHS = {
  N:   [null, null, null, null],
  NE:  [null, null, null, null],
  E:   [null, null, null, null],
  SE:  [null, null, null, null],
  S:   [null, null, null, null],
  SW:  [null, null, null, null],
  W:   [null, null, null, null],
  NW:  [null, null, null, null]
};

const IDLE_FRAME_TEMPLATE = null;
let idleFrames = { N:[], NE:[], E:[], SE:[], S:[], SW:[], W:[], NW:[] };
const WALK_FRAME_PATHS = {
  N:   [null, null, null, null],
  NE:  [null, null, null, null],
  E:   [null, null, null, null],
  SE:  [null, null, null, null],
  S:   [null, null, null, null],
  SW:  [null, null, null, null],
  W:   [null, null, null, null],
  NW:  [null, null, null, null]
};

const WALK_FRAME_TEMPLATE = null;

let walkFrames = { N:[], NE:[], E:[], SE:[], S:[], SW:[], W:[], NW:[] };
const RUN_FRAME_PATHS = {
  N:   [null, null, null, null],
  NE:  [null, null, null, null],
  E:   [null, null, null, null],
  SE:  [null, null, null, null],
  S:   [null, null, null, null],
  SW:  [null, null, null, null],
  W:   [null, null, null, null],
  NW:  [null, null, null, null]
};

const RUN_FRAME_TEMPLATE = null;

let runFrames = { N:[], NE:[], E:[], SE:[], S:[], SW:[], W:[], NW:[] };
const WALK_SHEET_PATHS = {
  N:  'assets/2-Characters/2-Walking/walk_sheet_north.png',
  NE: 'assets/2-Characters/2-Walking/walk_sheet_northeast.png',
  E:  'assets/2-Characters/2-Walking/walk_sheet_east.png',
  SE: 'assets/2-Characters/2-Walking/walk_sheet_southeast.png',
  S:  'assets/2-Characters/2-Walking/walk_sheet_south.png',
  SW: 'assets/2-Characters/2-Walking/walk_sheet_southwest.png',
  W:  'assets/2-Characters/2-Walking/walk_sheet_west.png',
  NW: 'assets/2-Characters/2-Walking/walk_sheet_northwest.png'
};
const RUN_SHEET_PATHS = {
  N:  'assets/2-Characters/3-Running/run_sheet_north.png',
  NE: 'assets/2-Characters/3-Running/run_sheet_north_east.png',
  E:  'assets/2-Characters/3-Running/run_sheet_east.png',
  SE: 'assets/2-Characters/3-Running/run_sheet_south_east.png',
  S:  'assets/2-Characters/3-Running/run_sheet_south.png',
  SW: 'assets/2-Characters/3-Running/run_sheet_south_west.png',
  W:  'assets/2-Characters/3-Running/run_sheet_west.png',
  NW: 'assets/2-Characters/3-Running/run_sheet_north_west.png'
};
const IDLE_SHEET_PATHS = {
    N:  'assets/2-Characters/2-Walking/walk_sheet_north.png',
    NE: 'assets/2-Characters/2-Walking/walk_sheet_northeast.png',
    E:  'assets/2-Characters/2-Walking/walk_sheet_east.png',
    SE: 'assets/2-Characters/2-Walking/walk_sheet_southeast.png',
    S:  'assets/2-Characters/2-Walking/walk_sheet_south.png',
    SW: 'assets/2-Characters/2-Walking/walk_sheet_southwest.png',
    W:  'assets/2-Characters/2-Walking/walk_sheet_west.png',
    NW: 'assets/2-Characters/2-Walking/walk_sheet_northwest.png'
};

let idleSheets = { N:null, NE:null, E:null, SE:null, S:null, SW:null, W:null, NW:null };
let walkSheets = { N:null, NE:null, E:null, SE:null, S:null, SW:null, W:null, NW:null };
let runSheets = { N:null, NE:null, E:null, SE:null, S:null, SW:null, W:null, NW:null };

const JUMP_SHEET_PATHS = {
    N:  'assets/2-Characters/4-Jumping/jump_sheet_north.png',
    NE: 'assets/2-Characters/4-Jumping/jump_sheet_northeast.png',
    E:  'assets/2-Characters/4-Jumping/jump_sheet_east.png',
    SE: 'assets/2-Characters/4-Jumping/jump_sheet_southeast.png',
    S:  'assets/2-Characters/4-Jumping/jump_sheet_south.png',
    SW: 'assets/2-Characters/4-Jumping/jump_sheet_southwest.png',
    W:  'assets/2-Characters/4-Jumping/jump_sheet_west.png',
    NW: 'assets/2-Characters/4-Jumping/jump_sheet_northwest.png'
};
let jumpSheets = { N:null, NE:null, E:null, SE:null, S:null, SW:null, W:null, NW:null };
function scheduleDeferredCharacterAssets() {
  if (scheduleDeferredCharacterAssets._queued) return;
  scheduleDeferredCharacterAssets._queued = true;

  const loadDirectionalSheets = (paths, targetMap, label) => {
    if (!paths || typeof paths !== 'object' || !targetMap) return;
    Object.entries(paths).forEach(([dir, path]) => {
      targetMap[dir] = null;
      if (!path) return;
      try {
        trackLoadImage(`${label}:${dir}`, path,
          (img) => { targetMap[dir] = img; verboseLog('[game]', `${label} loaded`, dir, path, img && img.width, 'x', img && img.height); },
          (err) => { console.warn('[game] failed to load', label, dir, path, err); targetMap[dir] = null; }
        );
      } catch (e) {
        targetMap[dir] = null;
      }
    });
  };

  const loadCloudTextures = () => {
    const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
    if (!Array.isArray(globalScope.cloudImages)) globalScope.cloudImages = [];
    const cloudArray = globalScope.cloudImages;
    const targetCount = typeof CLOUD_IMAGE_COUNT === 'number' ? CLOUD_IMAGE_COUNT : 6;
    for (let i = 1; i <= targetCount; i++) {
      cloudArray[i - 1] = cloudArray[i - 1] || null;
      const path = `assets/5-Objects/cloud_${i}.png`;
      try {
        trackLoadImage(`cloud_${i}`, path,
          (img) => { cloudArray[i - 1] = img; verboseLog('[game] loaded cloud', i, img && img.width, 'x', img && img.height); },
          (err) => { console.warn('[game] failed to load cloud', i, err); }
        );
      } catch (e) {
        console.warn('[game] failed to queue cloud', i, e);
      }
    }
  };

  const runDeferredLoads = () => {
    try { logAssetTrackerStatus('before deferred character assets'); } catch (e) {}
    loadDirectionalSheets(IDLE_SHEET_PATHS, idleSheets, 'idle_sheet');
    loadDirectionalSheets(WALK_SHEET_PATHS, walkSheets, 'walk_sheet');
    loadDirectionalSheets(RUN_SHEET_PATHS, runSheets, 'run_sheet');
    loadDirectionalSheets(JUMP_SHEET_PATHS, jumpSheets, 'jump_sheet');
    loadCloudTextures();
    try { logAssetTrackerStatus('after deferred character assets'); } catch (e) {}
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(runDeferredLoads, { timeout: 2500 });
  } else {
    setTimeout(runDeferredLoads, 120);
  }

  try { logAssetTrackerStatus('deferred character assets scheduled'); } catch (e) {}
}
let isJumping = false;
let jumpTimer = 0;
let jumpFrame = 0;

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

const BASE_ELEVATION_THRESHOLD = 0.5;
const BASE_BUSH_THRESHOLD = 0.65;

let mapStates;
let terrainLayer;

let playerPosition = null;

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

const HOLD_INITIAL_DELAY_MS = 120;
const HOLD_REPEAT_INTERVAL_MS = 70;
let moveStartMillis = 0;
let lastMoveDurationMs = BASE_MOVE_DURATION_MS;

const SPAWN_CLEAR_RADIUS = 3;
let lastMoveTime = 0;
let sprintActive = false;
let sprintEndMillis = 0;
let sprintCooldownUntil = 0;
let sprintRemainingMs = SPRINT_MAX_DURATION_MS;
let sprintLastUpdate = 0;

let mapImage;
let mapOverlays = [];
let spritesheet = null;
const SPRITESHEET_PATH = 'assets/1-Background/test3.png';
let spirtesheet_idle = null;

const TILE_TYPES = Object.freeze({
  GRASS: 1,
  FOREST: 2,
  MOB: 3,
  
  CHEST: 100,
  HEALTH: 101,
  POWERUP: 102,
  
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
  TILE_TYPES.GRASS, TILE_TYPES.LOG, TILE_TYPES.FLOWERS, TILE_TYPES.RAMP, TILE_TYPES.RIVER
]);

const ITEM_DATA = Object.freeze({
  [TILE_TYPES.CHEST]:  { label: 'CHEST', spawnRate: 0.01, color: [218, 165, 32] },
  [TILE_TYPES.HEALTH]: { label: 'HEALTH', spawnRate: 0.005, color: [0, 255, 127] },
  [TILE_TYPES.POWERUP]:{ label: 'POWERUP', spawnRate: 0.003, color: [138, 43, 226] },
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
  'log_horizontal_1',
  'rock_small_1',
  'rock_upward_1'
]);

const DECORATIVE_OBSTACLE_NAMES = Object.freeze([
  'bush_upward_1',
  'log_vertically_1',
  'log_upward_1'
]);

const DECOR_SPECIAL_NAMES = Object.freeze(['hole_1']);
const DECOR_ASSET_IMAGES = {};

let decorativeObjects = [];
let decorativeObstacleTiles = new Set();
let decorObjectsDirty = true;

const SPRITES = {
  [TILE_TYPES.GRASS]: { x: 0, y: 0, w: 16, h: 16 },
  [TILE_TYPES.FOREST]: { x: 862, y: 191, w: 32, h: 32, drawW: 64, drawH: 64 },
  [TILE_TYPES.CLIFF]: { x: 862, y: 0, w: 16, h: 16 },
  [TILE_TYPES.RAMP]: { x: 400, y: 224, w: 64, h: 64 }
  
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


function RandomEnvironment() {
  const idx = Math.floor(Math.random() * ENVIRONMENTS.length);
  const env = ENVIRONMENTS[idx];
  currentEnvironment = env;
  applyEnvironmentDefaults(env);
  return env;
}

function applyEnvironmentDefaults(env) {
}

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






// --- SETTINGS & AUDIO ---
// buildAudioSettings(ctx)
// buildGameplaySettings(ctx)
// buildControlsSettings(ctx)
// buildAccessibilitySettings(ctx)
// buildLanguageSettings(ctx)
// applyVolumes()
// attemptStartGameMusic(reason)
// unlockAudioAndStart(cb)
// startMenuMusicIfNeeded()
// playClickSFX()
// setDifficulty(value, { regenerate, reason })
// normalizeDifficultyValue(value)
// getDifficultyDisplayLabel(value)
// syncSlidersToSettings()
// saveLocalSettings() (Added recently)
function normalizeDifficultyValue(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return DIFFICULTIES.includes(normalized) ? normalized : null;
}

function setDifficulty(value, { regenerate = true, reason = 'unknown' } = {}) {
  const normalized = normalizeDifficultyValue(value);
  if (!normalized) return false;
  if (normalized === currentDifficulty) return false;
  currentDifficulty = normalized;
  verboseLog(`[game] difficulty set to ${normalized} (${reason})`);
  if (regenerate && typeof generateMap === 'function' && W && H) {
    generateMap();
  }
  return true;
}

function getDifficultyDisplayLabel(value = currentDifficulty) {
  return DIFFICULTY_LABELS[value] || DIFFICULTY_LABELS.normal;
}

let currentGenParams = {};
let showTextures = true;
let counts = {};

let nextGenerateIsManual = false;

const HILL_DIRECTIONS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const HILL_ASSETS = {};

function draw() {
  try { enforceCanvasSharpness(drawingContext); } catch (e) {}
  
  // Clamp deltaTime to prevent huge jumps after lag/tab switch
  gameDelta = (typeof deltaTime !== 'undefined') ? Math.min(deltaTime, 50) : 16.67;

  if (genPhase > 0) {
    if (genPhase === 1) {
      showLoadingOverlay = true;
      startLoadingProgress(0);
      overlayMessage = 'Initializing World...';
      updateLoadingOverlayDom();
      background(0);
      genTimer = millis() + 100;
      genPhase = 2; return; 
    }
    if (genPhase === 2) {
      background(0); 
      if (millis() < genTimer) return; 
      generateMap_Part1();
      overlayMessage = 'Roughening & Eroding...';
      updateLoadingOverlayDom();
      genTimer = millis() + 800;
      genPhase = 3; return;
    }
    if (genPhase === 3) {
      background(0); 
      if (millis() < genTimer) return; 
      generateMap_Part2();
      genPhase = 0;
      showLoadingOverlay = false;
      completeLoadingProgress();
      updateLoadingOverlayDom();
    }
  }


  if (typeof window !== 'undefined' && window && window.__gameDebugShown !== true) { 
    verboseLog('[game] draw() running'); window.__gameDebugShown = true; 
  }
  
  try { ensureLoadingOverlayDom(); updateLoadingOverlayDom(); } catch (e) {}

  push();


  if (gameScale !== 1) scale(gameScale);

  // --- CAMERA LOGIC ---
  let targetCamX = 0;
  let targetCamY = 0;
  const mapW = (logicalW || 0) * cellSize;
  const mapH = (logicalH || 0) * cellSize;

  if (playerPosition) {
      const pX = isMoving ? renderX : playerPosition.x;
      const pY = isMoving ? renderY : playerPosition.y;
      
      const playerPixelX = pX * cellSize + cellSize / 2;
      const playerPixelY = pY * cellSize + cellSize / 2;
      
      targetCamX = playerPixelX - virtualW / 2;
      targetCamY = playerPixelY - virtualH / 2;
      
      if (mapW > virtualW) {
        targetCamX = Math.max(0, Math.min(targetCamX, mapW - virtualW));
      } else {
        targetCamX = -(virtualW - mapW) / 2;
      }

      if (mapH > virtualH) {
        targetCamY = Math.max(0, Math.min(targetCamY, mapH - virtualH));
      } else {
        targetCamY = -(virtualH - mapH) / 2;
      }
  }

  // Camera Smoothing
  if (smoothCamX === null || smoothCamY === null) {
    smoothCamX = targetCamX;
    smoothCamY = targetCamY;
  } else {
    // 0.15 smoothing factor for responsiveness without jitter
    smoothCamX = lerp(smoothCamX, targetCamX, 0.15);
    smoothCamY = lerp(smoothCamY, targetCamY, 0.15);
  }

  // Use floor to prevent sub-pixel shimmering on tiles
  const drawCamX = Math.floor(smoothCamX);
  const drawCamY = Math.floor(smoothCamY);

  background(34, 139, 34);

  // START WORLD TRANSFORM
  push();
  translate(-drawCamX, -drawCamY);
  
  if (mapImage) image(mapImage, 0, 0);

  if (showLoadingOverlay) {
    pop(); 
    background(0); 
    pop(); 
    return;        
  }
  
  if (playerPosition) {
  
    if (!settingsOverlayDiv && !inGameMenuVisible) {
      handleMovement();
      updateMovementInterpolation();
      updateEnemies();
    }
  }


  try {
    const drawables = [];
    if (Array.isArray(mapOverlays)) {
      for (const o of mapOverlays) {
          if (!o) continue;
          const drawX = o.px + Math.floor((cellSize - o.destW) / 2);
          const drawY = o.py + (cellSize - o.destH);
          const baseY = o.py + cellSize;
          drawables.push({ type: 'overlay', o, drawX, drawY, baseY });
        }
    }
    if (Array.isArray(decorativeObjects) && decorativeObjects.length) {
      for (const deco of decorativeObjects) {
        const img = DECOR_ASSET_IMAGES[deco.id];
        if (!img) continue;
        const destW = img.width || cellSize;
        const destH = img.height || cellSize;
        const drawX = deco.tileX * cellSize + Math.floor((cellSize - destW) / 2);
        const drawY = deco.tileY * cellSize + (cellSize - destH);
        const baseY = deco.tileY * cellSize + cellSize;
        drawables.push({ type: 'decor', img, drawX, drawY, destW, destH, baseY });
      }
    }
    if (playerPosition) {
      const drawTileX = isMoving ? renderX : playerPosition.x;
      const drawTileY = isMoving ? renderY : playerPosition.y;
      const playerBaseY = (drawTileY * cellSize) + cellSize;
      drawables.push({ type: 'player', baseY: playerBaseY });
    }
    if (enemies && enemies.length) {
      for (const e of enemies) {
           const baseY = (e.renderY * cellSize) + cellSize; 
           drawables.push({ type: 'enemy', entity: e, baseY });
      }
    }
    drawables.sort((a, b) => (a.baseY - b.baseY));
    
    for (const d of drawables) {
      if (d.type === 'overlay') {
        const o = d.o;
        if (o.imgType === 'image' && o.img) image(o.img, d.drawX, d.drawY, o.destW, o.destH);
        else if (o.imgType === 'sheet' && o.s) image(spritesheet, d.drawX, d.drawY, o.destW, o.destH, o.s.x, o.s.y, o.s.w, o.s.h);
      } else if (d.type === 'decor') {
        try { if (d.img) image(d.img, d.drawX, d.drawY, d.destW, d.destH); } catch (e) {}
      } else if (d.type === 'player') {
        try { drawPlayer(); } catch (e) {}
      } else if (d.type === 'enemy') {
        try { d.entity.draw(); } catch (e) {}
      }
    }
  } catch (e) {}

  drawClouds();

  if (EDGE_LAYER_DEBUG && edgeLayer && logicalW && logicalH) {
    noStroke(); fill(255, 0, 0, 100);
    for (let y = 0; y < logicalH; y++) {
      for (let x = 0; x < logicalW; x++) {
        if (edgeLayer[y * logicalW + x]) rect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  pop(); // END WORLD TRANSFORM

  // --- MINIMAP ---
  if (showMinimap && mapImage) {
    const mmW = 200;
    const mmH = 200;
    // Move to Bottom-Left
    const mmX = 20;
    const mmY = (virtualH || height) - mmH - 20;

    push();
    // Background Fog
    fill(0, 0, 0, 180);
    // Gold Border
    stroke(MENU_GOLD_BORDER);
    strokeWeight(3);
    rect(mmX, mmY, mmW, mmH, 4);
    noStroke();

    // Map content
    const mapAspect = mapImage.width / mapImage.height;
    let drawW = mmW;
    let drawH = mmW / mapAspect;
    if (drawH > mmH) {
       drawH = mmH;
       drawW = mmH * mapAspect;
    }
    const offX = (mmW - drawW) / 2;
    const offY = (mmH - drawH) / 2;
    
    // Draw map with slight transparency to blend better with fog
    tint(255, 230);
    if (minimapImage) {
        image(minimapImage, mmX + offX, mmY + offY, drawW, drawH);
    } else {
        image(mapImage, mmX + offX, mmY + offY, drawW, drawH);
    }
    noTint();

    // Draw Trees on Minimap
    if (treeObjects && logicalW && logicalH) {
       fill(15, 70, 15); // Dark Pine Green
       stroke(0, 150);   // Black outline for contrast
       strokeWeight(1);
       for(const t of treeObjects) {
          const pxRel = t.x / logicalW;
          const pyRel = t.y / logicalH;
          const tx = mmX + offX + (pxRel * drawW);
          const ty = mmY + offY + (pyRel * drawH);
          circle(tx, ty, 4);
       }
    }

    // Player marker (Arrow)
    if (playerPosition) {
      const pX = isMoving ? renderX : playerPosition.x;
      const pY = isMoving ? renderY : playerPosition.y;
      
      const pxRel = pX / logicalW;
      const pyRel = pY / logicalH;
      
      const markerX = mmX + offX + (pxRel * drawW);
      const markerY = mmY + offY + (pyRel * drawH);
      
      // Calculate rotation
      const dirMap = { 
          'N': -HALF_PI, 'NE': -QUARTER_PI, 
          'E': 0, 'SE': QUARTER_PI, 
          'S': HALF_PI, 'SW': HALF_PI + QUARTER_PI, 
          'W': PI, 'NW': -HALF_PI - QUARTER_PI 
      };
      const angle = dirMap[lastDirection || 'S'] ?? HALF_PI;

      push();
      translate(markerX, markerY);
      rotate(angle);
      
      // Arrow Shape
      fill(255);
      stroke(0, 0, 0, 150);
      strokeWeight(1);
      beginShape();
      vertex(5, 0);    // Tip
      vertex(-4, -4);  // Back Left
      vertex(-2, 0);   // Inner Notch
      vertex(-4, 4);   // Back Right
      endShape(CLOSE);
      pop();
    }
    pop();
  }

  drawDifficultyBadge();
  drawHealthBar();
  drawSprintMeter();

  try {
    if (typeof drawInGameMenu === 'function') drawInGameMenu();
  } catch (e) {}
  
  if (!inGameMenuVisible && !settingsOverlayDiv) updateClouds();

  pop(); 
}


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

let _settingsSaveTimer = null;

function persistSavedSettings(immediate = false) {
  const commit = () => {
    try {
      const settings = { masterVol, musicVol, sfxVol, textSizeSetting, difficulty: difficultySetting };
      localStorage.setItem('menuSettings', JSON.stringify(settings));
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
    if (typeof applyVolumes === 'function') applyVolumes();
    verboseLog('[game] loaded saved settings', parsed);
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

  const { container, panel, close } = createZoomStablePanel(720, 540, 'gd-settings-overlay');
  decorateSettingsPanel(panel);

  settingsOverlayDiv = container;
  settingsOverlayPanel = panel;
  container.closeZoomPanel = close;

  let title = createDiv('SETTINGS');
  title.parent(panel);
  title.style('font-size', '42px');
  title.style('font-weight', 'bold');
  title.style('margin-bottom', '18px');
  title.style('color', MENU_GOLD_COLOR);
  title.style('text-shadow', '3px 3px 0 #000');

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

function attemptStartGameMusic(reason = 'unknown') {
  if (!pendingGameMusicStart || gameMusicStarted || !gameMusic) return;
  verboseLog(`[game] attemptStartGameMusic reason=${reason}`);
  const startPlayback = () => {
    if (gameMusicStarted || !gameMusic) return;
    try { gameMusic.setVolume(musicVol * masterVol); } catch (volumeErr) {}
    try {
      if (typeof gameMusic.loop === 'function') {
        gameMusic.loop();
      } else if (typeof gameMusic.play === 'function') {
        gameMusic.play();
      } else {
        console.warn('[game] gameMusic has no loop/play');
        return;
      }
      gameMusicStarted = true;
      pendingGameMusicStart = false;
      verboseLog('[game] gameMusic playback started');
    } catch (startErr) {
      console.warn('[game] startPlayback failed', startErr);
    }
  };
  const tryResumeAudioContext = () => {
    if (typeof getAudioContext !== 'function') return false;
    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state === 'running') return false;
      const resumeResult = ctx.resume?.();
      if (resumeResult && typeof resumeResult.then === 'function') {
        resumeResult.then(() => {
          verboseLog('[game] AudioContext.resume resolved');
          startPlayback();
        }).catch((err) => {
          console.warn('[game] AudioContext.resume rejected', err);
          startPlayback();
        });
        return true;
      }
    } catch (ctxErr) {
      console.warn('[game] tryResumeAudioContext threw', ctxErr);
    }
    return false;
  };
  if (typeof userStartAudio === 'function') {
    try {
      const maybePromise = userStartAudio();
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(() => {
          verboseLog('[game] userStartAudio resolved');
          startPlayback();
        }).catch((err) => {
          console.warn('[game] userStartAudio rejected', err);
          if (!tryResumeAudioContext()) startPlayback();
        });
        return;
      }
    } catch (userStartErr) {
      console.warn('[game] userStartAudio threw', userStartErr);
    }
  }
  if (tryResumeAudioContext()) return;
  startPlayback();
}

try {
  window.addEventListener('keydown', (e) => {
    try {
      if (e.key === 'Escape' || e.keyCode === 27) {
        
        const active = document && document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

        try {
          if (settingsOverlayDiv) {
             if (settingsOverlayDiv.closeZoomPanel) settingsOverlayDiv.closeZoomPanel();
             else settingsOverlayDiv.remove();
             settingsOverlayDiv = null;
             openInGameMenu();
             e.preventDefault();
             return;
          }
        } catch (err) {  }

        try {
          if (inGameMenuVisible) closeInGameMenu();
          else openInGameMenu();
          e.preventDefault();
        } catch (err) {
          console.warn('[game] toggling inGameMenuVisible (global handler) failed', err);
        }
      }
    } catch (err) {  }
  }, false);
} catch (e) { console.warn('[game] failed to attach global Escape handler', e); }


function drawDifficultyBadge() {
  const vW = virtualW || (width / gameScale);
  const margin = 20;
  const badgeSize = 32;
  const x = vW - margin - badgeSize;
  const y = margin;
  
  // Determine color based on difficulty
  let badgeColor;
  let diff = (currentDifficulty || 'normal').toLowerCase();
  if (diff === 'easy') badgeColor = color(205, 127, 50); // Bronze
  else if (diff === 'hard') badgeColor = color(255, 215, 0); // Gold
  else badgeColor = color(192, 192, 192); // Silver (Normal)

  push();
  
  // Draw Shield/Badge Background
  stroke(0, 0, 0, 150);
  strokeWeight(2);
  fill(badgeColor);
  
  // Simple Shield Shape
  beginShape();
  vertex(x, y);
  vertex(x + badgeSize, y);
  vertex(x + badgeSize, y + badgeSize * 0.8);
  vertex(x + badgeSize / 2, y + badgeSize * 1.2);
  vertex(x, y + badgeSize * 0.8);
  endShape(CLOSE);

  // Inner detail
  noStroke();
  fill(255, 255, 255, 60);
  circle(x + badgeSize/2, y + badgeSize*0.4, badgeSize/3);

  // Interaction: Show text on hover
  const mx = mouseX / gameScale;
  const my = mouseY / gameScale;
  const isHover = mx >= x && mx <= x + badgeSize && my >= y && my <= y + badgeSize * 1.2;

  if (isHover) {
    const label = `Difficulty: ${getDifficultyDisplayLabel()}`;
    if (uiFont) textFont(uiFont);
    gTextSize(16);
    const tW = textWidth(label);
    
    // Tooltip bg
    fill(0, 0, 0, 220);
    noStroke();
    rect(x - tW - 10, y, tW + 8, 24, 4);
    
    // Text
    fill(255);
    textAlign(RIGHT, CENTER);
    text(label, x - 6, y + 12);
  }

  pop();
}

function drawSprintMeter() {
  const vW = virtualW || (width / gameScale);
  const vH = virtualH || (height / gameScale);
  const now = millis();
  
  // Visibility Logic: Fade out if full
  const pct = (typeof sprintRemainingMs === 'number' && SPRINT_MAX_DURATION_MS > 0) ? (sprintRemainingMs / SPRINT_MAX_DURATION_MS) : 0;
  
  let targetAlpha = 0;
  if (sprintActive || pct < 0.99 || (sprintCooldownUntil > now)) {
    targetAlpha = 255;
  }
  
  // Simple linear interpolation for fade (optional, could rely on CSS or complex state, but simple is good here)
  // For now, we'll just snap to visible/invisible or use a global if we wanted smooth fade, 
  // but let's stick to immediate visibility for responsiveness, or a simple check.
  if (targetAlpha === 0) return; // Don't draw if full and not cooling down

  const barW = 200;
  const barH = 10;
  const cx = vW / 2;
  const y = vH - 40;
  const x = cx - barW / 2;

  push();
  
  // Icon (Lightning Bolt)
  const iconSize = 18;
  const ix = x - iconSize - 8;
  const iy = y + barH / 2;
  
  noStroke();
  fill(255, 215, 0, targetAlpha); // Gold
  beginShape();
  vertex(ix, iy - 6);
  vertex(ix + 6, iy - 6);
  vertex(ix - 2, iy + 1);
  vertex(ix + 4, iy + 1);
  vertex(ix - 4, iy + 9);
  vertex(ix, iy + 1);
  vertex(ix - 6, iy + 1);
  endShape(CLOSE);

  // Bar Background
  fill(0, 0, 0, 150 * (targetAlpha / 255));
  stroke(MENU_GOLD_BORDER);
  strokeWeight(2);
  rect(x, y, barW, barH, 4);

  // Bar Fill
  if (pct > 0) {
    noStroke();
    // Gradient Color based on percentage
    // High = Cyan/Green, Low = Red
    let r, g, b;
    if (pct > 0.5) {
       r = map(pct, 0.5, 1, 255, 0);
       g = 255;
       b = map(pct, 0.5, 1, 0, 255);
    } else {
       r = 255;
       g = map(pct, 0, 0.5, 0, 255);
       b = 0;
    }
    fill(r, g, b, targetAlpha);
    
    // Scissor or just width rect
    rect(x + 2, y + 2, (barW - 4) * pct, barH - 4, 2);
  }

  // Cooldown Overlay
  if (typeof sprintCooldownUntil === 'number' && now < sprintCooldownUntil) {
    const cdPct = Math.max(0, Math.min(1, (sprintCooldownUntil - now) / SPRINT_COOLDOWN_MS));
    fill(200, 200, 200, 100 * (targetAlpha / 255));
    rect(x + 2, y + 2, (barW - 4) * cdPct, barH - 4, 2);
  }

  pop();
}

function hideCategoryButtons() {
  categoryBackgrounds.forEach(e => e && e.hide());
  categoryButtons.forEach(e => e && e.hide());
}

function hideBottomButtons() {
  [saveBackground, btnSave, backMenuBackground, btnBackMenu].forEach(e => e && e.hide());
}

function makeBtn(label, x, y, w, h, cb) {
  const b = createButton(label);
  b.size(w, h).position(x, y);
  styleButton(b);
  b.mousePressed(cb);
  return b;
}

function createBgImg(path, x, y, w, h, zIndex = '9998') {
  const img = createImg(path, '');
  img.size(w, h).position(x, y);
  img.style('pointer-events', 'none');
  img.style('z-index', zIndex);
  img.style('position', 'absolute');
  return img;
}

function makeSmallBtn(label, x, y, w, h, cb) {
  const b = createButton(label);
  b.size(w, h).position(x, y);
  styleSmallButton(b);
  b.mousePressed(cb);
  return b;
}

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

function clearSubSettings() {
  activeSettingElements.forEach(e => e && e.remove());
  activeSettingElements = [];
}

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

function hideSettingsMenu() {
  [...categoryBackgrounds, ...categoryButtons, saveBackground, btnSave, backMenuBackground, btnBackMenu]
    .forEach(e => e && e.remove());
  categoryBackgrounds = [];
  categoryButtons = [];
}

function playClickSFX() {
  if (clickSFX) {
    clickSFX.setVolume(sfxVol * masterVol);
    clickSFX.play();
  }
}

function unlockAudioAndStart(cb) {
  if (audioUnlocked) {
    cb && cb();
    return;
  }
  try {
    if (typeof userStartAudio === 'function') {
      userStartAudio().then(() => {
        audioUnlocked = true;
        verboseLog('[unlockAudioAndStart] userStartAudio resolved — starting menu music');
        startMenuMusicIfNeeded();
        cb && cb();
      }).catch(() => {
        try {
          getAudioContext().resume().then(() => {
            audioUnlocked = true;
            verboseLog('[unlockAudioAndStart] AudioContext.resume succeeded — starting menu music');
            startMenuMusicIfNeeded();
            cb && cb();
          }).catch(() => {
            audioUnlocked = true;
            verboseLog('[unlockAudioAndStart] resume rejected but marking audio unlocked');
            startMenuMusicIfNeeded();
            cb && cb();
          });
        } catch (e) {
          audioUnlocked = true;
          verboseLog('[unlockAudioAndStart] fallback unlock — starting menu music');
          startMenuMusicIfNeeded();
          cb && cb();
        }
      });
    } else {
      try { getAudioContext().resume(); } catch (e) {}
      audioUnlocked = true;
      verboseLog('[unlockAudioAndStart] no userStartAudio — audioUnlocked set');
      startMenuMusicIfNeeded();
      cb && cb();
    }
  } catch (e) { audioUnlocked = true; cb && cb(); }
}

function startMenuMusicIfNeeded() {
  if (!bgMusic) {
    console.warn('[startMenuMusicIfNeeded] bgMusic not loaded yet');
    return;
  }
  try {
    if (typeof bgMusic.setVolume === 'function') bgMusic.setVolume(musicVol * masterVol);

    if (typeof bgMusic.isPlaying === 'function') {
      if (!bgMusic.isPlaying()) {
        bgMusic.loop();
        verboseLog('[startMenuMusicIfNeeded] bgMusic.loop() called');
      }
    } else if (typeof bgMusic.loop === 'function') {
      bgMusic.loop();
      verboseLog('[startMenuMusicIfNeeded] bgMusic.loop() fallback called');
    } else if (typeof bgMusic.play === 'function') {
      bgMusic.play();
      verboseLog('[startMenuMusicIfNeeded] bgMusic.play() fallback called');
    }
  } catch (err) {
    console.warn('[startMenuMusicIfNeeded] playback error', err);
  }
}

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

function styleSmallButton(btn) {
  btn.style("background", "transparent");
  btn.style("border", "none");
  btn.style("cursor", "pointer");
  btn.style("color", "white");
  btn.style("text-shadow", "0 0 8px #ffffff60");
  btn.style('border-radius', '2px');
  if (btn.elt) {
    btn.elt.style.position = 'absolute';
  btn.style('background-image', `url('${MENU_BUTTON_TEXTURE_PATH}')`);
    btn.elt.style.zIndex = '10001';
  }
}

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


window.addEventListener('keydown', (ev) => {
  const k = ev.key ? ev.key.toUpperCase() : '';
  if (k === 'W' || k === 'A' || k === 'S' || k === 'D') {
    try { tryMoveDirection(k); } catch (e) {  }
  }
  if (k === 'P') {
    verboseLog('[game] P pressed - Starting Phase 1');
    genPhase = 1; 
    return;
}
});


function persistActiveMapToServer(reason = 'unspecified') {
  try {
    if (typeof fetch === 'undefined') return false;
    const payload = buildActiveMapPayload();
    if (!payload) { console.warn('[game] no payload to persist to server'); return false; }

    let allowServer = false;
    try {
      if (typeof window !== 'undefined' && window.location) {
        const params = new URLSearchParams(window.location.search);
        allowServer = (window.location.hostname === 'localhost') || (params.get('useServer') === '1');
      }
    } catch (e) { allowServer = false; }
    if (!allowServer) return false;

    return fetch('http://localhost:3000/save-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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


function showToast(message, type = 'info', duration = 3000) {
  try {
    if (typeof document === 'undefined') return;
    const id = 'game-toast-overlay';
    let container = document.getElementById(id);
    if (!container) {
      container = document.createElement('div');
      container.id = id;
      container.style.position = 'fixed';
      container.style.right = '18px';
      container.style.top = '18px';
      container.style.zIndex = 99999;
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '8px';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'game-toast ' + String(type || 'info');
    el.style.minWidth = '180px';
    el.style.maxWidth = '420px';
    el.style.background = type === 'error' ? '#7b1e1e' : (type === 'warn' ? '#8a6d1f' : '#1f6f8f');
    el.style.color = '#fff';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.35)';
    el.style.fontFamily = 'Arial, sans-serif';
    el.style.fontSize = '13px';
    el.style.opacity = '0';
    el.style.transition = 'opacity 220ms ease, transform 220ms ease';
    el.style.transform = 'translateY(-6px)';
    el.textContent = message;
    container.appendChild(el);
    
    void el.offsetWidth;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    const timeout = setTimeout(() => {
      try {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-6px)';
        setTimeout(() => { try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch (e) {} }, 240);
      } catch (e) {}
    }, duration || 3000);
    
    el.addEventListener('click', () => {
      clearTimeout(timeout);
      try { el.style.opacity = '0'; el.style.transform = 'translateY(-6px)'; setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, 180); } catch (e) {}
    });
  } catch (err) {
    console.warn('[game] showToast failed', err);
  }
}

function cleanImageBrown(img) {
  try {
    if (!img) return 0;
    if (typeof img.loadPixels === 'function') img.loadPixels();
    if (!img.pixels || img.pixels.length === 0) return 0;
    let fixed = 0;
    for (let i = 0; i < img.pixels.length; i += 4) {
      const r = img.pixels[i];
      const g = img.pixels[i + 1];
      const b = img.pixels[i + 2];
      
      if (r > 60 && r < 180 && g > 30 && g < 120 && b < 80) {
        if (img.pixels[i + 3] !== 0) {
          img.pixels[i + 3] = 0;
          fixed++;
        }
      }
    }
    if (fixed > 0) {
      try { img.updatePixels(); } catch (e) {}
    }
    return fixed;
  } catch (e) { console.warn('[cleanImageBrown] failed', e); return 0; }
}

function getTileState(x, y, layer = mapStates) {
  if (x < 0 || x >= logicalW || y < 0 || y >= logicalH) return -1;
  return layer[y * logicalW + x];
}

function floodReachable(options = {}) {
  let respectEdgeLayer = Object.prototype.hasOwnProperty.call(options, 'respectEdgeLayer') ? !!options.respectEdgeLayer : true;
  
  if (!EDGE_LAYER_ENABLED) respectEdgeLayer = false;
  if (!logicalW || !logicalH) return new Uint8Array(0);
  const total = logicalW * logicalH;
  const visited = new Uint8Array(total);
  if (!mapStates || mapStates.length !== total) return visited;
  const startIdx = findFloodStart();
  if (startIdx < 0) return visited;
  const queue = new Array(total);
  let head = 0;
  let tail = 0;
  queue[tail++] = startIdx;
  visited[startIdx] = 1;
  while (head < tail) {
    const idx = queue[head++];
    const x = idx % logicalW;
    const y = Math.floor(idx / logicalW);
    const next = [
      { nx: x - 1, ny: y },
      { nx: x + 1, ny: y },
      { nx: x, ny: y - 1 },
      { nx: x, ny: y + 1 }
    ];
    for (const { nx, ny } of next) {
      if (nx < 0 || nx >= logicalW || ny < 0 || ny >= logicalH) continue;
      const nIdx = ny * logicalW + nx;
      if (visited[nIdx]) continue;
      const state = getTileState(nx, ny);
      if (isSolid(state)) continue;
      if (respectEdgeLayer && edgeLayer && edgeLayer.length === total && edgeLayer[nIdx]) continue;
      visited[nIdx] = 1;
      queue[tail++] = nIdx;
    }
  }
  return visited;
}

let _resizeConfirmTimer = null;
let _lastRequestedSize = { w: 0, h: 0 };


try {
  window.addEventListener('keydown', (e) => {
    try {
      if (e.key === 'Escape' || e.keyCode === 27) {
        
        const active = document && document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

        try {
          if (settingsOverlayDiv) {
             if (settingsOverlayDiv.closeZoomPanel) settingsOverlayDiv.closeZoomPanel();
             else settingsOverlayDiv.remove();
             settingsOverlayDiv = null;
             openInGameMenu();
             e.preventDefault();
             return;
          }
        } catch (err) {  }

        try {
          if (inGameMenuVisible) closeInGameMenu();
          else openInGameMenu();
          e.preventDefault();
        } catch (err) {
          console.warn('[game] toggling inGameMenuVisible (global handler) failed', err);
        }
      }
    } catch (err) {  }
  }, false);
} catch (e) { console.warn('[game] failed to attach global Escape handler', e); }

function getColorForState(state) {
  
  if (typeof COLORS !== 'undefined' && COLORS[state]) {
    return COLORS[state];
  }
  
  return [255, 0, 255]; 
}

function buildControlsSettings(ctx) {
  ctx.addSliderRow("Sensitivity", 1, 10, 5, v => {})
     .addCheckboxRow("Invert Y Axis", false);
}

function buildLanguageSettings(ctx) {
  ctx.addSelectRow("Language", ["English", "Spanish", "French", "German"]);
}

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
  
  
  btn.style('font-family', 'MyFont, sans-serif'); 
  btn.style('text-shadow', '3px 3px 0 #000');
  
  
  btn.mouseOver(() => {
    btn.style('filter', 'brightness(1.2)');
    btn.style('transform', 'scale(1.05)');
  });
  btn.mouseOut(() => {
    btn.style('filter', 'brightness(1.0)');
    btn.style('transform', 'scale(1.0)');
  });
  
  
  btn.style('z-index', '20005');
}

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

function spawnCloud(forceX) {
  if (clouds.length >= MAX_CLOUDS) return;
  
  const validImages = cloudImages.filter(img => img);
  if (validImages.length === 0) return;
  
  const cloudImg = validImages[Math.floor(Math.random() * validImages.length)];
  
 
  const worldHeight = 3000; 
  
 
  const minY = 0; 
  const maxY = worldHeight; 
  const yPos = minY + Math.random() * (maxY - minY);
  
  

  const baseSpeed = 0.3 + Math.random() * 1;
  const scale = 2.0 + Math.random() * 4.0;
  

  const currentScale = height / 3000; 
  const startX = (typeof forceX === 'number') ? forceX : -cloudImg.width * scale;

  clouds.push({
    img: cloudImg,
    x: startX,
    y: yPos,
    baseY: yPos,
    speed: baseSpeed,
    scale: scale,
    opacity: 180 + Math.random() * 75,
    verticalDrift: (Math.random() - 0.5) * 0.15,
    driftPhase: Math.random() * Math.PI * 2
  });
}

function buildGameplaySettings(ctx) {
  ctx
    .addCheckboxRow("Show Tutorials", true)
    .addCheckboxRow("Enable HUD", true)
    .addSelectRow("Difficulty", ["Easy", "Normal", "Hard"], {
      value: (difficultySetting.charAt(0).toUpperCase() + difficultySetting.slice(1)),
      onChange: (val) => {
        difficultySetting = val.toLowerCase();
        
        if(typeof setDifficulty === 'function') setDifficulty(difficultySetting, { regenerate: false });
        
        saveLocalSettings(); 
      }
    });
}

function buildControlsSettings(ctx) {
  ctx.addSliderRow("Sensitivity", 1, 10, 5, v => {})
     .addCheckboxRow("Invert Y Axis", false);
}

function buildAccessibilitySettings(ctx) {
  ctx.addSelectRow("Color Mode", ["None", "Protanopia", "Deuteranopia", "Tritanopia"]);
  
  
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

function buildLanguageSettings(ctx) {
  ctx.addSelectRow("Language", ["English", "Spanish", "French", "German"]);
}

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
    
    layout: { labelX: 0, controlX: 0, labelWidth: 0, controlWidth: 0, spacingY: 0 },
    
    container: container, 

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
        try {
          callback(slider.value());
        } catch(e) { try { callback(slider.value()); } catch(e){} }
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
        try { if (typeof options.onChange === 'function') options.onChange(sel.value()); } catch(e) { try { if (typeof options.onChange === 'function') options.onChange(sel.value()); } catch(e){} }
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

  
    const fontPath = 'assets/3-GUI/font.ttf'; 
    const styleId = 'gd-loading-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @font-face { font-family: 'PixelGameFont'; src: url('${fontPath}'); }
        #gd-loading-overlay {
          font-family: 'PixelGameFont', 'Courier New', monospace !important;
          background-color: #000000 !important;
          color: #ffcc00;
        }
        .gd-loading-message {
          font-size: 20px;
          text-transform: uppercase;
          margin-bottom: 8px;
          text-shadow: 1px 1px 0px #111;
          letter-spacing: 1px;
        }
        .gd-progress-container {
          width: 220px;
          max-width: 60%;
          height: 16px;
          border: 1px solid #ffcc00;
          background-color: #111;
          padding: 1px;
          margin-bottom: 4px;
        }
        .gd-progress-fill {
          height: 100%;
          width: 0%;
          background-color: #ffcc00;
          transition: width 0.1s linear;
        }
        .gd-progress-text {
          font-size: 14px;
          color: #888;
        }
      `;
      document.head.appendChild(style);
    }

 
    el = document.createElement('div');
    el.id = 'gd-loading-overlay';
    Object.assign(el.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: '2147483647', userSelect: 'none', opacity: '1' 
    });

   
    const content = document.createElement('div');
    content.id = 'gd-loading-content';
    Object.assign(content.style, {
        display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center',
        transformOrigin: 'center center', 
        transition: 'transform 0.1s ease-out' 
    });

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

function updateClouds() {
  const now = millis();
  
  if (now - lastCloudSpawn > CLOUD_SPAWN_INTERVAL) {
    spawnCloud();
    lastCloudSpawn = now;
  }
  
  
  const virtualWidth = (gameScale && gameScale !== 0) ? width / gameScale : width;

  for (let i = clouds.length - 1; i >= 0; i--) {
    const cloud = clouds[i];
    
    cloud.x += cloud.speed;
    cloud.driftPhase += 0.01;
    cloud.y = cloud.baseY + Math.sin(cloud.driftPhase) * 20 * cloud.verticalDrift;
    
   
    const cloudWidth = cloud.img.width * cloud.scale;
    if (cloud.x > virtualWidth + cloudWidth) {
      clouds.splice(i, 1);
    }
  }
}

function drawClouds() {
  push();
  
  clouds.sort((a, b) => a.scale - b.scale);
  
  for (const cloud of clouds) {
    push();
    tint(255, cloud.opacity);
    imageMode(CORNER);
    
    const w = cloud.img.width * cloud.scale;
    const h = cloud.img.height * cloud.scale;
    
    image(cloud.img, cloud.x, cloud.y, w, h);
    pop();
  }
  
  noTint();
  pop();
}


(function(){
  function ensureError1El(){
    let el = document.getElementById('error1');
    if (!el) {
      el = document.createElement('div');
      el.id = 'error1';
      Object.assign(el.style, {
        position: 'fixed',
        right: '12px',
        bottom: '12px',
        background: 'rgba(220,20,60,0.95)',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: '6px',
        zIndex: 9999,
        fontFamily: 'sans-serif',
        fontSize: '14px',
        display: 'none',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)'
      });
      if (document.body) {
        document.body.appendChild(el);
      } else {
        document.addEventListener('DOMContentLoaded', function(){ try { document.body.appendChild(el); } catch(e){} });
      }
    }
    return el;
  }
  function showError1(name){
    const el = ensureError1El();
    let msg = 'Error 1: Has no functionality yet will be added later';
    try {
      if (name) {
        const short = String(name).trim();
        if (short) msg += ' (' + short + ')';
      }
    } catch(e){}
    el.textContent = msg;
    el.style.display = 'block';
    try { clearTimeout(el.__hideTimeout); } catch(e){}
    el.__hideTimeout = setTimeout(()=>{ try { el.style.display = 'none'; } catch(e){} }, 5000);
    if (typeof console !== 'undefined' && console.warn) console.warn(msg);
  }

  const combinedSelector = '#showTutorials, input[name="showTutorials"], .show-tutorials, #ShowTutorials, #enabledHub, input[name="enabledHub"], .enabled-hub, #EnabledHub, #enabledHUB';

  function delegatedHandler(e){
    try {
      const t = e.target;
      if (!t) return;
      if (typeof t.matches === 'function' && t.matches(combinedSelector)) {
        showError1();
        return;
      }
      const found = t.closest && typeof t.closest === 'function' && t.closest(combinedSelector);
      if (found) showError1();
    } catch(e) {}
  }

  document.addEventListener('change', delegatedHandler, true);
  document.addEventListener('input', delegatedHandler, true);


  try { window.showError1 = showError1; } catch(e) {}
})();

