// Independent of p5/Pixi so failed library loads still offer recovery controls.
const GameStartup = {
  timer: null,
  failed: false,
  stage: 'Loading assets',

  begin(stage) {
    if (this.failed) return;
    this.stage = stage;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fail(new Error('Loading timed out'), this.stage), 30000);
  },

  finish() {
    if (this.failed) return;
    clearTimeout(this.timer);
    const overlay = document.getElementById('gd-loading-overlay');
    if (overlay) overlay.remove();
    const root = document.getElementById('game-root');
    if (root) root.setAttribute('aria-busy', 'false');
  },

  fail(error, stage = this.stage) {
    if (this.failed) return;
    this.failed = true;
    clearTimeout(this.timer);
    console.error('[startup]', stage, error);
    let overlay = document.getElementById('gd-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'gd-loading-overlay';
      document.body.appendChild(overlay);
    }
    overlay.replaceChildren();
    overlay.setAttribute('role', 'alert');
    const message = document.createElement('p');
    message.textContent = `${stage} failed. Please retry.`;
    overlay.appendChild(message);
    const retry = document.createElement('button');
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => window.location.reload());
    overlay.appendChild(retry);
    if (document.getElementById('game-root')) {
      const back = document.createElement('button');
      back.textContent = 'Return to Menu';
      back.addEventListener('click', () => {
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'close-game-overlay' }, window.location.origin);
        } else {
          window.location.href = 'menu.html';
        }
      });
      overlay.appendChild(back);
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'game-load-error', stage }, window.location.origin);
      }
    }
  },
};

window.addEventListener('DOMContentLoaded', () => {
  if (GameStartup.failed) return;
  if (typeof p5 === 'undefined') GameStartup.fail(new Error('p5 failed to load'), 'Loading engine');
});
GameStartup.begin('Loading assets');
