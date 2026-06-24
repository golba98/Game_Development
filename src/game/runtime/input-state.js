// runtime/input-state.js — centralized keyboard state (the "input" layer).
//
// Single source of truth for key state, fed by window-level keydown/keyup in the
// capture phase so input is recorded the instant it happens — independent of the
// render/update frame. This is what keeps controls responsive at low FPS: a key
// that goes down between frames is already latched before the next update reads it.
//
// State model (zero per-frame allocation):
//   _down      — keyCodes physically held right now (live, event-driven)
//   _pressed   — keyCodes that went down since the last endFrame() (edge)
//   _released  — keyCodes that came up since the last endFrame() (edge)
//
// Derived states callers can ask for:
//   isDown(code)     — held this instant            (matches p5 keyIsDown)
//   wasPressed(code) — went down since last frame   (rising edge)
//   wasReleased(code)— came up since last frame      (falling edge)
//   isHeld(code)     — down but not a fresh press    (steady hold)
//
// Codes are p5/DOM keyCodes so existing playerKeybinds.* values work unchanged.

const InputState = {
  _down: new Set(),
  _pressed: new Set(),
  _released: new Set(),
  _installed: false,

  /** Attach global listeners. Safe to call more than once. */
  install: function () {
    if (this._installed || typeof window === "undefined") return;
    const self = this;

    window.addEventListener(
      "keydown",
      function (ev) {
        const code = ev.keyCode || ev.which;
        if (!code) return;
        // ev.repeat is the OS auto-repeat; only a genuine first press is an edge.
        if (!ev.repeat && !self._down.has(code)) self._pressed.add(code);
        self._down.add(code);
      },
      { capture: true },
    );

    window.addEventListener(
      "keyup",
      function (ev) {
        const code = ev.keyCode || ev.which;
        if (!code) return;
        self._down.delete(code);
        self._released.add(code);
      },
      { capture: true },
    );

    window.addEventListener("blur", function () {
      self._down.clear();
    });

    window.addEventListener("focusout", function () {
      self._down.clear();
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        self._down.clear();
      }
    });

    this._installed = true;
  },

  isDown: function (code) {
    return this._down.has(code);
  },

  wasPressed: function (code) {
    return this._pressed.has(code);
  },

  wasReleased: function (code) {
    return this._released.has(code);
  },

  isHeld: function (code) {
    return this._down.has(code) && !this._pressed.has(code);
  },

  /** True if any of the given keyCodes is currently down. */
  anyDown: function () {
    for (let i = 0; i < arguments.length; i++) {
      if (this._down.has(arguments[i])) return true;
    }
    return false;
  },

  /** Clear the per-frame edge latches. Call once at the end of each frame. */
  endFrame: function () {
    if (this._pressed.size) this._pressed.clear();
    if (this._released.size) this._released.clear();
  },
};

// Install immediately on load (mirrors the existing window listeners in
// game-input.js). p5 globals aren't needed here, so load order is irrelevant.
try {
  InputState.install();
} catch (e) {}
