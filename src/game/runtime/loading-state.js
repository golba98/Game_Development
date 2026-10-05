// Centralized world completion and recovery. Optional audio never gates readiness.
function finishGameLoading() {
  if (runtimeFailed) return;
  mapLoadComplete = true;
  showLoadingOverlay = false;
  generationRetries = 0;
  completeLoadingProgress();
  updateLoadingOverlayDom();
  if (typeof GameStartup !== 'undefined') GameStartup.finish();
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'game-ready' }, window.location.origin);
  }
}

function failGameLoading(error, stage) {
  runtimeFailed = true;
  mapLoadComplete = false;
  genPhase = 0;
  if (typeof GameStartup !== 'undefined') GameStartup.fail(error, stage);
  else console.error('[game]', stage, error);
}

function requestGameRedraw() {
  if (RENDER_BACKEND !== 'pixi' && genPhase === 0 && mapLoadComplete && typeof redraw === 'function') {
    redraw();
  }
}
