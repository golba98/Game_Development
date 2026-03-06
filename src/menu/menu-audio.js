// === Audio & Music ===
function stopMenuMusicImmediate() {
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
  if (!bgMusic) {
    console.warn('[startMenuMusicIfNeeded] bgMusic not loaded yet');
    return;
  }
  try {
    if (typeof bgMusic.setVolume === 'function') bgMusic.setVolume(musicVol * masterVol);

    if (typeof bgMusic.isPlaying === 'function') {
      if (bgMusic.isPlaying()) return; // already running
      bgMusic.loop();
      console.log('[startMenuMusicIfNeeded] bgMusic.loop() called');
    } else if (typeof bgMusic.loop === 'function') {
      bgMusic.loop();
      console.log('[startMenuMusicIfNeeded] bgMusic.loop() fallback called');
    } else if (typeof bgMusic.play === 'function') {
      bgMusic.play();
      console.log('[startMenuMusicIfNeeded] bgMusic.play() fallback called');
    }
  } catch (err) {
    console.warn('[startMenuMusicIfNeeded] playback error', err);
  }
}
