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
  if (audioUnlocked) {
    cb && cb();
    return;
  }

  // Shared teardown: mark unlocked, start music, fire callback.
  const finish = (logMsg) => {
    audioUnlocked = true;
    if (logMsg) console.log(logMsg);
    startMenuMusicIfNeeded();
    cb && cb();
  };

  try {
    if (typeof userStartAudio === 'function') {
      userStartAudio()
        .then(()  => finish('[unlockAudioAndStart] userStartAudio resolved — starting menu music'))
        .catch(() => {
          try {
            getAudioContext().resume()
              .then(()  => finish('[unlockAudioAndStart] AudioContext.resume succeeded — starting menu music'))
              .catch(() => finish('[unlockAudioAndStart] resume rejected but marking audio unlocked'));
          } catch (e) {
            finish('[unlockAudioAndStart] fallback unlock — starting menu music');
          }
        });
    } else {
      try { getAudioContext().resume(); } catch (e) {}
      finish('[unlockAudioAndStart] no userStartAudio — audioUnlocked set');
    }
  } catch (e) { finish(); }
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
