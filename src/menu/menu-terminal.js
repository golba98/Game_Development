function injectTerminal() {
    if (terminalEl) return;

    terminalEl = createDiv(`
        <div id="game-terminal">
            <div id="terminal-header">
                <span id="terminal-title">SYSTEM COMMAND INTERFACE</span>
                <span id="terminal-close">ESC to Close</span>
            </div>
            <div id="terminal-history"></div>
            <div id="terminal-input-row">
                <span id="terminal-prompt">></span>
                <input type="text" id="terminal-input" spellcheck="false" autocomplete="off" placeholder="Enter command...">
            </div>
        </div>
    `);
    terminalEl.style('display', 'none');
    terminalEl.style('z-index', '20000');
    terminalEl.style('position', 'fixed');
    terminalEl.style('top', '0');
    terminalEl.style('left', '0');
    terminalEl.style('width', '100%');
    terminalEl.style('height', '100%');
    terminalEl.style('pointer-events', 'none'); // Allow clicks to pass through empty space

    const inner = document.getElementById('game-terminal');
    if (inner) inner.style.pointerEvents = 'auto'; // Re-enable clicks for the terminal itself

    const input = document.getElementById('terminal-input');
    const history = document.getElementById('terminal-history');

    if (!input || !history) return;

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = input.value.trim();
            if (val) {
                processTerminalCommand(val);
                terminalHistory.unshift(val);
                terminalHistoryIndex = -1;
                input.value = '';
            }
        } else if (e.key === 'ArrowUp') {
            if (terminalHistoryIndex < terminalHistory.length - 1) {
                terminalHistoryIndex++;
                input.value = terminalHistory[terminalHistoryIndex];
            }
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            if (terminalHistoryIndex > 0) {
                terminalHistoryIndex--;
                input.value = terminalHistory[terminalHistoryIndex];
            } else {
                terminalHistoryIndex = -1;
                input.value = '';
            }
            e.preventDefault();
        } else if (e.key === 'Escape') {
            toggleTerminal(false);
        }
    });

    terminalLog('CORE OS [Version 1.0.42]', 'terminal-log');
    terminalLog('Initializing secure connection... OK.', 'terminal-log');
    terminalLog('SYSTEM INITIALIZED. WELCOME TO THE GRID COMMAND INTERFACE.', 'terminal-success');
    terminalLog('Type <span style="color:#fff">/help</span> for available commands.', 'terminal-log');
}

function toggleTerminal(state) {
    if (!terminalEl) injectTerminal();
    isTerminalOpen = (state !== undefined) ? state : !isTerminalOpen;
    if (terminalEl) terminalEl.style('display', isTerminalOpen ? 'block' : 'none');
    if (isTerminalOpen) {
        setTimeout(() => document.getElementById('terminal-input')?.focus(), 10);
    }
}

function terminalLogText(msg, className = 'terminal-log') {
    const history = document.getElementById('terminal-history');
    if (!history) return;
    const cmdLine = document.createElement('div');
    cmdLine.className = className;
    cmdLine.textContent = msg;
    history.appendChild(cmdLine);
    history.scrollTop = history.scrollHeight;
}

function terminalLog(msg, className = 'terminal-log') {
    const history = document.getElementById('terminal-history');
    if (!history) return;
    const cmdLine = document.createElement('div');
    cmdLine.className = className;
    cmdLine.innerHTML = msg;
    history.appendChild(cmdLine);
    history.scrollTop = history.scrollHeight;
}

function processTerminalCommand(cmd) {
    terminalLogText(`> ${cmd}`, 'terminal-input-echo');
    const parts = cmd.toLowerCase().split(' ');
    const base = parts[0];

    if (base === '/help') {
        terminalLog('SYSTEM COMMANDS:');
        terminalLog('  <span style="color:#fff">/tutorial welcome</span> - Reset welcome flag only.');
        terminalLog('  <span style="color:#fff">/tutorial reset</span>   - Reset interactive tutorial map.');
        terminalLog('  <span style="color:#fff">/clear</span>            - Wipe terminal log history.');
        terminalLog('  <span style="color:#fff">/exit</span>             - Disconnect from console.');
    } else if (base === '/tutorial') {
        const sub = parts[1];
        if (sub === 'reset' || sub === 'welcome') {
            localStorage.setItem('hasShownWelcomeTutorial', 'false');
            localStorage.setItem('tutorialComplete', 'false');
            const msg = sub === 'welcome'
                ? 'SUCCESS: Welcome protocol and interactive tutorial reset in local storage.'
                : 'SUCCESS: Interactive tutorial state reset in local storage.';
            terminalLog(msg, 'terminal-success');
        } else {
            terminalLog('USAGE: /tutorial [welcome|reset]', 'terminal-log');
        }
    } else if (base === '/clear') {
        const history = document.getElementById('terminal-history');
        if (history) history.innerHTML = '<div class="terminal-log">History cleared.</div>';
    } else if (base === '/exit') {
        toggleTerminal(false);
    } else {
        terminalLog(`ERROR: Command sequence '${base}' not recognized.`, 'terminal-error');
    }
}
