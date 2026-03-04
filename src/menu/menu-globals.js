const VIDEO_FADE_WINDOW = 1.0;
const LOOP_CAPTURE_DELAY_MS = 150;
const VIDEO_RECOVERY_WINDOW = 0.75;

const CONTROL_VERTICAL_NUDGE = 8;
const SELECT_VERTICAL_NUDGE = 15;
const TEXTSIZE_BUTTON_Y_OFFSET = 10;
const BACK_BUTTON_VERTICAL_OFFSET = 0;



const DEFAULT_CONTROLS = Object.freeze({
  UP:    { key: 'W', code: 87 },
  DOWN:  { key: 'S', code: 83 },
  LEFT:  { key: 'A', code: 65 },
  RIGHT: { key: 'D', code: 68 },
  JUMP:  { key: ' ', code: 32 },
  DASH:  { key: 'SHIFT', code: 16 },
  ATTACK:{ key: 'MOUSE0', code: -1 }, // Special code for mouse
  MENU:  { key: 'ESCAPE', code: 27 }
});

let userControls = JSON.parse(JSON.stringify(DEFAULT_CONTROLS));


if (typeof window !== 'undefined') {
  window.MENU_TEXT_SIZE_PRESETS = [
    { label: 'Small', value: 60 },
    { label: 'Default', value: 75 },
    { label: 'Big', value: 90 }
  ];
}

const DIFFICULTY_LABELS = Object.freeze({
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard'
});

const MENU_VIDEO_PATH = "assets/1-Background/1-Menu/Menu_Vid.mp4";

let bgVideo = null;
let videoBuffer = null;
let rectSkin = null;
let loopFallbackBuffer = null;

let myFont = null;
let baseFontPx = 0;
let smallFontPx = 0;
let labelFontPx = 0;
let headingFontPx = 0;

let bgMusic = null;
let bgPlayMusic = null;
let clickSFX = null;
let menuMusicStopped = false;

let _lastMenuZoomLog = null;

let playButtonBackground = null;
let settingsButtonBackground = null;
let exitButtonBackground = null;
let btnPlay = null;
let btnSettings = null;
let btnExit = null;

let categoryBackgrounds = [];
let categoryButtons = [];
let saveBackground = null;
let btnSave = null;
let backMenuBackground = null;
let btnBackMenu = null;

let activeSettingElements = [];

let showingSettings = false;
let activeCategory = null;
let fadeAlpha = 0;
let videoOpacity = 255;
let fallbackOpacity = 0;
let inGame = false;
let loading = true;
let loadingProgress = 0;

let textSizeSetting = DEFAULT_SETTINGS.textSize;
let difficultySetting = DEFAULT_SETTINGS.difficulty;
let masterVol = DEFAULT_SETTINGS.masterVol;
let musicVol = DEFAULT_SETTINGS.musicVol;
let sfxVol = DEFAULT_SETTINGS.sfxVol;

let sensitivitySetting = 5;
let invertYAxis = false;
let showTutorials = true;
let showHUD = true;
let languageSetting = 'English';
let colorModeSetting = 'None';

let audioUnlocked = false;
let videoLoopPending = false;
let fallbackFrameReady = false;
let wasInVideoFadeWindow = false;
let resizeTimeout = null;
let _menuResizeTimer = null;
let _menuLastSize = { w: 0, h: 0 };
let _menuResizeInitialScale = 1;

let skipNextMenuReload = false;

let menuDomParent = null;
let settingsMenuRoot = null;
let settingsMenuContent = null;
let settingsMenuStabilityHandle = null;
let settingsMenuScaleWrapper = null;
let settingsMenuZoomHandle = null;
const BASE_MENU_DPR = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
let __menuZoomProbeEl = null;
const zoomNeutralElements = new Set();
const zoomAwareSliders = new Map();

let mainButtonWidth = 0;
let mainButtonHeight = 0;
let mainButtonGap = 0;

let isTerminalOpen = false;
let terminalEl = null;
let terminalHistory = [];
let terminalHistoryIndex = -1;

let canvas;
