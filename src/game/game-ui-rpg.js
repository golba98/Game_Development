function openCharacterMenu() {
  if (inGameMenuOverlay) return; // Prevent double overlays
  
  const { panel, close } = createZoomStablePanel(450, 400, 'gd-character-menu');
  inGameMenuOverlay = { close };
  inGameMenuVisible = true;
  _addPanelTitle(panel, "CHARACTER STATS");

  const now = millis();
  
  // Style common for labels and values
  const rowStyle = (el) => {
    el.style('width', '100%');
    el.style('display', 'flex');
    el.style('justify-content', 'space-between');
    el.style('margin-bottom', '10px');
    el.style('color', '#fff');
    el.style('font-family', 'Arial, sans-serif');
  };

  const container = createDiv();
  container.parent(panel);
  container.style('width', '80%');
  container.style('margin', '0 auto');
  container.style('margin-top', '20px');

  // Helper to add a stat row
  function addStatRow(label, value, onUpgrade) {
    const row = createDiv();
    row.parent(container);
    rowStyle(row);
    
    const labelSpan = createSpan(label);
    labelSpan.parent(row);
    
    const valContainer = createDiv();
    valContainer.parent(row);
    valContainer.style('display', 'flex');
    valContainer.style('align-items', 'center');
    valContainer.style('gap', '10px');
    
    const valSpan = createSpan(value);
    valSpan.parent(valContainer);
    
    if (statPoints > 0 && onUpgrade) {
      const upBtn = createButton('+');
      upBtn.parent(valContainer);
      upBtn.style('padding', '2px 8px');
      upBtn.style('cursor', 'pointer');
      upBtn.style('background', '#2a2a2a');
      upBtn.style('color', '#ffd700');
      upBtn.style('border', '1px solid #ffd700');
      upBtn.style('border-radius', '4px');
      upBtn.mousePressed(() => {
        onUpgrade();
        playClickSFX();
        close();
        inGameMenuOverlay = null;
        openCharacterMenu(); // Refresh
      });
    }
  }

  addStatRow("LEVEL", playerLevel);
  addStatRow("XP", `${playerXP} / ${xpToNextLevel}`);
  addStatRow("STATS AVAILABLE", statPoints);
  
  const hr = createDiv();
  hr.parent(container);
  hr.style('height', '1px');
  hr.style('background', '#ffd70050');
  hr.style('margin', '15px 0');

  addStatRow("MAX HEALTH", maxHealth, () => {
    if (maxHealth < 20) {
        maxHealth++;
        playerHealth++;
        statPoints--;
    } else {
        showToast("Maximum Health Reached (20)!", "warn");
    }
  });
  
  addStatRow("BASE DAMAGE", playerBaseDamage, () => {
    playerBaseDamage++;
    statPoints--;
  });
  
  addStatRow("MAX MANA", maxMana, () => {
    maxMana += 25;
    playerMana += 25;
    statPoints--;
  });

  addStatRow("STAMINA", playerMaxStamina, () => {
    playerMaxStamina += 20;
    statPoints--;
  });

  const closeBtn = _addMenuBtn(panel, "CLOSE", () => {
    close();
    inGameMenuOverlay = null;
    inGameMenuVisible = false;
  });
  closeBtn.style('margin-top', '30px');
}

window.openCharacterMenu = openCharacterMenu;
window.drawMinimap = drawMinimap;
window.drawHealthBar = drawHealthBar;
window.drawXPBar = drawXPBar;
window.drawScore = drawScore;
window.drawInventory = drawInventory;
window.drawVignette = drawVignette;
window.drawDifficultyBadge = drawDifficultyBadge;
window.drawSprintMeter = drawSprintMeter;
function clearHUD() { /* placeholder to prevent errors if called */ }
window.clearHUD = clearHUD;
