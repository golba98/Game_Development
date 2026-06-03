// === Audio & Music ===
function stopMenuMusicImmediate() {
  isMenuMusicPlaying = false;
  try {
    if (!bgMusic) { menuMusicStopped = true; return; }
    try { if (typeof bgMusic.stop === 'function') bgMusic.stop(); } catch (e) {}
    try { if (typeof bgMusic.pause === 'function') bgMusic.pause(); } catch (e) {}
    try { if (typeof bgMusic.setVolume === 'function') bgMusic.setVolume(0); } catch (e) {}
    menuMusicStopped = !(typeof bgMusic.isPlaying === 'function' && bgMusic.isPlaying());
  } catch (e) {
    console.warn('[stopMenuMusicImmediate] failed to stop bgMusic', e);
    menuMusicStopped = true;
  }
}

// === Audio Controls ===
function applyVolumes() {
  if (bgMusic?.isPlaying()) bgMusic.setVolume(musicVol * masterVol);
}

function playClickSFX() {
  if (clickSFX) {
    clickSFX.setVolume(sfxVol * masterVol);
    clickSFX.play();
  }
}

// === Audio Unlock / Start ===
function unlockAudioAndStart(cb) {
  // 1. Immediately fire UI response
  if (cb) cb();

  // 2. Setup Audio asynchronous to the UI callback
  if (audioUnlocked) {
    return;
  }
  
  audioUnlocked = true;

  try {
    if (typeof userStartAudio === 'function') {
      userStartAudio()
        .then(()  => startMenuMusicIfNeeded())
        .catch(() => {
          try {
            getAudioContext().resume()
              .then(()  => startMenuMusicIfNeeded())
              .catch(() => {});
          } catch (e) {
            startMenuMusicIfNeeded();
          }
        });
    } else {
      try { getAudioContext().resume(); } catch (e) {}
      startMenuMusicIfNeeded();
    }
  } catch (e) {}
}

// === Music Control ===
function startMenuMusicIfNeeded() {
  // Never (re)start menu music while the game overlay is open — guards against an
  // async unlock callback racing the Play -> stopMenuMusicImmediate() path.
  if (typeof inGame !== 'undefined' && inGame) return;
  if (!bgMusic) {
    console.warn('[startMenuMusicIfNeeded] bgMusic not loaded yet');
    return;
  }
  // Synchronous guard: isPlaying() does not flip to true immediately after loop(),
  // so without this two near-simultaneous calls would both fire bgMusic.loop().
  if (isMenuMusicPlaying) return;
  if (typeof bgMusic.isPlaying === 'function' && bgMusic.isPlaying()) {
    isMenuMusicPlaying = true;
    return;
  }
  try {
    if (typeof bgMusic.setVolume === 'function') bgMusic.setVolume(musicVol * masterVol);

    if (typeof bgMusic.loop === 'function') {
      isMenuMusicPlaying = true;
      bgMusic.loop();
      console.log('[startMenuMusicIfNeeded] bgMusic.loop() called');
    } else if (typeof bgMusic.play === 'function') {
      isMenuMusicPlaying = true;
      bgMusic.play();
      console.log('[startMenuMusicIfNeeded] bgMusic.play() fallback called');
    }
  } catch (err) {
    isMenuMusicPlaying = false;
    console.warn('[startMenuMusicIfNeeded] playback error', err);
  }
}
