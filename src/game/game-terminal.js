// game-terminal.js — In-game debug terminal (game-side commands)
// Extracted from 4-Game.js

// --- Terminal UI Constants ---
const TERMINAL_PANEL_WIDTH = 700; // px — terminal overlay width
const TERMINAL_PANEL_HEIGHT = 450; // px — terminal overlay height
const TERMINAL_SPAWN_DIST = 10; // tile radius used by /spawn boss

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
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: ${TERMINAL_PANEL_WIDTH}px;
                height: ${TERMINAL_PANEL_HEIGHT}px;
                background: rgba(15, 15, 20, 0.98);
                border: 3px solid #ffcc00;
                box-shadow: 0 0 30px rgba(0,0,0,0.9), inset 0 0 15px rgba(255,204,0,0.1);
                padding: 0;
                display: none;
                flex-direction: column;
                font-family: 'MyFont', Courier, monospace;
                color: white;
                z-index: 20000;
                pointer-events: auto;
                border-radius: 8px;
                overflow: hidden;
            }
            #terminal-header {
                background: #ffcc00;
                color: #000;
                padding: 8px 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-weight: bold;
                letter-spacing: 1px;
                font-size: 14px;
            }
            #terminal-close { opacity: 0.7; font-size: 12px; }
            #terminal-history {
                flex: 1;
                overflow-y: auto;
                margin: 0;
                padding: 20px;
                scrollbar-width: thin;
                scrollbar-color: #ffcc00 transparent;
                font-size: 16px;
                line-height: 1.4;
            }
            #terminal-history::-webkit-scrollbar { width: 6px; }
            #terminal-history::-webkit-scrollbar-thumb { background: #ffcc00; border-radius: 3px; }
            #terminal-input-row {
                display: flex;
                align-items: center;
                border-top: 2px solid rgba(255,204,0,0.3);
                padding: 15px 20px;
                background: rgba(0,0,0,0.3);
            }
            #terminal-prompt {
                margin-right: 12px;
                font-weight: bold;
                color: #ffcc00;
                font-size: 20px;
            }
            #terminal-input {
                background: transparent;
                border: none;
                color: white;
                font-family: 'MyFont', monospace;
                font-size: 18px;
                width: 100%;
                outline: none;
            }
            #terminal-input::placeholder { color: rgba(255,255,255,0.2); }
            .terminal-log { margin-bottom: 6px; color: rgba(255,255,255,0.9); }
            .terminal-success { margin-bottom: 6px; color: #ffff00; font-weight: bold; text-shadow: 0 0 5px rgba(255,255,0,0.3); }
            .terminal-error { margin-bottom: 6px; color: #ff4444; font-weight: bold; }
            .terminal-input-echo { margin-bottom: 6px; color: #ffcc00; opacity: 0.8; }
            .terminal-hint { margin-bottom: 6px; color: rgba(255,255,255,0.45); font-style: italic; }
        `;
    document.head.appendChild(style);
  }

  terminalEl = document.createElement("div");
  terminalEl.id = "game-terminal";
  terminalEl.innerHTML = `
        <div id="terminal-header">
            <span id="terminal-title">SYSTEM COMMAND INTERFACE</span>
            <span id="terminal-close">ESC to Close</span>
        </div>
        <div id="terminal-history">
            <div class="terminal-log">CORE OS [Version 1.0.42]</div>
            <div class="terminal-log">Initializing secure connection... OK.</div>
            <div class="terminal-log">Welcome back, Administrator.</div>
            <div class="terminal-hint">Tip: Use Up/Down arrows to cycle history. Type /help for commands.</div>
        </div>
        <div id="terminal-input-row">
            <span id="terminal-prompt">&gt;</span>
            <input type="text" id="terminal-input" spellcheck="false" autocomplete="off" placeholder="Enter command...">
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
    } else if (e.key === "'" && e.ctrlKey) {
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
    div.textContent = msg;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
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
      WeatherSystem.cycle = 0.2; // CYCLE_NIGHT_END
      WeatherSystem.calculateColor();
      if (WeatherSystem.lightMap) WeatherSystem.lightMap.clear();
      despawnGhosts();
      log(
        "SUCCESS: Temporal shift complete. Time set to DAWN.",
        "terminal-success",
      );
    } else if (parts[1] === "day") {
      WeatherSystem.cycle = 0.3; // CYCLE_DAY_START
      WeatherSystem.calculateColor();
      if (WeatherSystem.lightMap) WeatherSystem.lightMap.clear();
      despawnGhosts();
      log(
        "SUCCESS: Temporal shift complete. Time set to DAY.",
        "terminal-success",
      );
    } else if (parts[1] === "dusk" || parts[1] === "sunset") {
      WeatherSystem.cycle = 0.6; // CYCLE_DAY_END
      WeatherSystem.calculateColor();
      log(
        "SUCCESS: Temporal shift complete. Time set to DUSK.",
        "terminal-success",
      );
    } else if (parts[1] === "night") {
      WeatherSystem.cycle = 0.9; // CYCLE_NIGHT_START
      WeatherSystem.calculateColor();
      spawnNightGhosts();
      log(
        "SUCCESS: Temporal shift complete. Time set to NIGHT. Ghosts emerge from the shadows...",
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
    log(
      '  <span style="color:#fff">/kill all</span>       - Wipe all enemies.',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/collect all</span>    - Collect all coins on the map.',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/scan boss</span>      - Check for active boss signatures.',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/locate boss</span>    - Get precise boss coordinates.',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/kill boss</span>      - Instantly kill the boss beetle.',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/spawn boss</span>     - Force a boss beetle to spawn near you.',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/spawn ghost</span>    - Force a ghost to spawn near you.',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/give potion</span>    - Give 1 health potion.',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/give speed</span>     - Give 1 speed potion.',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/time [dawn|day|dusk|night]</span> - Change the time of day.',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/health [n]</span>     - Set max health to n.',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/tutorial reset</span> - Reset tutorial (shows on next reload).',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/clear</span>          - Wipe terminal log history.',
      "",
      true,
    );
    log(
      '  <span style="color:#fff">/exit</span>           - Disconnect from console.',
      "",
      true,
    );
  } else if (base === "/clear") {
    history.innerHTML = '<div class="terminal-log">History cleared.</div>';
  } else if (base === "/exit") {
    toggleTerminal();
  } else {
    log(`ERROR: Unknown command sequence "${base}".`, "terminal-error");
  }
}
