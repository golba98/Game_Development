// runtime/scene-manager.js — runtime state/scene façade (the "scenes" layer).
//
// The runtime has always tracked its state with a handful of separate booleans
// (inGameMenuVisible, settingsOverlayDiv, isGameOver) plus genPhase /
// showLoadingOverlay. The same boolean combinations were re-derived inline all
// over draw(), e.g. `!settingsOverlayDiv && !inGameMenuVisible && !isGameOver`,
// which is easy to get subtly wrong.
//
// SceneManager is a thin READ-ONLY façade over those existing flags — it does
// not own or mutate them, so behavior is identical — that gives one place to ask
// semantic questions about runtime state:
//
//   current()        -> SCENES.* describing the dominant state this frame
//   isSimulating()   -> gameplay logic (movement, enemies, combat) should run
//   isOverlayOpen()  -> a pause/menu/settings overlay is covering the game
//   isGameOver()     -> the death/game-over state is active
//   isBusy()         -> loading assets or generating the map
//
// Precedence (highest first): LOADING, MAPGEN, GAME_OVER, PAUSED, PLAYING.

const SCENES = Object.freeze({
  LOADING: "loading",
  MAPGEN: "mapgen",
  GAME_OVER: "game_over",
  PAUSED: "paused",
  PLAYING: "playing",
});

const SceneManager = {
  SCENES: SCENES,

  /** True while assets are still loading (loading overlay visible). */
  isLoading: function () {
    return typeof showLoadingOverlay !== "undefined" && showLoadingOverlay;
  },

  /** True while the phased map generator is running. */
  isGenerating: function () {
    return typeof genPhase !== "undefined" && genPhase > 0;
  },

  /** True if a menu/settings overlay is covering the game. */
  isOverlayOpen: function () {
    return (
      (typeof inGameMenuVisible !== "undefined" && inGameMenuVisible) ||
      (typeof settingsOverlayDiv !== "undefined" && !!settingsOverlayDiv)
    );
  },

  isGameOver: function () {
    return typeof isGameOver !== "undefined" && isGameOver;
  },

  /** Loading or generating — heavy work is in progress. */
  isBusy: function () {
    return this.isLoading() || this.isGenerating();
  },

  /**
   * Gameplay simulation gate: player input, enemy AI, projectiles, combat and
   * the weather clock advance only when no overlay is open and the player is
   * alive. Replaces the inline `!settingsOverlayDiv && !inGameMenuVisible &&
   * !isGameOver` checks.
   */
  isSimulating: function () {
    return !this.isOverlayOpen() && !this.isGameOver();
  },

  /** The dominant scene this frame, by precedence. */
  current: function () {
    if (this.isLoading()) return SCENES.LOADING;
    if (this.isGenerating()) return SCENES.MAPGEN;
    if (this.isGameOver()) return SCENES.GAME_OVER;
    if (this.isOverlayOpen()) return SCENES.PAUSED;
    return SCENES.PLAYING;
  },
};
