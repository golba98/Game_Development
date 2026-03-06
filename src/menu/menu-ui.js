// === Layout / Menu Creation ===
function calculateLayout() {
  mainButtonWidth = 0.25 * width;
  mainButtonHeight = 0.12 * height;
  mainButtonGap  = 0.045 * height;
}

function createMainMenu() {
  const cx = width / 2;
  const startY = height / 2 - (mainButtonHeight * 1.5 + mainButtonGap);

  playButtonBackground = createBgImg("assets/3-GUI/Button_BG.png", cx - mainButtonWidth / 2, startY, mainButtonWidth, mainButtonHeight);

  btnPlay = makeBtn("▶ Play", cx - mainButtonWidth / 2, startY, mainButtonWidth, mainButtonHeight, () => {
    console.log("Play pressed — opening game overlay iframe with settings");

    unlockAudioAndStart(() => {
      disableMenuBackgroundVideo();
      playClickSFX();
      hideMainMenu();
        try {
          stopMenuMusicImmediate();
          console.log('[createMainMenu] requested stopMenuMusicImmediate for overlay');
        } catch (e) { console.warn('Failed to stop bgMusic', e); }

      let overlay = document.getElementById('game-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'game-overlay';
        Object.assign(overlay.style, {
          position: 'fixed', inset: '0', display: 'flex', flexDirection: 'column',
          background: '#000', zIndex: 2147483647, margin: '0', padding: '0'
        });



        const iframe = document.createElement('iframe');
        iframe.id = 'game-iframe';
        const params = new URLSearchParams({
          masterVol,
          musicVol,
          sfxVol,
          difficulty: difficultySetting
        });
        iframe.src = `3-Game_Index.html?${params.toString()}`;
        Object.assign(iframe.style, {
          width: '100%', height: '100%', border: 'none', background: '#000'
        });

        overlay.appendChild(iframe);
        document.body.appendChild(overlay);
        try {
          document.documentElement.style.overflow = 'hidden';
          document.body.style.overflow = 'hidden';
        } catch (e) {}
        disableMenuBackgroundVideo();

        iframe.addEventListener('load', () => {
          try {
            if (iframe.contentWindow) {
              // Give keyboard focus to the game iframe so WASD input works
              try { iframe.focus(); } catch (e) {}
              try { iframe.contentWindow.focus(); } catch (e) {}
              iframe.contentWindow.postMessage({
                type: 'update-audio-settings',
                masterVol, musicVol, sfxVol,
                difficulty: difficultySetting
              }, '*');
              console.log('[parent] iframe load: sent audio settings to game iframe');
              (function waitAndRequestStart() {
                const startTs = Date.now();
                const maxWait = 800;
                const poll = () => {
                  if (menuMusicStopped || Date.now() - startTs > maxWait) {
                    try {
                      iframe.contentWindow.postMessage({ type: 'start-game-music' }, '*');
                      console.log('[parent] iframe load: requested start-game-music (after wait)');
                    } catch (e) { console.warn('[parent] failed to request start-game-music', e); }
                  } else {
                    setTimeout(poll, 60);
                  }
                };
                poll();
              })();
            }
          } catch (e) { console.warn('[parent] failed to post audio settings on iframe load', e); }
        }, { once: true });

        setTimeout(() => {
          try {
            const ifr = document.getElementById('game-iframe');
            if (ifr && ifr.contentWindow) {
              ifr.contentWindow.postMessage({
                type: 'update-audio-settings',
                masterVol, musicVol, sfxVol,
                difficulty: difficultySetting
              }, '*');
              console.log('[parent] fallback: posted audio settings to iframe after timeout');
            }
          } catch (e) {}
        }, 500);


        setTimeout(() => {
          try {
            const ifr = document.getElementById('game-iframe');
            if (ifr && ifr.contentWindow) {
              ifr.contentWindow.postMessage({ type: 'game-activated' }, '*');
              console.log('[parent] posted game-activated to iframe');
              // Ensure iframe has keyboard focus for WASD input
              try { ifr.focus(); } catch (e) {}
              try { ifr.contentWindow.focus(); } catch (e) {}
            }
          } catch (e) {}
        }, 180);
      } else {
        disableMenuBackgroundVideo();
        overlay.style.display = 'flex';
        const ifr = document.getElementById('game-iframe');
        if (ifr && ifr.contentWindow) {
            ifr.contentWindow.postMessage({ type: 'game-activated' }, '*');
            console.log('[parent] posted game-activated to iframe (resume)');
            try { ifr.focus(); } catch (e) {}
            try { ifr.contentWindow.focus(); } catch (e) {}
        }
      }
    });
  });

  const settingsY = startY + mainButtonHeight + mainButtonGap;
  settingsButtonBackground = createBgImg("assets/3-GUI/Button_BG.png", cx - mainButtonWidth / 2, settingsY, mainButtonWidth, mainButtonHeight);
  btnSettings = makeBtn("⚙ Settings", cx - mainButtonWidth / 2, settingsY, mainButtonWidth, mainButtonHeight, () => {
    unlockAudioAndStart(() => {
      playClickSFX();
      fadeTo(() => {
        hideMainMenu();
        showingSettings = true;
        showSettingsMenu();
      });
    });
  });

  const exitY = settingsY + mainButtonHeight + mainButtonGap;
  exitButtonBackground = createBgImg("assets/3-GUI/Button_BG.png", cx - mainButtonWidth / 2, exitY, mainButtonWidth, mainButtonHeight);
  btnExit = makeBtn("✖ Exit", cx - mainButtonWidth / 2, exitY, mainButtonWidth, mainButtonHeight, () => {
    unlockAudioAndStart(() => {
      playClickSFX();
      fadeTo(() => {
        hideMainMenu();
        showingSettings = false;
        alert("Thank you for playing!");
      });
    });
  });

  applyCurrentTextSize();
}

// === Visual Helpers ===
function fadeTo(callback) {
  fadeInProgress = true;
  let fadeOut = true;
  const step = () => {
    fadeAlpha += fadeOut ? 15 : -15;
    fadeAlpha = constrain(fadeAlpha, 0, 255);
    if (fadeOut && fadeAlpha === 255) {
      callback();
      fadeOut = false;
    }
    if (fadeAlpha === 0) {
      fadeInProgress = false;
      return;
    }
    setTimeout(step, 20);
  };
  step();
}

// === UI Element Factories ===
function makeBtn(label, x, y, w, h, cb) {
  const b = createButton(label);
  b.parent(getMenuDomParent());
  b.size(w, h).position(x, y);
  styleButton(b);
  b.mousePressed(cb);
  return b;
}

function createBgImg(path, x, y, w, h, zIndex = '9998') {
  const img = createImg(path, '');
  img.parent(getMenuDomParent());
  img.size(w, h).position(x, y);
  img.style('pointer-events', 'none');
  img.style('z-index', zIndex);
  img.style('position', 'absolute');
  return img;
}

function makeSmallBtn(label, x, y, w, h, cb) {
  const b = createButton(label);
  b.parent(getMenuDomParent());
  b.size(w, h).position(x, y);
  styleSmallButton(b);
  b.mousePressed(cb);
  return b;
}

function createSettingLabel(txt, x, y, width = 200, parentEl = null) {
  const d = createDiv(txt);
  d.parent(parentEl || getMenuDomParent());
  d.position(x, y);
  d.style("color", "white");
  // Consistent font size and family
  d.style("font-family", "'MyFont', sans-serif");
  d.style("font-size", "22px");
  d.style("text-align", "right");
  d.style("width", width + "px");
  d.style("z-index", "4");
  d.style("position", "absolute");
  d.style("pointer-events", "none");
  d.style("line-height", "1.2");
  if (d.elt && d.elt.classList) d.elt.classList.add('setting-label');
  return d;
}

// === Styling / Helpers ===
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
  if (btn.elt) {
    btn.elt.style.position = 'absolute';
    btn.elt.style.pointerEvents = 'auto';
    btn.elt.style.zIndex = '10001';
  }
}

// === Settings Helpers ===
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
