// === Video / Background ===
function ensureLoopFallbackBuffer() {
  if (!loopFallbackBuffer || loopFallbackBuffer.width !== width || loopFallbackBuffer.height !== height) {
    loopFallbackBuffer = createGraphics(width, height);
  }
}

function captureLoopFallbackFrame() {
  if (!bgVideo) return;
  ensureLoopFallbackBuffer();
  loopFallbackBuffer.clear();
  loopFallbackBuffer.image(bgVideo, 0, 0, width, height);
  fallbackFrameReady = true;
}

function disposeMenuBackgroundVideo() {
  if (!bgVideo) return;
  try {
    if (typeof bgVideo.pause === 'function') bgVideo.pause();
    bgVideo.remove();
  } catch (e) {}
  bgVideo = null;
  fallbackFrameReady = false;
  videoLoopPending = false;
  wasInVideoFadeWindow = false;
  videoOpacity = 0;
  fallbackOpacity = 0;
  if (videoBuffer) {
    try { videoBuffer.remove(); } catch (e) {}
  }
  videoBuffer = null;
  if (loopFallbackBuffer) {
    try { loopFallbackBuffer.remove(); } catch (e) {}
  }
  loopFallbackBuffer = null;
}

function initializeMenuBackgroundVideo(videoElement) {
  if (!videoElement) return;
  bgVideo = videoElement;
  try {
    bgVideo.hide();
    if (bgVideo.elt) {
      bgVideo.elt.muted = true;
      bgVideo.elt.loop = false;
      bgVideo.elt.addEventListener('loadeddata', () => {
        captureLoopFallbackFrame();
      }, { once: true });
    }
  } catch (e) {}
  videoOpacity = 255;
  fallbackOpacity = 0;
  fallbackFrameReady = false;
  wasInVideoFadeWindow = false;
  videoLoopPending = false;
  bgVideo.onended(() => { videoLoopPending = true; });
  try {
    bgVideo.loop();
    bgVideo.play();
  } catch (e) {}
}

function disableMenuBackgroundVideo() {
  if (inGame) return;
  inGame = true;
  disposeMenuBackgroundVideo();
}

function enableMenuBackgroundVideo() {
  if (document.getElementById('game-overlay')) {
    return;
  }
  inGame = false;
  if (bgVideo) {
    try {
      bgVideo.loop();
      bgVideo.play();
    } catch (e) {}
    return;
  }
  videoBuffer = videoBuffer || createGraphics(width, height);
  initializeMenuBackgroundVideo(createVideo(MENU_VIDEO_PATH));
}

function updateBackgroundVideo() {
  if (!bgVideo || typeof bgVideo.duration !== 'function' || typeof bgVideo.time !== 'function') return;
  const duration = bgVideo.duration();
  if (!duration || !isFinite(duration)) return;
  const currentTime = bgVideo.time();
  if (!isFinite(currentTime)) return;

  const inFadeWindow = duration - currentTime <= VIDEO_FADE_WINDOW;
  const dt = (typeof deltaTime === 'number' ? deltaTime : 16.67) / 1000;
  const fadeStep = 255 * dt / VIDEO_FADE_WINDOW;
  const recoverStep = 255 * dt / (VIDEO_FADE_WINDOW * VIDEO_RECOVERY_WINDOW);

  if (inFadeWindow && !wasInVideoFadeWindow) {
    captureLoopFallbackFrame();
    wasInVideoFadeWindow = true;
  } else if (!inFadeWindow && wasInVideoFadeWindow) {
    wasInVideoFadeWindow = false;
  }

  if (inFadeWindow) {
    videoOpacity = max(0, videoOpacity - fadeStep);
    fallbackOpacity = min(255, fallbackOpacity + fadeStep);
    videoLoopPending = true;
  } else {
    videoOpacity = min(255, videoOpacity + recoverStep);
    fallbackOpacity = max(0, fallbackOpacity - recoverStep);
  }

  if (videoLoopPending && videoOpacity <= 0) {
    videoLoopPending = false;
    try {
      bgVideo.time(0);
      bgVideo.play();
    } catch (e) {}
  }
}
