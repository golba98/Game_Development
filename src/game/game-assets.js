function preload() {
  try {
    ensureLoadingOverlayDom();
    overlayMessage = 'Loading assets...';
    updateLoadingOverlayDom();
  } catch (e) {}

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

          try {
            const fixed = cleanImageBrown(img);
            if (fixed) verboseLog('[preload] cleaned brown pixels from hill asset', dir, 'fixed=', fixed);
          } catch (e) {}
        } catch (e) {}
        HILL_ASSETS[dir] = img;
    });
  });


  try {
    trackLoadImage('button_bg', 'assets/3-GUI/Button_BG.png',
      (img) => {
        BUTTON_BG = img;
        verboseLog('[game] loaded BUTTON_BG', img && img.width, 'x', img && img.height);
      },
      (err) => { console.warn('[game] failed to load BUTTON_BG', err); BUTTON_BG = null; }
    );
  } catch (e) {}

  try {
    trackLoadImage('settings_overlay', 'assets/1-Background/1-Menu/Settings_Background.png',
      (img) => {
        SETTINGS_OVERLAY = img;
        verboseLog('[game] loaded SETTINGS_OVERLAY', img && img.width, 'x', img && img.height);
      },
      (err) => { console.warn('[game] failed to load SETTINGS_OVERLAY', err); SETTINGS_OVERLAY = null; }
    );
  } catch (e) {}

  try {
    trackLoadImage('esc_menu_background', 'assets/1-Background/1-Menu/Background.png',
      (img) => {
        ESC_MENU_BACKGROUND = img;
        verboseLog('[game] loaded ESC_MENU_BACKGROUND');
      },
      (err) => { console.warn('[game] failed to load ESC_MENU_BACKGROUND', err); ESC_MENU_BACKGROUND = null; }
    );
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

  try {
    trackLoadSound('gameMusic:assets/8-Music/game_music.wav', 'assets/8-Music/game_music.wav',
      (snd) => { gameMusic = snd; },
      (err) => { gameMusic = null; }
    );
  } catch (e) {
    try { gameMusic = loadSound('assets/8-Music/game_music.wav'); } catch (ee) { gameMusic = null; }
  }
  try {
    trackLoadSound('clickSFX:assets/9-Sounds/Button_Press.mp3', 'assets/9-Sounds/Button_Press.mp3',
      (snd) => { clickSFX = snd; },
      (err) => { clickSFX = null; }
    );
  } catch (e) {
    try { clickSFX = loadSound('assets/9-Sounds/Button_Press.mp3'); } catch (ee) { clickSFX = null; }
  }

  try {
    trackLoadImage('mantis_move', 'assets/2-Characters/5-Enemies/MantisMove.png',
      (img) => { mantisMoveSprite = img; verboseLog('[game] loaded MantisMove.png'); },
      (err) => { console.warn('[game] failed to load MantisMove.png', err); }
    );

    trackLoadImage('mantis_attack', 'assets/2-Characters/5-Enemies/MantisAttack.png',
      (img) => { mantisAttackSprite = img; verboseLog('[game] loaded MantisAttack.png'); },
      (err) => { console.warn('[game] failed to load MantisAttack.png', err); }
    );

    trackLoadImage('beetle_move', 'assets/2-Characters/5-Enemies/BeetleMove.png',
      (img) => { beetleMoveSprite = img; verboseLog('[game] loaded BeetleMove.png'); },
      (err) => { console.warn('[game] failed to load BeetleMove.png', err); }
    );

    trackLoadImage('beetle_attack', 'assets/2-Characters/5-Enemies/BeetleAttack.png',
      (img) => { beetleAttackSprite = img; verboseLog('[game] loaded BeetleAttack.png'); },
      (err) => { console.warn('[game] failed to load BeetleAttack.png', err); }
    );

    trackLoadImage('maggot_walk', 'assets/2-Characters/5-Enemies/MaggotWalk.png',
      (img) => { maggotWalkSprite = img; verboseLog('[game] loaded MaggotWalk.png'); },
      (err) => { console.warn('[game] failed to load MaggotWalk.png', err); }
    );

    trackLoadImage('maggot_spit', 'assets/2-Characters/5-Enemies/MaggotSpit.png',
      (img) => { maggotSpitSprite = img; verboseLog('[game] loaded MaggotSpit.png'); },
      (err) => { console.warn('[game] failed to load MaggotSpit.png', err); }
    );

    trackLoadImage('acid_blob', 'assets/2-Characters/5-Enemies/AcidBlob.png',
      (img) => { acidBlobSprite = img; verboseLog('[game] loaded AcidBlob.png'); },
      (err) => { console.warn('[game] failed to load AcidBlob.png', err); }
    );

    trackLoadImage('heart', 'assets/3-GUI/Heart.png',
      (img) => { heartImage = img; verboseLog('[game] loaded Heart.png'); },
      (err) => { console.warn('[game] failed to load Heart.png', err); }
    );

    trackLoadImage('coin_anim', 'assets/6-Icons/coin_4_frames.png',
      (img) => { coinAnimSprite = img; verboseLog('[game] loaded coin_4_frames.png'); },
      (err) => { console.warn('[game] failed to load coin_4_frames.png', err); }
    );

    trackLoadImage('acid_splat', 'assets/2-Characters/5-Enemies/AcidSplat.png',
      (img) => { acidSplatSprite = img; verboseLog('[game] loaded AcidSplat.png'); },
      (err) => { console.warn('[game] failed to load AcidSplat.png', err); }
    );

    trackLoadImage('eggsplosion', 'assets/2-Characters/5-Enemies/Eggsplosion.png',
      (img) => { eggsplosionSprite = img; verboseLog('[game] loaded Eggsplosion.png'); },
      (err) => { console.warn('[game] failed to load Eggsplosion.png', err); }
    );

    trackLoadImage('ghost_move', 'assets/2-Characters/5-Enemies/GhostMove.png',
      (img) => {
        try {
          const cols = 3, rows = 4, targetH = 64;
          const targetW = Math.round(targetH * ((img.width / cols) / (img.height / rows)));
          img.resize(targetW * cols, targetH * rows);
          ghostMoveSprite = img;
          verboseLog('[game] loaded + downscaled GhostMove.png safely');
        } catch (e) {
          ghostMoveSprite = img;
          verboseLog('[game] loaded GhostMove.png (raw, downscale failed)', e);
        }
      },
      (err) => { console.warn('[game] failed to load GhostMove.png', err); }
    );

    trackLoadImage('ghost_attack', 'assets/2-Characters/5-Enemies/GhostAttack.png',
      (img) => {
        try {
          const cols = 3, rows = 4, targetH = 64;
          const targetW = Math.round(targetH * ((img.width / cols) / (img.height / rows)));
          img.resize(targetW * cols, targetH * rows);
          ghostAttackSprite = img;
          verboseLog('[game] loaded + downscaled GhostAttack.png safely');
        } catch (e) {
          ghostAttackSprite = img;
          verboseLog('[game] loaded GhostAttack.png (raw, downscale failed)', e);
        }
      },
      (err) => { console.warn('[game] failed to load GhostAttack.png', err); }
    );

    trackLoadImage('powerup_sprite', 'assets/2-Characters/5-Enemies/EggCluster.png',
      (img) => { powerupSprite = img; verboseLog('[game] loaded EggCluster.png'); },
      (err) => { console.warn('[game] failed to load EggCluster.png', err); }
    );

    trackLoadImage('portal_active', 'assets/5-Objects/2-Portal/portal_active_sheet.png',
      (img) => { portalActiveSheet = img; },
      (err) => { console.warn('[game] failed to load portal_active_sheet.png', err); }
    );

    trackLoadImage('portal_inactive', 'assets/5-Objects/2-Portal/portal_inactive_sheet.png',
      (img) => { portalInactiveSheet = img; },
      (err) => { console.warn('[game] failed to load portal_inactive_sheet.png', err); }
    );
  } catch (e) {}
}


function createChestGraphics() {
  let pg = createGraphics(32, 32);
  pg.clear();

  // Chest body
  pg.stroke(40);
  pg.strokeWeight(2);
  pg.fill(139, 69, 19); // Brown
  pg.rect(4, 12, 24, 16, 2);

  // Lid
  pg.fill(160, 82, 45);
  pg.rect(4, 6, 24, 8, 4);

  // Banding
  pg.fill(218, 165, 32); // Gold
  pg.noStroke();
  pg.rect(8, 6, 4, 22);
  pg.rect(20, 6, 4, 22);

  // Lock
  pg.fill(50);
  pg.rect(14, 14, 4, 4, 1);

  return pg;
}

function createPotionGraphics(liquidColor) {
  let pg = createGraphics(32, 32);
  pg.clear();

  // Bottle outline/body
  pg.stroke(40);
  pg.strokeWeight(2);
  pg.fill(220, 220, 220, 180); // Glass

  // Body
  pg.rect(8, 12, 16, 16, 4);
  // Neck
  pg.rect(12, 6, 8, 6);
  // Stopper
  pg.fill(139, 69, 19);
  pg.noStroke();
  pg.rect(11, 4, 10, 3);

  // Liquid
  pg.fill(liquidColor);
  pg.rect(10, 16, 12, 10, 2);

  // Shine
  pg.fill(255, 255, 255, 100);
  pg.noStroke();
  pg.rect(10, 14, 4, 4);

  return pg;
}

function createSpeedPotionGraphics() {
  let pg = createGraphics(32, 32);
  pg.clear();

  // Shadow beneath bottle
  pg.noStroke();
  pg.fill(0, 0, 0, 50);
  pg.ellipse(16, 30, 14, 4);

  // Glass body — taller and narrower than health potion
  pg.stroke(30, 30, 60);
  pg.strokeWeight(1.5);
  pg.fill(200, 220, 255, 160);
  pg.rect(10, 13, 12, 15, 3);

  // Neck — slim
  pg.stroke(30, 30, 60);
  pg.strokeWeight(1.5);
  pg.fill(180, 210, 255, 160);
  pg.rect(13, 7, 6, 7);

  // Gold stopper / cork
  pg.noStroke();
  pg.fill(218, 165, 32);
  pg.rect(12, 5, 8, 3, 1);
  // Cork highlight
  pg.fill(255, 220, 80, 180);
  pg.rect(13, 5, 3, 1);

  // Cyan liquid fill
  pg.fill(0, 210, 240, 220);
  pg.noStroke();
  pg.rect(11, 17, 10, 9, 2);

  // Liquid inner glow (lighter cyan stripe)
  pg.fill(120, 245, 255, 160);
  pg.rect(12, 18, 3, 6, 1);

  // Speed motion streaks inside liquid
  pg.stroke(255, 255, 255, 140);
  pg.strokeWeight(1);
  pg.line(14, 19, 18, 22);
  pg.line(13, 22, 17, 24);

  // Glass shine on body
  pg.noStroke();
  pg.fill(255, 255, 255, 110);
  pg.rect(11, 14, 3, 6, 1);

  // Tiny sparkle top-right of bottle
  pg.stroke(180, 240, 255, 200);
  pg.strokeWeight(1);
  pg.line(22, 10, 24, 8);
  pg.line(21, 8, 25, 10);

  return pg;
}

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
  },
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

let SETTINGS_OVERLAY = null;
let ESC_MENU_BACKGROUND = null;

const WALK_SHEET_COMBINED = 'assets/2-Characters/2-Walking/16x16 Walk-Sheet.png';
const RUN_SHEET_COMBINED = WALK_SHEET_COMBINED;

let playerAnimFrame = 0;
let playerAnimTimer = 0;
let playerAnimSpeed = 150;

const IDLE_DIRS = ['N','NE','E','SE','S','SW','W','NW'];

let idleFrames = { N:[], NE:[], E:[], SE:[], S:[], SW:[], W:[], NW:[] };
let walkFrames = { N:[], NE:[], E:[], SE:[], S:[], SW:[], W:[], NW:[] };
let runFrames  = { N:[], NE:[], E:[], SE:[], S:[], SW:[], W:[], NW:[] };
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
    N:  'assets/2-Characters/1-Idle/idle_sheet_north.png',
    NE: 'assets/2-Characters/1-Idle/idle_sheet_northeast.png',
    E:  'assets/2-Characters/1-Idle/idle_sheet_east.png',
    SE: 'assets/2-Characters/1-Idle/idle_sheet_southeast.png',
    S:  'assets/2-Characters/1-Idle/idle_sheet_south.png',
    SW: 'assets/2-Characters/1-Idle/idle_sheet_southwest.png',
    W:  'assets/2-Characters/1-Idle/idle_sheet_west.png',
    NW: 'assets/2-Characters/1-Idle/idle_sheet_northwest.png'
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
const ATTACK_SHEET_PATHS = {
    N:  'assets/2-Characters/6-Attack/attack_north.png',
    NE: 'assets/2-Characters/6-Attack/attack_north_east.png',
    E:  null,
    SE: 'assets/2-Characters/6-Attack/attack_south_east.png',
    S:  'assets/2-Characters/6-Attack/attack_south.png',
    SW: 'assets/2-Characters/6-Attack/attack_south_west.png',
    W:  'assets/2-Characters/6-Attack/attack_west.png',
    NW: 'assets/2-Characters/6-Attack/attack_north_west.png'
};
let attackSheets = { N:null, NE:null, E:null, SE:null, S:null, SW:null, W:null, NW:null };

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
    const cloudArray = cloudImages;
    const targetCount = typeof CLOUD_IMAGE_COUNT === 'number' ? CLOUD_IMAGE_COUNT : 4;
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
    loadDirectionalSheets(ATTACK_SHEET_PATHS, attackSheets, 'attack_sheet');
    loadCloudTextures();
    try { logAssetTrackerStatus('after deferred character assets'); } catch (e) {}
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(runDeferredLoads, { timeout: 500 });
  } else {
    setTimeout(runDeferredLoads, 50);
  }

  try { logAssetTrackerStatus('deferred character assets scheduled'); } catch (e) {}
}

// Calls img.remove() if available, to release GPU/memory resources.
function releaseImageReference(img) {
  if (!img) return;
  if (typeof img.remove === 'function') { try { img.remove(); } catch (e) {} }
}

// Sets every key of an object to null (used to drop image references in bulk).
function clearObjectValues(target) {
  if (!target || typeof target !== 'object') return;
  Object.keys(target).forEach((key) => { target[key] = null; });
}

// Releases all loaded images, sounds, and resets the AssetTracker.
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

  try { if (gameMusic && typeof gameMusic.stop === 'function') gameMusic.stop(); } catch (e) {}
  gameMusic = null;
  clickSFX = null;

  AssetTracker.loaded = 0;
  AssetTracker.expected = 0;
  AssetTracker.names.clear();
  AssetTracker._callbacks = [];
  AssetTracker._resolve = null;
  AssetTracker._readyPromise = null;

  genTempData = {};
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

