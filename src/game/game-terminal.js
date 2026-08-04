// game-terminal.js — In-game debug terminal (game-side commands)
// Extracted from 4-Game.js

// --- Terminal UI Constants ---
const TERMINAL_SPAWN_DIST = 10; // tile radius used by /spawn boss

// Capture terminal shortcuts at the window level so they work regardless of
// canvas focus, p5 key normalization, or keyboard layout. F2 is the canonical
// shortcut; Backquote (`/~) is retained as a convenient alternative.
window.addEventListener('keydown', event => {
  const isTerminalShortcut = event.key === 'F2' || event.code === 'Backquote';
  if (!isTerminalShortcut || event.repeat) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  toggleTerminal();
}, { capture: true });

// Shows or hides the debug terminal overlay; creates it on first use.
function toggleTerminal() {
  if (!terminalEl) createTerminalUI();

  if (isTerminalOpen) {
    terminalEl.style.display = "none";
    isTerminalOpen = false;
  } else {
    terminalEl.style.display = "flex";
    isTerminalOpen = true;
    const input = document.getElementById("terminal-input");
    if (input) setTimeout(() => input.focus(), 50);
  }
}

// Builds and injects the terminal DOM (styles + HTML); wires keyboard input handling.
function createTerminalUI() {
  // Inject terminal styles once
  if (!document.getElementById("game-terminal-styles")) {
    const style = document.createElement("style");
    style.id = "game-terminal-styles";
    style.textContent = `
            #game-terminal {
                position: fixed;
                top: 10vh;
                left: 50%;
                transform: translateX(-50%);
                width: min(760px, calc(100vw - 32px));
                height: min(480px, 72vh);
                background: #101214;
                border: 1px solid #343a40;
                box-shadow: 0 16px 48px rgba(0,0,0,0.65);
                padding: 0;
                display: none;
                flex-direction: column;
                font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                color: #d8dee9;
                z-index: 20000;
                pointer-events: auto;
                border-radius: 6px;
                overflow: hidden;
            }
            #terminal-header {
                background: #1b1f23;
                color: #aeb6bf;
                padding: 7px 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #343a40;
                font-size: 12px;
            }
            #terminal-close { color: #78838f; }
            #terminal-history {
                flex: 1;
                overflow-y: auto;
                margin: 0;
                padding: 12px;
                scrollbar-width: thin;
                scrollbar-color: #4b5560 transparent;
            }
            #terminal-history::-webkit-scrollbar { width: 6px; }
            #terminal-history::-webkit-scrollbar-thumb { background: #4b5560; }
            #terminal-input-row {
                display: flex;
                align-items: baseline;
                border-top: 1px solid #2c3238;
                padding: 9px 12px 11px;
                background: #101214;
            }
            #terminal-prompt {
                margin-right: 8px;
                color: #7ee787;
            }
            #terminal-input {
                background: transparent;
                border: none;
                color: #d8dee9;
                font: inherit;
                width: 100%;
                outline: none;
                caret-color: #d8dee9;
            }
            #terminal-input::placeholder { color: #59636e; }
            .terminal-log { margin: 0 0 2px; color: #d8dee9; white-space: pre-wrap; }
            .terminal-success { color: #7ee787; }
            .terminal-error { color: #ff7b72; }
            .terminal-input-echo { color: #79c0ff; }
            .terminal-hint { color: #8b949e; }
        `;
    document.head.appendChild(style);
  }

  terminalEl = document.createElement("div");
  terminalEl.id = "game-terminal";
  terminalEl.innerHTML = `
        <div id="terminal-header">
            <span id="terminal-title">Terminal</span>
            <span id="terminal-close">F2 or Esc to close</span>
        </div>
        <div id="terminal-history">
            <div class="terminal-hint">Type /help for commands. Use Up/Down for history.</div>
        </div>
        <div id="terminal-input-row">
            <span id="terminal-prompt">$</span>
            <input type="text" id="terminal-input" spellcheck="false" autocomplete="off" aria-label="Terminal command">
        </div>
    `;
  document.body.appendChild(terminalEl);

  const input = document.getElementById("terminal-input");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const cmd = input.value.trim();
      if (cmd) {
        processTerminalCommand(cmd);
        terminalHistory.push(cmd);
        terminalHistoryIndex = -1;
        input.value = "";
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (terminalHistory.length > 0) {
        if (terminalHistoryIndex === -1)
          terminalHistoryIndex = terminalHistory.length - 1;
        else terminalHistoryIndex = Math.max(0, terminalHistoryIndex - 1);
        input.value = terminalHistory[terminalHistoryIndex];
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (terminalHistoryIndex !== -1) {
        terminalHistoryIndex++;
        if (terminalHistoryIndex >= terminalHistory.length) {
          terminalHistoryIndex = -1;
          input.value = "";
        } else {
          input.value = terminalHistory[terminalHistoryIndex];
        }
      }
    } else if (e.key === "Escape") {
      toggleTerminal();
    } else if (e.key === "F2" || e.code === "Backquote" || (e.key === "'" && e.ctrlKey)) {
      e.preventDefault();
      toggleTerminal();
    }
  });
}

// Parses and executes a terminal command string; appends output to terminal history.
function processTerminalCommand(cmd) {
  const history = document.getElementById("terminal-history");
  const log = (msg, type = "") => {
    const div = document.createElement("div");
    div.className = "terminal-log " + type;
    div.textContent = String(msg);
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
  };

  const help = (command, description) => {
    const div = document.createElement("div");
    div.className = "terminal-log";
    const commandSpan = document.createElement("span");
    commandSpan.style.color = "#fff";
    commandSpan.textContent = command;
    div.append("  ", commandSpan, ` - ${description}`);
    history.appendChild(div);
  };

  // Safely log the command by using textContent on a prefix span
  const cmdLine = document.createElement("div");
  cmdLine.className = "terminal-log";
  const prefix = document.createElement("span");
  prefix.style.opacity = "0.5";
  prefix.textContent = "> " + cmd;
  cmdLine.appendChild(prefix);
  history.appendChild(cmdLine);

  const parts = cmd.split(" ");
  const base = parts[0].toLowerCase();

  if (base === "/kill" && parts[1] === "all") {
    if (enemies && enemies.length > 0) {
      const count = enemies.length;
      enemies = [];
      log(
        `SUCCESS: ${count} neural signatures purged from local grid.`,
        "terminal-success",
      );
    } else {
      log(
        "NOTICE: Scan complete. No enemy signatures detected.",
        "terminal-log",
      );
    }
  } else if (base === "/collect" && parts[1] === "all") {
    if (!mapStates) {
      log("ERROR: Neural map not initialized.", "terminal-error");
    } else {
      let collected = 0;
      for (let i = 0; i < mapStates.length; i++) {
        if (mapStates[i] === TILE_TYPES.COIN) {
          const underlyingTerrain =
            (terrainLayer && terrainLayer[i]) || TILE_TYPES.GRASS;
          mapStates[i] = underlyingTerrain;
          playerScore += COIN_SCORE_VALUE;
          collected++;
        }
      }
      if (collected > 0) {
        lastScoreChange = millis();
        createMapImage(logicalW, logicalH); // Refresh the whole map image
        log(
          `SUCCESS: ${collected} gold units sequestered into player storage.`,
          "terminal-success",
        );
      } else {
        log(
          "NOTICE: No loose currency detected on current grid.",
          "terminal-log",
        );
      }
    }
  } else if (base === "/scan" && parts[1] === "boss") {
    const boss = (enemies || []).find((e) => e.type === "beetle");
    if (boss) {
      log(
        `CRITICAL THREAT DETECTED: [Beetle Boss] status: ACTIVE, health: ${Math.floor(boss.health)}/${boss.maxHealth}`,
        "terminal-error",
      );
    } else {
      log(
        "NOTICE: No elite signatures detected in current sector.",
        "terminal-log",
      );
    }
  } else if (base === "/locate" && parts[1] === "boss") {
    const boss = (enemies || []).find((e) => e.type === "beetle");
    if (boss) {
      const dx = Math.floor(boss.x - playerPosition.x);
      const dy = Math.floor(boss.y - playerPosition.y);
      const distStr = Math.hypot(dx, dy).toFixed(1);
      log(
        `SIGNAL STRENGTH: Boss coordinates confirmed. Sector: [${Math.floor(boss.x)}, ${Math.floor(boss.y)}]. Distance: ${distStr}m.`,
        "terminal-success",
      );
    } else {
      log(
        "ERROR: Unable to lock on. No boss signature found.",
        "terminal-error",
      );
    }
  } else if (base === "/kill" && parts[1] === "boss") {
    const boss = enemies.find((e) => e.type === "beetle");
    if (boss) {
      spawnSplat(boss.x, boss.y, "egg");
      spawnDamageText("TERMINATED", boss.x, boss.y, [255, 80, 80]);
      boss.health = 0;
      log(
        "SUCCESS: Boss Beetle neutralized. Threat eliminated.",
        "terminal-success",
      );
    } else {
      log(
        "ERROR: No boss signature detected. Nothing to kill.",
        "terminal-error",
      );
    }
  } else if (base === "/spawn" && parts[1] === "boss") {
    const angle = Math.random() * TWO_PI;
    const ex = Math.floor(
      playerPosition.x + Math.cos(angle) * TERMINAL_SPAWN_DIST,
    );
    const ey = Math.floor(
      playerPosition.y + Math.sin(angle) * TERMINAL_SPAWN_DIST,
    );
    spawnEnemy("beetle", ex, ey);
    log(
      `CRITICAL: Boss Beetle signature forced into local grid at [${ex}, ${ey}].`,
      "terminal-error",
    );
  } else if (base === "/spawn" && parts[1] === "ghost") {
    const angle = Math.random() * TWO_PI;
    const ex = Math.floor(
      playerPosition.x + Math.cos(angle) * TERMINAL_SPAWN_DIST,
    );
    const ey = Math.floor(
      playerPosition.y + Math.sin(angle) * TERMINAL_SPAWN_DIST,
    );
    spawnEnemy("ghost", ex, ey);
    log(
      `WARNING: Spectral anomaly materialized at [${ex}, ${ey}]. The veil thins...`,
      "terminal-error",
    );
  } else if (base === "/give") {
    if (!playerInventory) playerInventory = { potion: 0, speed: 0 };
    const item = parts[1];
    if (item === "potion") {
      playerInventory["potion"] += 1;
      log(
        "SUCCESS: Dispensed 1x Health Potion to inventory.",
        "terminal-success",
      );
    } else if (item === "speed") {
      playerInventory["speed"] += 1;
      log(
        "SUCCESS: Dispensed 1x Speed Potion to inventory.",
        "terminal-success",
      );
    } else if (item === "all") {
      playerInventory["potion"] += 5;
      playerInventory["speed"] += 5;
      log(
        "SUCCESS: Dispensed survival package (5x Health, 5x Speed).",
        "terminal-success",
      );
    } else {
      log("USAGE: /give [potion|speed|all]", "terminal-log");
    }
  } else if (base === "/time") {
    if (typeof WeatherSystem === "undefined") {
      log("ERROR: Weather system not active.", "terminal-error");
    } else if (parts[1] === "dawn") {
      WeatherSystem.transitionTo(CYCLE_NIGHT_END);
      log(
        "SUCCESS: Dawn transition started.",
        "terminal-success",
      );
    } else if (parts[1] === "day") {
      WeatherSystem.transitionTo(CYCLE_DAY_START);
      log(
        "SUCCESS: Daylight transition started.",
        "terminal-success",
      );
    } else if (parts[1] === "dusk" || parts[1] === "sunset") {
      WeatherSystem.transitionTo(CYCLE_DAY_END);
      log(
        "SUCCESS: Dusk transition started.",
        "terminal-success",
      );
    } else if (parts[1] === "night") {
      if (isTutorialMap) {
        log("TRAINING LOCK: Night mode begins after entering the forest.", "terminal-hint");
        return;
      }
      WeatherSystem.transitionTo(CYCLE_NIGHT_START);
      log(
        "SUCCESS: Night transition started. Ghosts arrive when darkness settles.",
        "terminal-success",
      );
    } else {
      log("USAGE: /time [dawn|day|dusk|night]", "terminal-log");
    }
  } else if (base === "/health") {
    const amt = parseInt(parts[1]);
    if (!isNaN(amt) && amt > 0) {
      maxHealth = amt;
      playerHealth = amt;
      lastHealthChange = millis();
      log(
        `SUCCESS: Vitality protocols updated. Health set to ${amt}.`,
        "terminal-success",
      );
    } else {
      log("USAGE: /health [amount]", "terminal-log");
    }
  } else if (base === "/tutorial") {
    if (parts[1] === "reset" || parts[1] === "welcome") {
      hasShownWelcomeTutorial = false;
      isTutorialMap = true;
      tutorialStep = 0;
      tutorialMoved = false;
      tutorialAttacked = false;
      tutorialCollected = false;
      tutorialSprintDetected = false;
      tutorialHitLanded = false;
      tutorialStepTimer = 0;
      tutorialMessage = "";
      tutorialMessageTimer = 0;
      localStorage.setItem("hasShownWelcomeTutorial", "false");
      localStorage.setItem("tutorialComplete", "false");
      log(
        "SUCCESS: Tutorial state reset. Loading Training Glade...",
        "terminal-success",
      );
      try {
        toggleTerminal();
      } catch (e) {}
      setTimeout(() => generateMap(), 300);
    } else {
      log("USAGE: /tutorial [reset|welcome]", "terminal-log");
    }
  } else if (base === "/help") {
    log("SYSTEM COMMANDS:");
    help('/kill all', 'Wipe all enemies.');
    help('/collect all', 'Collect all coins on the map.');
    help('/scan boss', 'Check for active boss signatures.');
    help('/locate boss', 'Get precise boss coordinates.');
    help('/kill boss', 'Instantly kill the boss beetle.');
    help('/spawn boss', 'Force a boss beetle to spawn near you.');
    help('/spawn ghost', 'Force a ghost to spawn near you.');
    help('/give potion', 'Give 1 health potion.');
    help('/give speed', 'Give 1 speed potion.');
    help('/time [dawn|day|dusk|night]', 'Change the time of day.');
    help('/health [n]', 'Set max health to n.');
    help('/tutorial reset', 'Reset tutorial on next reload.');
    help('/clear', 'Wipe terminal log history.');
    help('/exit', 'Disconnect from console.');
  } else if (base === "/clear") {
    history.replaceChildren();
    log('History cleared.');
  } else if (base === "/exit") {
    toggleTerminal();
  } else {
    log(`ERROR: Unknown command sequence "${base}".`, "terminal-error");
  }
}
